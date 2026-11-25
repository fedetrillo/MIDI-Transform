// MIDI Transform: the transformations themselves, as pure functions over plain notes.
//
// A note here is { pitch, start, stop, velocity, channel, group } with start and stop in absolute
// session ticks. `group` says which clip a note belongs to, for the transformations that look at
// a note's neighbours (legato). Every function returns new notes and leaves the input alone.

(function (root) {
  // Ticks per quarter note: LUNA's engine resolution, set by the page from Luna.TICKS_PER_BEAT.
  let TPB = 960;
  const setTPB = (v) => { if (v > 0) TPB = v; };
  const MIN = () => Math.max(1, Math.round(TPB / 96));   // the shortest note we write: a 1/384
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // A small, repeatable random source: the same seed gives the same humanize.
  function rng(seed) {
    let x = (seed * 2654435761) >>> 0 || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }
  // Something between -1 and 1 that leans towards 0, like a hand does.
  const wobble = (r) => (r() + r() + r()) / 1.5 - 1;

  // Grid length in ticks: '1/16' straight ('n'), triplet ('t', 3 in the time of 2), dotted ('d'),
  // quintuplet ('5', 5 in the time of 4) or septuplet ('7', 7 in the time of 4).
  const FEEL = { n: 1, t: 2 / 3, d: 1.5, 5: 4 / 5, 7: 4 / 7 };
  function gridTicks(grid, feel = 'n') {
    const [a, b] = String(grid).split('/').map(Number);
    const base = (TPB * 4 * (a || 1)) / (b || 1);
    return Math.round(base * (FEEL[feel] ?? 1));
  }

  // The grid point nearest to `tick`, with swing pushing every second point later.
  function snap(tick, g, swing) {
    const sw = ((swing || 0) / 100) * (g / 3);
    const k = Math.round(tick / g);
    let best = null;
    for (let i = k - 1; i <= k + 1; i++) {
      const pos = i * g + (((i % 2) + 2) % 2 === 1 ? sw : 0);
      if (best === null || Math.abs(pos - tick) < Math.abs(best - tick)) best = pos;
    }
    return best;
  }

  // Where a tick snaps to. 'm' (mixed) picks the nearer of the straight and the triplet grid, for
  // parts that mix both, like a drummer's fills.
  function target(tick, o) {
    if (o.feel === 'm') {
      const a = snap(tick, gridTicks(o.grid, 'n'), o.swing), b = snap(tick, gridTicks(o.grid, 't'), 0);
      return Math.abs(a - tick) <= Math.abs(b - tick) ? a : b;
    }
    return snap(tick, gridTicks(o.grid, o.feel), o.feel === 'n' ? o.swing : 0);
  }

  function quantize(notes, o) {
    const g = gridTicks(o.grid, o.feel === 'm' ? 't' : o.feel);
    const k = clamp(o.strength ?? 100, 0, 100) / 100;
    // Catch: only notes within this share of half a step get pulled (100% = all of them).
    // Free zone: notes already this close to the grid are left alone, keeping the feel.
    const reach = (clamp(o.range ?? 100, 0, 100) / 100) * (g / 2), free = (clamp(o.zone ?? 0, 0, 100) / 100) * (g / 2);
    return notes.map((n) => {
      const len = n.stop - n.start;
      const to = target(n.start, o), off = Math.abs(to - n.start);
      if (off > reach + 0.5 || (free > 0 && off <= free)) return { ...n };
      const start = Math.round(n.start + (to - n.start) * k);
      let stop = start + len;
      if (o.ends) {
        const q = Math.round(n.stop + (snap(n.stop, g, 0) - n.stop) * k);
        stop = Math.max(start + Math.round(g / 2), q);
      }
      return { ...n, start, stop };
    });
  }

  function humanize(notes, o) {
    const r = rng(o.seed ?? 1);
    const tt = Math.max(0, o.timing ?? 0), vv = Math.max(0, o.vel ?? 0), ll = Math.max(0, o.len ?? 0) / 100;
    // Notes that start together (a chord) move together, a little apart from each other.
    const moves = new Map();
    return notes.map((n) => {
      const key = `${n.group}:${n.start}`;
      if (!moves.has(key)) moves.set(key, wobble(r) * tt);
      const start = Math.max(0, Math.round(n.start + moves.get(key) + wobble(r) * tt * 0.15));
      const len = Math.max(MIN(), Math.round((n.stop - n.start) * (1 + wobble(r) * ll)));
      const velocity = clamp(Math.round(n.velocity + wobble(r) * vv), 1, 127);
      return { ...n, start, stop: start + len, velocity };
    });
  }

  function velocity(notes, o) {
    if (!notes.length) return [];
    if (o.mode === 'fixed') return notes.map((n) => ({ ...n, velocity: clamp(Math.round(o.value ?? 100), 1, 127) }));
    if (o.mode === 'ramp') {
      const a = Math.min(...notes.map((n) => n.start)), b = Math.max(...notes.map((n) => n.start));
      const curve = o.curve ?? 0;   // -100 slow start .. 100 fast start
      return notes.map((n) => {
        let x = b > a ? (n.start - a) / (b - a) : 0;
        if (curve) x = curve > 0 ? 1 - (1 - x) ** (1 + curve / 33) : x ** (1 - curve / 33);
        return { ...n, velocity: clamp(Math.round((o.from ?? 40) + ((o.to ?? 110) - (o.from ?? 40)) * x), 1, 127) };
      });
    }
    // Scale: spread the velocities apart (more dynamics) or squeeze them together (less), around
    // their average, then add the offset.
    const mean = notes.reduce((t, n) => t + n.velocity, 0) / notes.length;
    const f = 1 + (o.amount ?? 0) / 100;
    return notes.map((n) => ({ ...n, velocity: clamp(Math.round(mean + (n.velocity - mean) * f + (o.offset ?? 0)), 1, 127) }));
  }

  function length(notes, o) {
    if (o.mode === 'fixed') {
      const len = gridTicks(o.grid, o.feel);
      return notes.map((n) => ({ ...n, stop: n.start + len }));
    }
    if (o.mode === 'scale') {
      const f = clamp(o.pct ?? 100, 1, 1000) / 100;
      return notes.map((n) => ({ ...n, stop: n.start + Math.max(MIN(), Math.round((n.stop - n.start) * f)) }));
    }
    // Legato: every note lasts until the next one starts (minus a gap), chords included.
    const gap = Math.max(0, o.gap ?? 0);
    const starts = new Map();
    for (const n of notes) { if (!starts.has(n.group)) starts.set(n.group, new Set()); starts.get(n.group).add(n.start); }
    const sorted = new Map([...starts].map(([g, s]) => [g, [...s].sort((a, b) => a - b)]));
    return notes.map((n) => {
      const next = sorted.get(n.group).find((x) => x > n.start);
      if (next === undefined) return { ...n };
      return { ...n, stop: Math.max(n.start + MIN(), next - gap) };
    });
  }

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentaMaj: [0, 2, 4, 7, 9],
    pentaMin: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
  };
  const inScale = (p, key, scale) => SCALES[scale].includes((((p - key) % 12) + 12) % 12);
  function toScale(p, key, scale, dir) {
    if (inScale(p, key, scale)) return p;
    for (let d = 1; d < 12; d++) {
      const up = p + d, down = p - d;
      if (dir === 'up') { if (inScale(up, key, scale)) return up; continue; }
      if (dir === 'down') { if (inScale(down, key, scale)) return down; continue; }
      if (inScale(down, key, scale)) return down;
      if (inScale(up, key, scale)) return up;
    }
    return p;
  }

  function pitch(notes, o) {
    if (!notes.length) return [];
    if (o.mode === 'scale') return notes.map((n) => ({ ...n, pitch: clamp(toScale(n.pitch, o.key ?? 0, o.scale ?? 'major', o.dir), 0, 127) }));
    if (o.mode === 'invert') {
      const lo = Math.min(...notes.map((n) => n.pitch)), hi = Math.max(...notes.map((n) => n.pitch));
      const pivot2 = o.pivot === 'low' ? lo * 2 : o.pivot === 'high' ? hi * 2 : lo + hi;
      return notes.map((n) => {
        let p = pivot2 - n.pitch;
        if (o.keepScale) p = toScale(p, o.key ?? 0, o.scale ?? 'major', 'nearest');
        return { ...n, pitch: clamp(p, 0, 127) };
      });
    }
    if (o.mode === 'limit') {
      const lo = clamp(Math.min(o.low ?? 36, o.high ?? 84), 0, 127), hi = clamp(Math.max(o.low ?? 36, o.high ?? 84), 0, 127);
      return notes.map((n) => {
        let p = n.pitch;
        if (hi - lo >= 11) { while (p < lo) p += 12; while (p > hi) p -= 12; }
        return { ...n, pitch: clamp(p, lo, hi) };
      });
    }
    const st = Math.round((o.semis ?? 0) + 12 * (o.octaves ?? 0));
    return notes.map((n) => ({ ...n, pitch: clamp(n.pitch + st, 0, 127) }));
  }

  function time(notes, o) {
    if (!notes.length) return [];
    const a = Math.min(...notes.map((n) => n.start)), b = Math.max(...notes.map((n) => n.stop));
    if (o.mode === 'reverse') return notes.map((n) => { const start = a + (b - n.stop); return { ...n, start, stop: start + (n.stop - n.start) }; });
    if (o.mode === 'half' || o.mode === 'double') {
      const f = o.mode === 'half' ? 2 : 0.5;
      return notes.map((n) => { const start = Math.round(a + (n.start - a) * f); return { ...n, start, stop: start + Math.max(MIN(), Math.round((n.stop - n.start) * f)) }; });
    }
    const by = Math.round((o.steps ?? 0) * gridTicks(o.grid ?? '1/16', 'n'));
    return notes.map((n) => ({ ...n, start: Math.max(0, n.start + by), stop: Math.max(0, n.start + by) + (n.stop - n.start) }));
  }

  // ---- Groove -----------------------------------------------------------------------------------
  // A template gives every step of a bar (16 sixteenths, or 8 eighths) a timing offset, as a share
  // of a step (+ late, - early), and a velocity factor. The bar is 4 beats from tick 0.
  const GROOVES = {
    mpc: (s, n, o) => ({ t: s % 2 ? ((o.swing ?? 62) - 50) / 50 : 0, v: s % 2 ? 0.9 : 1 }),
    shuffle: (s) => ({ t: s % 2 ? 1 / 3 : 0, v: s % 2 ? 0.85 : (s % 4 === 0 ? 1.08 : 1) }),
    funk: (s, n) => ({ t: s % 2 ? 0.14 : 0, v: [1.15, 0.7, 0.9, 0.75][(s * (16 / n)) % 4] ?? 1 }),
    house: (s, n) => { const k = (s * (16 / n)) % 4; return { t: k % 2 ? 0.08 : 0, v: k === 2 ? 1.15 : k === 0 ? 1 : 0.8 }; },
    push: (s) => ({ t: s % 2 ? -0.12 : 0, v: s % 2 ? 1.1 : 0.95 }),
    laid: (s, n) => { const beat = n / 4, back = s === beat || s === beat * 3; return { t: back ? 0.18 : s % 2 ? 0.1 : s === 0 ? 0 : 0.05, v: back ? 1.1 : 1 }; },
  };
  const stepsFor = (grid) => (grid === '1/8' ? 8 : 16);
  function grooveStep(o, s, n) {
    if (o.template === 'mine') {
      const c = o.custom;
      if (!c || !c.t?.length) return { t: 0, v: 1 };
      const i = Math.floor((s / n) * c.t.length) % c.t.length;
      return { t: c.t[i] ?? 0, v: c.v[i] ?? 1 };
    }
    return (GROOVES[o.template] ?? GROOVES.mpc)(s, n, o);
  }
  function groove(notes, o) {
    const g = gridTicks(o.grid ?? '1/16', 'n'), n = stepsFor(o.grid);
    const q = clamp(o.quant ?? 100, 0, 100) / 100, kt = clamp(o.timing ?? 100, 0, 150) / 100, kv = clamp(o.vel ?? 0, 0, 150) / 100;
    return notes.map((x) => {
      const k = Math.round(x.start / g), s = ((k % n) + n) % n;
      const st = grooveStep(o, s, n);
      const len = x.stop - x.start;
      const start = Math.max(0, Math.round(x.start + (k * g - x.start) * q + st.t * g * kt));
      const velocity = clamp(Math.round(x.velocity * (1 + (st.v - 1) * kv)), 1, 127);
      return { ...x, start, stop: start + len, velocity };
    });
  }
  // The feel of some notes, as a template: each step's average offset from the straight grid and
  // its average velocity against the whole.
  function captureGroove(notes, grid) {
    const g = gridTicks(grid ?? '1/16', 'n'), n = stepsFor(grid);
    const sumT = new Array(n).fill(0), sumV = new Array(n).fill(0), cnt = new Array(n).fill(0);
    let all = 0;
    for (const x of notes) {
      const k = Math.round(x.start / g), s = ((k % n) + n) % n;
      sumT[s] += (x.start - k * g) / g; sumV[s] += x.velocity; cnt[s]++; all += x.velocity;
    }
    if (!notes.length) return null;
    const mean = all / notes.length;
    return { grid: grid ?? '1/16', notes: notes.length,
      t: sumT.map((v, i) => (cnt[i] ? +(v / cnt[i]).toFixed(3) : 0)),
      v: sumV.map((v, i) => (cnt[i] ? +(v / cnt[i] / mean).toFixed(3) : 1)) };
  }

  // ---- Strum --------------------------------------------------------------------------------------
  // The notes of each chord (same clip, starting within a 1/64 of each other) start one after
  // another, `gap` ticks apart on average. Note ends stay where they were.
  function chords(notes) {
    const tol = Math.max(1, Math.round(TPB / 16));
    const idx = notes.map((x, i) => i).sort((i, j) => (notes[i].group < notes[j].group ? -1 : notes[i].group > notes[j].group ? 1 : notes[i].start - notes[j].start));
    const out = [];
    let cur = null;
    for (const i of idx) {
      const x = notes[i];
      if (cur && cur.group === x.group && x.start - cur.start <= tol) cur.items.push(i);
      else { cur = { group: x.group, start: x.start, items: [i] }; out.push(cur); }
    }
    return out;
  }
  function strum(notes, o) {
    const out = notes.map((x) => ({ ...x }));
    const gap = Math.max(0, o.gap ?? 0), p = 2 ** (Math.abs(o.curve ?? 0) / 50), fade = (o.fade ?? 0) / 100;
    let k = 0;
    for (const c of chords(notes)) {
      if (c.items.length < 2) continue;
      const down = o.dir === 'down' || (o.dir === 'alt' && k % 2 === 1);
      k++;
      const order = [...c.items].sort((i, j) => (down ? notes[j].pitch - notes[i].pitch : notes[i].pitch - notes[j].pitch));
      const m = order.length, total = gap * (m - 1), base = Math.min(...order.map((i) => notes[i].start));
      order.forEach((i, r) => {
        let f = r / (m - 1);
        if (o.curve > 0) f = 1 - (1 - f) ** p; else if (o.curve < 0) f = f ** p;
        const x = out[i];
        const start = Math.round(base + total * f);
        x.stop = Math.max(start + MIN(), x.stop);
        x.start = start;
        x.velocity = clamp(Math.round(x.velocity * (1 + fade * f)), 1, 127);
      });
    }
    return out;
  }

  // ---- Chop, flam, glue -----------------------------------------------------------------------------
  function chop(notes, o) {
    if (o.mode === 'flam') {
      const off = Math.max(MIN(), o.off ?? TPB / 16), count = clamp(o.count ?? 1, 1, 4), gv = clamp(o.graceVel ?? 60, 1, 100) / 100;
      const out = [];
      for (const x of notes) {
        for (let k = count; k >= 1; k--) {
          const start = x.start - off * k;
          if (start < 0) continue;
          out.push({ ...x, start, stop: start + Math.max(MIN(), Math.round(off * 0.8)), velocity: clamp(Math.round(x.velocity * gv * (1 - (k - 1) * 0.12)), 1, 127) });
        }
        out.push({ ...x });
      }
      return out;
    }
    if (o.mode === 'glue') {
      const gap = Math.max(0, o.gap ?? 0);
      const by = new Map();
      notes.forEach((x, i) => { const key = `${x.group}:${x.pitch}`; if (!by.has(key)) by.set(key, []); by.get(key).push(i); });
      const keep = new Array(notes.length).fill(true), out = notes.map((x) => ({ ...x }));
      for (const list of by.values()) {
        list.sort((i, j) => notes[i].start - notes[j].start);
        let head = list[0];
        for (const i of list.slice(1)) {
          if (notes[i].start - out[head].stop <= gap && notes[i].start >= out[head].start) { out[head].stop = Math.max(out[head].stop, notes[i].stop); keep[i] = false; }
          else head = i;
        }
      }
      return out.filter((x, i) => keep[i]);
    }
    // Chop: every note becomes repeats of one grid step, each `gate`% of the step long.
    const g = gridTicks(o.grid ?? '1/16', o.feel ?? 'n'), gate = clamp(o.gate ?? 90, 10, 100) / 100, fade = (o.fade ?? 0) / 100;
    const out = [];
    for (const x of notes) {
      const pieces = Math.max(1, Math.ceil((x.stop - x.start) / g - 0.01));
      for (let k = 0; k < pieces; k++) {
        const start = x.start + k * g;
        const stop = Math.min(x.stop, start + Math.max(MIN(), Math.round(g * gate)));
        if (stop <= start) break;
        const f = pieces > 1 ? k / (pieces - 1) : 0;
        out.push({ ...x, start, stop, velocity: clamp(Math.round(x.velocity * (1 + fade * f)), 1, 127) });
      }
    }
    return out;
  }

  const apply = (kind, notes, o) => ({ quantize, humanize, velocity, length, pitch, time, groove, strum, chop })[kind](notes, o);

  root.MidiTransform = { setTPB, get TPB() { return TPB; }, MIN, SCALES, gridTicks, snap, quantize, humanize, velocity, length, pitch, time, groove, strum, chop, captureGroove, GROOVES, apply, toScale };
})(typeof window !== 'undefined' ? window : globalThis);
