// MIDI Transform: quantize, humanize, velocity, length, pitch and time tools for the MIDI notes
// selected in LUNA (or every note in a selected range of MIDI clips), with a before/after preview.
//
// Each Apply is one undo step: the old notes are deleted and the new ones written in a single
// session transaction (only velocity changes go through LUNA's own Change Velocities instead).

(() => {
  const $ = (id) => document.getElementById(id);
  const T = window.MidiTransform;
  const VERSION = '1.1.2';
  const KEY = 'com.fedetrillo.miditransform.';
  const store = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* not fatal */ } },
  };

  const I18N = {
    en: {
      groove: "Groove", strum: "Strum", chop: "Chop", tpl: "Template", gMpc: "MPC", gShuffle: "Shuffle", gFunk: "Funk 16", gHouse: "House", gPush: "Push", gLaid: "Laid back", gMine: "Mine", capture: "Capture from selection", captured: "Groove of {n} notes on {grid}", noCustom: "Nothing captured yet", mineHint: "Select notes that already have the feel you want and press Capture; then select other notes and apply it.", grvHint: "Quantize pulls the notes to the straight grid first; Timing and Velocity apply the template’s push, drag and accents.", sDir: "Direction", sUp: "Low → high", sDown: "High → low", sAlt: "Alternate", sGap: "Spread", fade: "Fade", strHint: "The notes of each chord start one after another, like a strummed guitar. Note ends stay where they were.", cChop: "Chop", cFlam: "Flam", cGlue: "Glue", gate: "Gate", fOff: "Distance", fCount: "Graces", fVel: "Grace vel.", chopHint: "Splits each note into repeats of the grid step, for rolls and stutters.", flamHint: "Adds grace notes just before each note, like a drummer’s flam or ruff.", glueHint: "Joins repeated notes of the same pitch that are this close into one long note.", pLimit: "Fit range", lo: "Lowest", hi: "Highest", limHint: "Notes outside the range move by octaves until they fit.",
      feel5: "Quintuplet", feel7: "Septuplet", feelM: "Mixed", range: "Catch", zone: "Free zone", qHint: "Mixed snaps to the nearer of straight and triplet. Catch: only notes this close get pulled. Free zone: notes this close stay put.", 
      _name: 'English', noNotes: 'Select some MIDI notes in LUNA', noNotesSub: 'Notes in the editor, or a range over MIDI clips on one or more tracks.',
      selNotes: '{n} selected notes', rangeNotes: '{n} notes in the range', clipsOn: '{c} clips · {tracks}', clipOn: '1 clip · {tracks}',
      quantize: 'Quantize', humanize: 'Humanize', velocity: 'Velocity', length: 'Length', pitch: 'Pitch', time: 'Time',
      grid: 'Grid', feel: 'Feel', feelN: 'Straight', feelT: 'Triplet', feelD: 'Dotted', strength: 'Strength', swing: 'Swing', ends: 'Quantize note ends too',
      timing: 'Timing', vel: 'Velocity', len: 'Length', reroll: 'Roll again', humHint: 'Small random changes, like a player would make. Notes of a chord move together.',
      mode: 'Mode', vScale: 'Scale', vFixed: 'Fixed', vRamp: 'Ramp', dyn: 'Dynamics', offset: 'Offset', value: 'Value', from: 'From', to: 'To', curve: 'Curve',
      dynHint: 'Dynamics below 0 squeezes the velocities together, above 0 spreads them apart.', rampHint: 'A crescendo or decrescendo from the first note to the last.',
      lLegato: 'Legato', lFixed: 'Fixed', lScale: 'Scale', gap: 'Gap', legHint: 'Each note lasts until the next one starts. Chords stay chords.',
      pTranspose: 'Transpose', pScale: 'To scale', pInvert: 'Invert', semis: 'Semitones', octaves: 'Octaves', key: 'Key', scale: 'Scale', fromLuna: 'From LUNA', noKeyLuna: 'The session has no key signature: pick the key by hand.',
      dir: 'Notes outside the scale', dNear: 'Nearest', dUp: 'Up', dDown: 'Down', pivot: 'Mirror around', pivLow: 'Lowest', pivMid: 'Centre', pivHigh: 'Highest', keepScale: 'Keep the result in the scale',
      major: 'Major', minor: 'Minor', harmonic: 'Harmonic minor', dorian: 'Dorian', mixolydian: 'Mixolydian', pentaMaj: 'Major pentatonic', pentaMin: 'Minor pentatonic', blues: 'Blues',
      tReverse: 'Reverse', tDouble: 'Double speed', tHalf: 'Half speed', tShift: 'Shift', steps: 'Steps',
      revHint: 'Plays the notes backwards, last one first.', dblHint: 'Twice as fast: everything in half the time, from the first note.', halfHint: 'Half as fast: everything takes twice as long, from the first note. The clip grows if there is room.',
      before: 'Before', after: 'After', previewOf: 'Preview',
      apply: 'Apply', reset: 'Reset', undo: 'Undo',
      applied: '{name}: {n} notes changed', nothing: 'Nothing changes with these settings', undone: 'Undone', failed: 'Error: {e}', working: 'Working…',
      waiting: 'Waiting for LUNA…', noSession: 'Open a session in LUNA.', report: 'Report copied', grew: '{name}: {n} notes changed · the clip grew to fit them', clamped: '{name}: {n} notes changed · some notes were kept inside the clip',
      dark: 'Dark', grey: 'Grey', color: 'Colour', cYellow: 'Yellow', cOrange: 'Orange', cRed: 'Red', cGreen: 'Green', cBlue: 'Blue', cPink: 'Pink', cPurple: 'Purple',
    },
    es: {
      groove: "Groove", strum: "Rasgueo", chop: "Trocear", tpl: "Plantilla", gMpc: "MPC", gShuffle: "Shuffle", gFunk: "Funk 16", gHouse: "House", gPush: "Empuje", gLaid: "Relajado", gMine: "La mía", capture: "Capturar de la selección", captured: "Groove de {n} notas en {grid}", noCustom: "Aún no has capturado nada", mineHint: "Selecciona notas que ya tengan el feel que quieres y pulsa Capturar; luego selecciona otras notas y aplícalo.", grvHint: "Cuantizar lleva primero las notas a la rejilla recta; Tiempo y Velocidad aplican los adelantos, retrasos y acentos de la plantilla.", sDir: "Dirección", sUp: "Ascendente", sDown: "Descendente", sAlt: "Alterno", sGap: "Separación", fade: "Caída", strHint: "Ascendente: de la más grave a la más aguda. Las notas de cada acorde empiezan una tras otra, como una guitarra rasgueada. El final de las notas no se mueve.", cChop: "Trocear", cFlam: "Flam", cGlue: "Unir", gate: "Gate", fOff: "Distancia", fCount: "Adornos", fVel: "Vel. adorno", chopHint: "Parte cada nota en repeticiones del paso de la rejilla, para redobles y stutters.", flamHint: "Añade notas de adorno justo antes de cada nota, como el flam o el ruff de un batería.", glueHint: "Une en una sola nota larga las notas repetidas de la misma altura que estén así de cerca.", pLimit: "Ajustar rango", lo: "Más grave", hi: "Más aguda", limHint: "Las notas fuera del rango se mueven por octavas hasta que caben.",
      feel5: "Quintillo", feel7: "Septillo", feelM: "Mixto", range: "Alcance", zone: "Margen", qHint: "Mixto va a la más cercana entre normal y tresillo. Alcance: solo se mueven las notas así de cerca. Margen: las que ya están así de cerca no se tocan.", 
      _name: 'Español', noNotes: 'Selecciona notas MIDI en LUNA', noNotesSub: 'Notas en el editor, o un rango sobre clips MIDI de una o varias pistas.',
      selNotes: '{n} notas seleccionadas', rangeNotes: '{n} notas en el rango', clipsOn: '{c} clips · {tracks}', clipOn: '1 clip · {tracks}',
      quantize: 'Cuantizar', humanize: 'Humanizar', velocity: 'Velocidad', length: 'Duración', pitch: 'Altura', time: 'Tiempo',
      grid: 'Rejilla', feel: 'Figura', feelN: 'Normal', feelT: 'Tresillo', feelD: 'Puntillo', strength: 'Intensidad', swing: 'Swing', ends: 'Cuantizar también el final de las notas',
      timing: 'Tiempo', vel: 'Velocidad', len: 'Duración', reroll: 'Otra tirada', humHint: 'Pequeños cambios al azar, como los haría un músico. Las notas de un acorde se mueven juntas.',
      mode: 'Modo', vScale: 'Escalar', vFixed: 'Fija', vRamp: 'Rampa', dyn: 'Dinámica', offset: 'Desplazar', value: 'Valor', from: 'Desde', to: 'Hasta', curve: 'Curva',
      dynHint: 'Dinámica por debajo de 0 junta las velocidades; por encima de 0 las separa.', rampHint: 'Un crescendo o decrescendo de la primera nota a la última.',
      lLegato: 'Legato', lFixed: 'Fija', lScale: 'Escalar', gap: 'Hueco', legHint: 'Cada nota dura hasta que empieza la siguiente. Los acordes siguen siendo acordes.',
      pTranspose: 'Transponer', pScale: 'A escala', pInvert: 'Invertir', semis: 'Semitonos', octaves: 'Octavas', key: 'Tono', scale: 'Escala', fromLuna: 'De LUNA', noKeyLuna: 'La sesión no tiene armadura: elige el tono a mano.',
      dir: 'Notas fuera de la escala', dNear: 'Más cercana', dUp: 'Arriba', dDown: 'Abajo', pivot: 'Espejo sobre', pivLow: 'La más grave', pivMid: 'El centro', pivHigh: 'La más aguda', keepScale: 'Mantener el resultado en la escala',
      major: 'Mayor', minor: 'Menor', harmonic: 'Menor armónica', dorian: 'Dórica', mixolydian: 'Mixolidia', pentaMaj: 'Pentatónica mayor', pentaMin: 'Pentatónica menor', blues: 'Blues',
      tReverse: 'Al revés', tDouble: 'Doble velocidad', tHalf: 'Mitad de velocidad', tShift: 'Desplazar', steps: 'Pasos',
      revHint: 'Las notas suenan del revés, la última primero.', dblHint: 'Al doble de velocidad: todo ocurre en la mitad de tiempo, a partir de la primera nota.', halfHint: 'A mitad de velocidad: todo dura el doble, a partir de la primera nota. Si hace falta, el clip crece cuando hay sitio.',
      before: 'Antes', after: 'Después', previewOf: 'Vista previa',
      apply: 'Aplicar', reset: 'Restablecer', undo: 'Deshacer',
      applied: '{name}: {n} notas cambiadas', nothing: 'Con estos ajustes no cambia nada', undone: 'Deshecho', failed: 'Error: {e}', working: 'Trabajando…',
      waiting: 'Esperando a LUNA…', noSession: 'Abre una sesión en LUNA.', report: 'Informe copiado', grew: '{name}: {n} notas cambiadas · el clip ha crecido para que quepan', clamped: '{name}: {n} notas cambiadas · algunas notas se han quedado dentro del clip',
      dark: 'Oscuro', grey: 'Gris', color: 'Color', cYellow: 'Amarillo', cOrange: 'Naranja', cRed: 'Rojo', cGreen: 'Verde', cBlue: 'Azul', cPink: 'Rosa', cPurple: 'Morado',
    },
  };
  Object.assign(I18N, {"ca": { "groove": "Groove", "strum": "Rasguejat", "chop": "Trossejar", "tpl": "Plantilla", "gMpc": "MPC", "gShuffle": "Shuffle", "gFunk": "Funk 16", "gHouse": "House", "gPush": "Empenta", "gLaid": "Relaxat", "gMine": "La meva", "capture": "Capturar de la selecció", "captured": "Groove de {n} notes a {grid}", "noCustom": "Encara no has capturat res", "mineHint": "Selecciona notes que ja tinguin el feel que vols i prem Capturar; després selecciona altres notes i aplica’l.", "grvHint": "Quantitzar porta primer les notes a la graella recta; Temps i Velocitat apliquen els avançaments, retards i accents de la plantilla.", "sDir": "Direcció", "sUp": "Greu → agut", "sDown": "Agut → greu", "sAlt": "Altern", "sGap": "Separació", "fade": "Caiguda", "strHint": "Les notes de cada acord comencen una darrere l’altra, com una guitarra rasguejada. El final de les notes no es mou.", "cChop": "Trossejar", "cFlam": "Flam", "cGlue": "Unir", "gate": "Gate", "fOff": "Distància", "fCount": "Adorns", "fVel": "Vel. adorn", "chopHint": "Parteix cada nota en repeticions del pas de la graella, per a redobles i stutters.", "flamHint": "Afegeix notes d’adorn just abans de cada nota, com el flam o el ruff d’un bateria.", "glueHint": "Uneix en una sola nota llarga les notes repetides de la mateixa altura que siguin així de prop.", "pLimit": "Ajustar rang", "lo": "Més greu", "hi": "Més aguda", "limHint": "Les notes fora del rang es mouen per octaves fins que hi caben.",feel5: "Quintet", feel7: "Septet", feelM: "Mixt", range: "Abast", zone: "Marge", qHint: "Mixt va a la més propera entre normal i treset. Abast: només es mouen les notes així de prop. Marge: les que ja són així de prop no es toquen.", "_name": "Català", "noNotes": "Selecciona notes MIDI a LUNA", "noNotesSub": "Notes a l’editor, o un rang sobre clips MIDI d’una o diverses pistes.", "selNotes": "{n} notes seleccionades", "rangeNotes": "{n} notes al rang", "clipsOn": "{c} clips · {tracks}", "clipOn": "1 clip · {tracks}", "quantize": "Quantitzar", "humanize": "Humanitzar", "velocity": "Velocitat", "length": "Durada", "pitch": "Altura", "time": "Temps", "grid": "Graella", "feel": "Figura", "feelN": "Normal", "feelT": "Treset", "feelD": "Amb punt", "strength": "Intensitat", "swing": "Swing", "ends": "Quantitzar també el final de les notes", "timing": "Temps", "vel": "Velocitat", "len": "Durada", "reroll": "Una altra tirada", "humHint": "Petits canvis a l’atzar, com els faria un músic. Les notes d’un acord es mouen juntes.", "mode": "Mode", "vScale": "Escalar", "vFixed": "Fixa", "vRamp": "Rampa", "dyn": "Dinàmica", "offset": "Desplaçar", "value": "Valor", "from": "Des de", "to": "Fins a", "curve": "Corba", "dynHint": "Dinàmica per sota de 0 ajunta les velocitats; per sobre de 0 les separa.", "rampHint": "Un crescendo o decrescendo de la primera nota a l’última.", "lLegato": "Legato", "lFixed": "Fixa", "lScale": "Escalar", "gap": "Espai", "legHint": "Cada nota dura fins que comença la següent. Els acords continuen sent acords.", "pTranspose": "Transposar", "pScale": "A escala", "pInvert": "Invertir", "semis": "Semitons", "octaves": "Octaves", "key": "To", "scale": "Escala", "fromLuna": "De LUNA", "noKeyLuna": "La sessió no té armadura: tria el to a mà.", "dir": "Notes fora de l’escala", "dNear": "Més propera", "dUp": "Amunt", "dDown": "Avall", "pivot": "Mirall sobre", "pivLow": "La més greu", "pivMid": "El centre", "pivHigh": "La més aguda", "keepScale": "Mantenir el resultat a l’escala", "major": "Major", "minor": "Menor", "harmonic": "Menor harmònica", "dorian": "Dòrica", "mixolydian": "Mixolídia", "pentaMaj": "Pentatònica major", "pentaMin": "Pentatònica menor", "blues": "Blues", "tReverse": "Al revés", "tDouble": "Doble velocitat", "tHalf": "Meitat de velocitat", "tShift": "Desplaçar", "steps": "Passos", "revHint": "Les notes sonen al revés, l’última primer.", "dblHint": "Al doble de velocitat: tot passa en la meitat de temps, a partir de la primera nota.", "halfHint": "A la meitat de velocitat: tot dura el doble, a partir de la primera nota. Si cal, el clip creix quan hi ha lloc.", "before": "Abans", "after": "Després", "previewOf": "Previsualització", "apply": "Aplicar", "reset": "Restablir", "undo": "Desfer", "applied": "{name}: {n} notes canviades", "nothing": "Amb aquests ajustos no canvia res", "undone": "Desfet", "failed": "Error: {e}", "working": "Treballant…", "waiting": "Esperant LUNA…", "noSession": "Obre una sessió a LUNA.", "report": "Informe copiat", "grew": "{name}: {n} notes canviades · el clip ha crescut perquè hi càpiguen", "clamped": "{name}: {n} notes canviades · algunes notes s’han quedat dins del clip", "dark": "Fosc", "grey": "Gris", "color": "Color", "cYellow": "Groc", "cOrange": "Taronja", "cRed": "Vermell", "cGreen": "Verd", "cBlue": "Blau", "cPink": "Rosa", "cPurple": "Lila"},
    "fr": { "groove": "Groove", "strum": "Strum", "chop": "Découper", "tpl": "Modèle", "gMpc": "MPC", "gShuffle": "Shuffle", "gFunk": "Funk 16", "gHouse": "House", "gPush": "En avant", "gLaid": "En arrière", "gMine": "Le mien", "capture": "Capturer la sélection", "captured": "Groove de {n} notes en {grid}", "noCustom": "Rien de capturé pour l’instant", "mineHint": "Sélectionnez des notes qui ont déjà le feel voulu et appuyez sur Capturer ; puis sélectionnez d’autres notes et appliquez-le.", "grvHint": "Quantifier ramène d’abord les notes sur la grille droite ; Timing et Vélocité appliquent les avances, retards et accents du modèle.", "sDir": "Sens", "sUp": "Grave → aigu", "sDown": "Aigu → grave", "sAlt": "Alterné", "sGap": "Écart", "fade": "Fondu", "strHint": "Les notes de chaque accord démarrent l’une après l’autre, comme une guitare grattée. La fin des notes ne bouge pas.", "cChop": "Découper", "cFlam": "Fla", "cGlue": "Coller", "gate": "Gate", "fOff": "Distance", "fCount": "Appogg.", "fVel": "Vél. appogg.", "chopHint": "Découpe chaque note en répétitions du pas de la grille, pour des roulements et des stutters.", "flamHint": "Ajoute des appoggiatures juste avant chaque note, comme le fla ou le ra d’un batteur.", "glueHint": "Réunit en une seule note longue les notes répétées de même hauteur aussi proches.", "pLimit": "Tessiture", "lo": "Plus grave", "hi": "Plus aiguë", "limHint": "Les notes hors de la tessiture se déplacent par octaves jusqu’à y entrer.",feel5: "Quintolet", feel7: "Septolet", feelM: "Mixte", range: "Portée", zone: "Marge", qHint: "Mixte va au plus proche entre normal et triolet. Portée : seules les notes aussi proches bougent. Marge : celles déjà aussi proches restent en place.", "_name": "Français", "noNotes": "Sélectionnez des notes MIDI dans LUNA", "noNotesSub": "Des notes dans l’éditeur, ou une zone sur des clips MIDI d’une ou plusieurs pistes.", "selNotes": "{n} notes sélectionnées", "rangeNotes": "{n} notes dans la zone", "clipsOn": "{c} clips · {tracks}", "clipOn": "1 clip · {tracks}", "quantize": "Quantifier", "humanize": "Humaniser", "velocity": "Vélocité", "length": "Durée", "pitch": "Hauteur", "time": "Temps", "grid": "Grille", "feel": "Figure", "feelN": "Normal", "feelT": "Triolet", "feelD": "Pointé", "strength": "Intensité", "swing": "Swing", "ends": "Quantifier aussi la fin des notes", "timing": "Timing", "vel": "Vélocité", "len": "Durée", "reroll": "Relancer", "humHint": "De petits écarts au hasard, comme ceux d’un musicien. Les notes d’un accord bougent ensemble.", "mode": "Mode", "vScale": "Échelle", "vFixed": "Fixe", "vRamp": "Rampe", "dyn": "Dynamique", "offset": "Décalage", "value": "Valeur", "from": "De", "to": "À", "curve": "Courbe", "dynHint": "Une dynamique sous 0 resserre les vélocités ; au-dessus de 0 elle les écarte.", "rampHint": "Un crescendo ou decrescendo de la première note à la dernière.", "lLegato": "Legato", "lFixed": "Fixe", "lScale": "Échelle", "gap": "Écart", "legHint": "Chaque note dure jusqu’au début de la suivante. Les accords restent des accords.", "pTranspose": "Transposer", "pScale": "Vers la gamme", "pInvert": "Inverser", "semis": "Demi-tons", "octaves": "Octaves", "key": "Tonalité", "scale": "Gamme", "fromLuna": "De LUNA", "noKeyLuna": "La session n’a pas d’armure : choisissez la tonalité à la main.", "dir": "Notes hors gamme", "dNear": "Plus proche", "dUp": "Vers le haut", "dDown": "Vers le bas", "pivot": "Miroir autour de", "pivLow": "La plus grave", "pivMid": "Le centre", "pivHigh": "La plus aiguë", "keepScale": "Garder le résultat dans la gamme", "major": "Majeur", "minor": "Mineur", "harmonic": "Mineur harmonique", "dorian": "Dorien", "mixolydian": "Mixolydien", "pentaMaj": "Pentatonique majeure", "pentaMin": "Pentatonique mineure", "blues": "Blues", "tReverse": "À l’envers", "tDouble": "Vitesse double", "tHalf": "Demi-vitesse", "tShift": "Décaler", "steps": "Pas", "revHint": "Les notes jouent à l’envers, la dernière en premier.", "dblHint": "Deux fois plus vite : tout en deux fois moins de temps, depuis la première note.", "halfHint": "Deux fois plus lent : tout dure le double, depuis la première note. Le clip s’agrandit s’il y a la place.", "before": "Avant", "after": "Après", "previewOf": "Aperçu", "apply": "Appliquer", "reset": "Réinitialiser", "undo": "Annuler", "applied": "{name} : {n} notes modifiées", "nothing": "Ces réglages ne changent rien", "undone": "Annulé", "failed": "Erreur : {e}", "working": "Traitement…", "waiting": "En attente de LUNA…", "noSession": "Ouvrez une session dans LUNA.", "report": "Rapport copié", "grew": "{name} : {n} notes modifiées · le clip s’est agrandi pour les contenir", "clamped": "{name} : {n} notes modifiées · certaines notes sont restées dans le clip", "dark": "Sombre", "grey": "Gris", "color": "Couleur", "cYellow": "Jaune", "cOrange": "Orange", "cRed": "Rouge", "cGreen": "Vert", "cBlue": "Bleu", "cPink": "Rose", "cPurple": "Violet"},
    "de": { "groove": "Groove", "strum": "Strum", "chop": "Zerhacken", "tpl": "Vorlage", "gMpc": "MPC", "gShuffle": "Shuffle", "gFunk": "Funk 16", "gHouse": "House", "gPush": "Treibend", "gLaid": "Laid back", "gMine": "Eigener", "capture": "Aus Auswahl übernehmen", "captured": "Groove aus {n} Noten auf {grid}", "noCustom": "Noch nichts übernommen", "mineHint": "Wähle Noten, die schon das gewünschte Feel haben, und drücke Übernehmen; dann andere Noten wählen und anwenden.", "grvHint": "Quantisieren zieht die Noten zuerst aufs gerade Raster; Timing und Velocity übertragen Vorzieher, Verzögerungen und Akzente der Vorlage.", "sDir": "Richtung", "sUp": "Tief → hoch", "sDown": "Hoch → tief", "sAlt": "Abwechselnd", "sGap": "Abstand", "fade": "Verlauf", "strHint": "Die Noten jedes Akkords setzen nacheinander ein, wie eine geschlagene Gitarre. Die Notenenden bleiben, wo sie sind.", "cChop": "Zerhacken", "cFlam": "Flam", "cGlue": "Verbinden", "gate": "Gate", "fOff": "Abstand", "fCount": "Vorschläge", "fVel": "Anschlag", "chopHint": "Teilt jede Note in Wiederholungen des Rasterschritts, für Wirbel und Stutter.", "flamHint": "Setzt Vorschlagnoten kurz vor jede Note, wie ein Flam oder Ruff am Schlagzeug.", "glueHint": "Verbindet wiederholte Noten gleicher Tonhöhe, die so nah beieinander liegen, zu einer langen Note.", "pLimit": "Bereich", "lo": "Tiefste", "hi": "Höchste", "limHint": "Noten außerhalb des Bereichs werden oktavweise verschoben, bis sie passen.",feel5: "Quintole", feel7: "Septole", feelM: "Gemischt", range: "Fangbereich", zone: "Freizone", qHint: "Gemischt nimmt das nähere von gerade und Triole. Fangbereich: nur so nahe Noten werden gezogen. Freizone: so nahe Noten bleiben, wo sie sind.", "_name": "Deutsch", "noNotes": "Wähle MIDI-Noten in LUNA aus", "noNotesSub": "Noten im Editor oder einen Bereich über MIDI-Clips auf einer oder mehreren Spuren.", "selNotes": "{n} ausgewählte Noten", "rangeNotes": "{n} Noten im Bereich", "clipsOn": "{c} Clips · {tracks}", "clipOn": "1 Clip · {tracks}", "quantize": "Quantisieren", "humanize": "Humanisieren", "velocity": "Velocity", "length": "Länge", "pitch": "Tonhöhe", "time": "Zeit", "grid": "Raster", "feel": "Feel", "feelN": "Gerade", "feelT": "Triole", "feelD": "Punktiert", "strength": "Stärke", "swing": "Swing", "ends": "Auch Notenenden quantisieren", "timing": "Timing", "vel": "Velocity", "len": "Länge", "reroll": "Neu würfeln", "humHint": "Kleine zufällige Abweichungen wie von einem Musiker. Akkordnoten bewegen sich zusammen.", "mode": "Modus", "vScale": "Skalieren", "vFixed": "Fest", "vRamp": "Rampe", "dyn": "Dynamik", "offset": "Versatz", "value": "Wert", "from": "Von", "to": "Bis", "curve": "Kurve", "dynHint": "Dynamik unter 0 rückt die Velocitys zusammen, über 0 zieht sie auseinander.", "rampHint": "Ein Crescendo oder Decrescendo von der ersten bis zur letzten Note.", "lLegato": "Legato", "lFixed": "Fest", "lScale": "Skalieren", "gap": "Lücke", "legHint": "Jede Note klingt, bis die nächste beginnt. Akkorde bleiben Akkorde.", "pTranspose": "Transponieren", "pScale": "Auf Skala", "pInvert": "Umkehren", "semis": "Halbtöne", "octaves": "Oktaven", "key": "Tonart", "scale": "Skala", "fromLuna": "Aus LUNA", "noKeyLuna": "Die Session hat keine Tonart: wähle sie von Hand.", "dir": "Noten außerhalb der Skala", "dNear": "Zur nächsten", "dUp": "Nach oben", "dDown": "Nach unten", "pivot": "Spiegeln um", "pivLow": "Die tiefste", "pivMid": "Die Mitte", "pivHigh": "Die höchste", "keepScale": "Ergebnis in der Skala halten", "major": "Dur", "minor": "Moll", "harmonic": "Harmonisch Moll", "dorian": "Dorisch", "mixolydian": "Mixolydisch", "pentaMaj": "Dur-Pentatonik", "pentaMin": "Moll-Pentatonik", "blues": "Blues", "tReverse": "Rückwärts", "tDouble": "Doppeltes Tempo", "tHalf": "Halbes Tempo", "tShift": "Verschieben", "steps": "Schritte", "revHint": "Die Noten spielen rückwärts, die letzte zuerst.", "dblHint": "Doppelt so schnell: alles in der halben Zeit, ab der ersten Note.", "halfHint": "Halb so schnell: alles dauert doppelt so lang, ab der ersten Note. Der Clip wächst, wenn Platz ist.", "before": "Vorher", "after": "Nachher", "previewOf": "Vorschau", "apply": "Anwenden", "reset": "Zurücksetzen", "undo": "Rückgängig", "applied": "{name}: {n} Noten geändert", "nothing": "Mit diesen Einstellungen ändert sich nichts", "undone": "Rückgängig gemacht", "failed": "Fehler: {e}", "working": "Arbeite…", "waiting": "Warte auf LUNA…", "noSession": "Öffne eine Session in LUNA.", "report": "Bericht kopiert", "grew": "{name}: {n} Noten geändert · der Clip wurde verlängert", "clamped": "{name}: {n} Noten geändert · einige Noten blieben im Clip", "dark": "Dunkel", "grey": "Grau", "color": "Farbe", "cYellow": "Gelb", "cOrange": "Orange", "cRed": "Rot", "cGreen": "Grün", "cBlue": "Blau", "cPink": "Pink", "cPurple": "Lila"},
    "it": { "groove": "Groove", "strum": "Strum", "chop": "Spezza", "tpl": "Modello", "gMpc": "MPC", "gShuffle": "Shuffle", "gFunk": "Funk 16", "gHouse": "House", "gPush": "In avanti", "gLaid": "Rilassato", "gMine": "Il mio", "capture": "Cattura dalla selezione", "captured": "Groove di {n} note su {grid}", "noCustom": "Ancora nulla catturato", "mineHint": "Seleziona note che hanno già il feel che vuoi e premi Cattura; poi seleziona altre note e applicalo.", "grvHint": "Quantizza porta prima le note sulla griglia dritta; Tempo e Velocity applicano anticipi, ritardi e accenti del modello.", "sDir": "Direzione", "sUp": "Grave → acuto", "sDown": "Acuto → grave", "sAlt": "Alternato", "sGap": "Distanza", "fade": "Sfumatura", "strHint": "Le note di ogni accordo partono una dopo l’altra, come una chitarra strimpellata. La fine delle note non si sposta.", "cChop": "Spezza", "cFlam": "Flam", "cGlue": "Unisci", "gate": "Gate", "fOff": "Distanza", "fCount": "Abbellim.", "fVel": "Vel. abbell.", "chopHint": "Divide ogni nota in ripetizioni del passo della griglia, per rulli e stutter.", "flamHint": "Aggiunge abbellimenti subito prima di ogni nota, come il flam o il ruff di un batterista.", "glueHint": "Unisce in un’unica nota lunga le note ripetute della stessa altezza così vicine.", "pLimit": "Estensione", "lo": "Più grave", "hi": "Più acuta", "limHint": "Le note fuori dall’estensione si spostano di ottave finché ci rientrano.",feel5: "Quintina", feel7: "Settimina", feelM: "Misto", range: "Portata", zone: "Margine", qHint: "Misto va alla più vicina tra normale e terzina. Portata: si muovono solo le note così vicine. Margine: quelle già così vicine restano ferme.", "_name": "Italiano", "noNotes": "Seleziona delle note MIDI in LUNA", "noNotesSub": "Note nell’editor, o un intervallo su clip MIDI di una o più tracce.", "selNotes": "{n} note selezionate", "rangeNotes": "{n} note nell’intervallo", "clipsOn": "{c} clip · {tracks}", "clipOn": "1 clip · {tracks}", "quantize": "Quantizza", "humanize": "Umanizza", "velocity": "Velocity", "length": "Durata", "pitch": "Altezza", "time": "Tempo", "grid": "Griglia", "feel": "Figura", "feelN": "Normale", "feelT": "Terzina", "feelD": "Puntato", "strength": "Intensità", "swing": "Swing", "ends": "Quantizza anche la fine delle note", "timing": "Timing", "vel": "Velocity", "len": "Durata", "reroll": "Altro tiro", "humHint": "Piccole variazioni casuali, come quelle di un musicista. Le note di un accordo si muovono insieme.", "mode": "Modo", "vScale": "Scala", "vFixed": "Fissa", "vRamp": "Rampa", "dyn": "Dinamica", "offset": "Spostamento", "value": "Valore", "from": "Da", "to": "A", "curve": "Curva", "dynHint": "Dinamica sotto 0 avvicina le velocity; sopra 0 le allontana.", "rampHint": "Un crescendo o diminuendo dalla prima nota all’ultima.", "lLegato": "Legato", "lFixed": "Fissa", "lScale": "Scala", "gap": "Spazio", "legHint": "Ogni nota dura finché inizia la successiva. Gli accordi restano accordi.", "pTranspose": "Trasponi", "pScale": "In scala", "pInvert": "Inverti", "semis": "Semitoni", "octaves": "Ottave", "key": "Tonalità", "scale": "Scala", "fromLuna": "Da LUNA", "noKeyLuna": "La sessione non ha armatura: scegli la tonalità a mano.", "dir": "Note fuori scala", "dNear": "Alla più vicina", "dUp": "Su", "dDown": "Giù", "pivot": "Specchio su", "pivLow": "La più grave", "pivMid": "Il centro", "pivHigh": "La più acuta", "keepScale": "Mantieni il risultato in scala", "major": "Maggiore", "minor": "Minore", "harmonic": "Minore armonica", "dorian": "Dorica", "mixolydian": "Misolidia", "pentaMaj": "Pentatonica maggiore", "pentaMin": "Pentatonica minore", "blues": "Blues", "tReverse": "Al contrario", "tDouble": "Doppia velocità", "tHalf": "Metà velocità", "tShift": "Sposta", "steps": "Passi", "revHint": "Le note suonano al contrario, l’ultima per prima.", "dblHint": "Il doppio più veloce: tutto in metà tempo, dalla prima nota.", "halfHint": "La metà più lento: tutto dura il doppio, dalla prima nota. La clip cresce se c’è spazio.", "before": "Prima", "after": "Dopo", "previewOf": "Anteprima", "apply": "Applica", "reset": "Ripristina", "undo": "Annulla", "applied": "{name}: {n} note modificate", "nothing": "Con queste impostazioni non cambia nulla", "undone": "Annullato", "failed": "Errore: {e}", "working": "Elaborazione…", "waiting": "In attesa di LUNA…", "noSession": "Apri una sessione in LUNA.", "report": "Rapporto copiato", "grew": "{name}: {n} note modificate · la clip è cresciuta per contenerle", "clamped": "{name}: {n} note modificate · alcune note sono rimaste dentro la clip", "dark": "Scuro", "grey": "Grigio", "color": "Colore", "cYellow": "Giallo", "cOrange": "Arancione", "cRed": "Rosso", "cGreen": "Verde", "cBlue": "Blu", "cPink": "Rosa", "cPurple": "Viola"},
    "pt": { "groove": "Groove", "strum": "Rasgueado", "chop": "Picar", "tpl": "Modelo", "gMpc": "MPC", "gShuffle": "Shuffle", "gFunk": "Funk 16", "gHouse": "House", "gPush": "Adiantado", "gLaid": "Relaxado", "gMine": "O meu", "capture": "Capturar da seleção", "captured": "Groove de {n} notas em {grid}", "noCustom": "Ainda não capturaste nada", "mineHint": "Seleciona notas que já tenham o feel que queres e carrega em Capturar; depois seleciona outras notas e aplica-o.", "grvHint": "Quantizar leva primeiro as notas para a grelha direita; Tempo e Velocidade aplicam os adiantamentos, atrasos e acentos do modelo.", "sDir": "Direção", "sUp": "Ascendente", "sDown": "Descendente", "sAlt": "Alternado", "sGap": "Separação", "fade": "Queda", "strHint": "Ascendente: da mais grave para a mais aguda. As notas de cada acorde começam uma depois da outra, como uma guitarra rasgueada. O fim das notas não se mexe.", "cChop": "Picar", "cFlam": "Flam", "cGlue": "Unir", "gate": "Gate", "fOff": "Distância", "fCount": "Ornamentos", "fVel": "Vel. ornam.", "chopHint": "Divide cada nota em repetições do passo da grelha, para rufos e stutters.", "flamHint": "Acrescenta notas de ornamento mesmo antes de cada nota, como o flam ou o ruff de um baterista.", "glueHint": "Junta numa só nota longa as notas repetidas da mesma altura que estejam assim tão perto.", "pLimit": "Ajustar registo", "lo": "Mais grave", "hi": "Mais aguda", "limHint": "As notas fora do registo movem-se por oitavas até caberem.",feel5: "Quintina", feel7: "Septina", feelM: "Misto", range: "Alcance", zone: "Margem", qHint: "Misto vai para a mais próxima entre normal e tercina. Alcance: só se movem as notas assim tão perto. Margem: as que já estão assim tão perto ficam quietas.", "_name": "Português", "noNotes": "Seleciona notas MIDI no LUNA", "noNotesSub": "Notas no editor, ou um intervalo sobre clips MIDI de uma ou várias faixas.", "selNotes": "{n} notas selecionadas", "rangeNotes": "{n} notas no intervalo", "clipsOn": "{c} clips · {tracks}", "clipOn": "1 clip · {tracks}", "quantize": "Quantizar", "humanize": "Humanizar", "velocity": "Velocidade", "length": "Duração", "pitch": "Altura", "time": "Tempo", "grid": "Grelha", "feel": "Figura", "feelN": "Normal", "feelT": "Tercina", "feelD": "Pontuado", "strength": "Intensidade", "swing": "Swing", "ends": "Quantizar também o fim das notas", "timing": "Tempo", "vel": "Velocidade", "len": "Duração", "reroll": "Outro lançamento", "humHint": "Pequenas mudanças ao acaso, como as de um músico. As notas de um acorde movem-se juntas.", "mode": "Modo", "vScale": "Escalar", "vFixed": "Fixa", "vRamp": "Rampa", "dyn": "Dinâmica", "offset": "Deslocar", "value": "Valor", "from": "De", "to": "Até", "curve": "Curva", "dynHint": "Dinâmica abaixo de 0 junta as velocidades; acima de 0 afasta-as.", "rampHint": "Um crescendo ou decrescendo da primeira nota à última.", "lLegato": "Legato", "lFixed": "Fixa", "lScale": "Escalar", "gap": "Intervalo", "legHint": "Cada nota dura até começar a seguinte. Os acordes continuam acordes.", "pTranspose": "Transpor", "pScale": "Para a escala", "pInvert": "Inverter", "semis": "Meios-tons", "octaves": "Oitavas", "key": "Tom", "scale": "Escala", "fromLuna": "Do LUNA", "noKeyLuna": "A sessão não tem armação: escolhe o tom à mão.", "dir": "Notas fora da escala", "dNear": "Mais próxima", "dUp": "Para cima", "dDown": "Para baixo", "pivot": "Espelho sobre", "pivLow": "A mais grave", "pivMid": "O centro", "pivHigh": "A mais aguda", "keepScale": "Manter o resultado na escala", "major": "Maior", "minor": "Menor", "harmonic": "Menor harmónica", "dorian": "Dórica", "mixolydian": "Mixolídia", "pentaMaj": "Pentatónica maior", "pentaMin": "Pentatónica menor", "blues": "Blues", "tReverse": "Ao contrário", "tDouble": "Velocidade dupla", "tHalf": "Metade da velocidade", "tShift": "Deslocar", "steps": "Passos", "revHint": "As notas tocam ao contrário, a última primeiro.", "dblHint": "O dobro da rapidez: tudo em metade do tempo, a partir da primeira nota.", "halfHint": "Metade da rapidez: tudo dura o dobro, a partir da primeira nota. O clip cresce se houver espaço.", "before": "Antes", "after": "Depois", "previewOf": "Pré-visualização", "apply": "Aplicar", "reset": "Repor", "undo": "Desfazer", "applied": "{name}: {n} notas alteradas", "nothing": "Com estas definições nada muda", "undone": "Desfeito", "failed": "Erro: {e}", "working": "A trabalhar…", "waiting": "À espera do LUNA…", "noSession": "Abre uma sessão no LUNA.", "report": "Relatório copiado", "grew": "{name}: {n} notas alteradas · o clip cresceu para caberem", "clamped": "{name}: {n} notas alteradas · algumas notas ficaram dentro do clip", "dark": "Escuro", "grey": "Cinzento", "color": "Cor", "cYellow": "Amarelo", "cOrange": "Laranja", "cRed": "Vermelho", "cGreen": "Verde", "cBlue": "Azul", "cPink": "Rosa", "cPurple": "Roxo"}});

  let lang = store.get('lang') ?? (() => { for (const l of navigator.languages ?? [navigator.language]) { const c = String(l || '').slice(0, 2).toLowerCase(); if (I18N[c]) return c; } return 'en'; })();
  if (!I18N[lang]) lang = 'en';
  const t = (k, v = {}) => String(I18N[lang][k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (m, x) => (x in v ? String(v[x]) : m));
  const COLORS = ['yellow', 'orange', 'red', 'green', 'blue', 'pink', 'purple'];

  // The guide: its texts, in every language.
  for (const [c, v] of Object.entries({"en": {"help": "Quick guide", "helpBtn": "Guide", "tNext": "Next", "tBack": "Back", "tSkip": "Skip", "tDone": "Got it", "langT": "Choose your language", "langX": "The guide and the whole window will use it. You can change it later here, at the top right.", "zt": "Always at hand", "z": "Open this guide again whenever you need it with the Guide button.", "q1t": "What you transform", "q1": "Select MIDI notes in LUNA: in the editor, or a range over MIDI clips on one or more tracks. Here you see what is selected.", "q2t": "Pick a tool", "q2": "Quantize, Humanize, Velocity, Length, Pitch, Time, Groove, Strum or Chop: one tab each.", "q3t": "Adjust it", "q3": "The settings of the tool you picked. Every change shows at once in the preview, without touching the session.", "q4t": "Before and after", "q4": "Your notes as they are and as they will be, so you can judge it before applying.", "q5t": "Apply", "q5": "Apply (or Enter) writes it to LUNA in one undo step; Undo takes it back. Reset puts this tool’s settings back to default."}, "es": {"help": "Guía rápida", "helpBtn": "Guía", "tNext": "Siguiente", "tBack": "Atrás", "tSkip": "Saltar", "tDone": "Entendido", "langT": "Elige tu idioma", "langX": "La guía y toda la ventana lo usarán. Puedes cambiarlo luego aquí, arriba a la derecha.", "zt": "Siempre a mano", "z": "Vuelve a esta guía cuando la necesites con el botón Guía.", "q1t": "Qué vas a transformar", "q1": "Selecciona notas MIDI en LUNA: en el editor, o un rango sobre clips MIDI de una o varias pistas. Aquí ves lo que hay seleccionado.", "q2t": "Elige una herramienta", "q2": "Cuantizar, Humanizar, Velocidad, Duración, Altura, Tiempo, Groove, Rasgueo o Trocear: una pestaña cada una.", "q3t": "Ajústala", "q3": "Los ajustes de la herramienta elegida. Cada cambio se ve al momento en la previsualización, sin tocar la sesión.", "q4t": "Antes y después", "q4": "Tus notas como están y como quedarán, para que lo juzgues antes de aplicar.", "q5t": "Aplica", "q5": "Aplicar (o Enter) lo escribe en LUNA en un solo paso de deshacer; Deshacer lo quita. Restablecer devuelve los ajustes de esta herramienta a los de fábrica."}, "ca": {"help": "Guia ràpida", "helpBtn": "Guia", "tNext": "Següent", "tBack": "Enrere", "tSkip": "Saltar", "tDone": "Entesos", "langT": "Tria el teu idioma", "langX": "La guia i tota la finestra el faran servir. El pots canviar després aquí, a dalt a la dreta.", "zt": "Sempre a mà", "z": "Torna a aquesta guia quan la necessitis amb el botó Guia.", "q1t": "Què transformaràs", "q1": "Selecciona notes MIDI a LUNA: a l’editor, o un rang sobre clips MIDI d’una o diverses pistes. Aquí veus el que hi ha seleccionat.", "q2t": "Tria una eina", "q2": "Quantitzar, Humanitzar, Velocitat, Durada, Altura, Temps, Groove, Rasguejat o Trossejar: una pestanya cadascuna.", "q3t": "Ajusta-la", "q3": "Els ajustos de l’eina triada. Cada canvi es veu a l’instant a la previsualització, sense tocar la sessió.", "q4t": "Abans i després", "q4": "Les teves notes com són i com quedaran, perquè ho jutgis abans d’aplicar.", "q5t": "Aplica", "q5": "Aplicar (o Enter) ho escriu a LUNA en un sol pas de desfer; Desfer ho treu. Restablir torna els ajustos d’aquesta eina als de fàbrica."}, "fr": {"help": "Guide rapide", "helpBtn": "Guide", "tNext": "Suivant", "tBack": "Retour", "tSkip": "Passer", "tDone": "Compris", "langT": "Choisissez votre langue", "langX": "Le guide et toute la fenêtre l’utiliseront. Vous pourrez la changer ici, en haut à droite.", "zt": "Toujours à portée", "z": "Rouvrez ce guide quand vous voulez avec le bouton Guide.", "q1t": "Ce que vous transformez", "q1": "Sélectionnez des notes MIDI dans LUNA : dans l’éditeur, ou une plage sur des clips MIDI d’une ou plusieurs pistes. Ici, vous voyez ce qui est sélectionné.", "q2t": "Choisissez un outil", "q2": "Quantifier, Humaniser, Vélocité, Durée, Hauteur, Temps, Groove, Strum ou Découper : un onglet chacun.", "q3t": "Réglez-le", "q3": "Les réglages de l’outil choisi. Chaque changement apparaît aussitôt dans l’aperçu, sans toucher à la session.", "q4t": "Avant et après", "q4": "Vos notes telles qu’elles sont et telles qu’elles seront, pour juger avant d’appliquer.", "q5t": "Appliquez", "q5": "Appliquer (ou Entrée) l’écrit dans LUNA en une seule étape d’annulation ; Annuler la retire. Réinitialiser remet les réglages de cet outil par défaut."}, "de": {"help": "Kurzanleitung", "helpBtn": "Anleitung", "tNext": "Weiter", "tBack": "Zurück", "tSkip": "Überspringen", "tDone": "Verstanden", "langT": "Wähle deine Sprache", "langX": "Die Anleitung und das ganze Fenster verwenden sie. Du kannst sie später hier oben rechts ändern.", "zt": "Immer zur Hand", "z": "Öffne diese Anleitung jederzeit wieder mit dem Button Anleitung.", "q1t": "Was du bearbeitest", "q1": "Wähle MIDI-Noten in LUNA aus: im Editor oder einen Bereich über MIDI-Clips auf einer oder mehreren Spuren. Hier siehst du, was ausgewählt ist.", "q2t": "Wähle ein Werkzeug", "q2": "Quantisieren, Humanisieren, Velocity, Länge, Tonhöhe, Zeit, Groove, Strum oder Zerhacken: je ein Tab.", "q3t": "Stell es ein", "q3": "Die Einstellungen des gewählten Werkzeugs. Jede Änderung erscheint sofort in der Vorschau, ohne die Session zu verändern.", "q4t": "Vorher und nachher", "q4": "Deine Noten, wie sie sind und wie sie werden, damit du vor dem Anwenden urteilen kannst.", "q5t": "Anwenden", "q5": "Anwenden (oder Enter) schreibt es in einem Rückgängig-Schritt in LUNA; Rückgängig nimmt es zurück. Zurücksetzen stellt die Einstellungen dieses Werkzeugs zurück."}, "it": {"help": "Guida rapida", "helpBtn": "Guida", "tNext": "Avanti", "tBack": "Indietro", "tSkip": "Salta", "tDone": "Capito", "langT": "Scegli la tua lingua", "langX": "La guida e tutta la finestra la useranno. Puoi cambiarla poi qui, in alto a destra.", "zt": "Sempre a portata di mano", "z": "Riapri questa guida quando ti serve con il pulsante Guida.", "q1t": "Cosa trasformi", "q1": "Seleziona delle note MIDI in LUNA: nell’editor, o un intervallo su clip MIDI di una o più tracce. Qui vedi cosa è selezionato.", "q2t": "Scegli uno strumento", "q2": "Quantizza, Umanizza, Velocity, Durata, Altezza, Tempo, Groove, Strum o Spezza: una scheda ciascuno.", "q3t": "Regolalo", "q3": "Le impostazioni dello strumento scelto. Ogni modifica si vede subito nell’anteprima, senza toccare la sessione.", "q4t": "Prima e dopo", "q4": "Le tue note come sono e come saranno, per giudicare prima di applicare.", "q5t": "Applica", "q5": "Applica (o Invio) lo scrive in LUNA in un solo passo di annullamento; Annulla lo toglie. Ripristina riporta le impostazioni di questo strumento a quelle di fabbrica."}, "pt": {"help": "Guia rápido", "helpBtn": "Guia", "tNext": "Seguinte", "tBack": "Voltar", "tSkip": "Saltar", "tDone": "Percebi", "langT": "Escolhe o teu idioma", "langX": "O guia e toda a janela vão usá-lo. Podes mudá-lo depois aqui, em cima à direita.", "zt": "Sempre à mão", "z": "Volta a este guia quando precisares com o botão Guia.", "q1t": "O que vais transformar", "q1": "Seleciona notas MIDI no LUNA: no editor, ou um intervalo sobre clips MIDI de uma ou várias faixas. Aqui vês o que está selecionado.", "q2t": "Escolhe uma ferramenta", "q2": "Quantizar, Humanizar, Velocidade, Duração, Altura, Tempo, Groove, Rasgueado ou Picar: um separador cada uma.", "q3t": "Ajusta-a", "q3": "As definições da ferramenta escolhida. Cada mudança aparece logo na pré-visualização, sem mexer na sessão.", "q4t": "Antes e depois", "q4": "As tuas notas como estão e como vão ficar, para avaliares antes de aplicar.", "q5t": "Aplica", "q5": "Aplicar (ou Enter) escreve-o no LUNA num só passo de desfazer; Desfazer retira-o. Repor volta às definições de fábrica desta ferramenta."}})) Object.assign(I18N[c], v);
  let tour = null;
  let theme = store.get('theme') === 'grey' ? 'grey' : 'dark';
  let color = COLORS.includes(store.get('color')) ? store.get('color') : 'green';
  let statusTimer;
  const say = (key, vars = {}, kind = '', ms = 0) => { clearTimeout(statusTimer); $('status').textContent = key ? t(key, vars) : ''; $('status').className = `status ${kind}`; if (ms) statusTimer = setTimeout(() => say(null), ms); };
  const log = [];
  const note = (what, extra = {}) => { log.push({ t: new Date().toISOString().slice(11, 23), what, ...extra }); if (log.length > 200) log.shift(); };
  const errText = (e) => String(e?.message || e);

  // ---- Settings ---------------------------------------------------------------------------------
  const KINDS = ['quantize', 'groove', 'humanize', 'strum', 'velocity', 'length', 'pitch', 'chop', 'time'];
  const DEFAULTS = {
    quantize: { grid: '1/16', feel: 'n', strength: 100, swing: 0, range: 100, zone: 0, ends: false },
    humanize: { timing: 12, vel: 10, len: 0, seed: 1 },
    velocity: { mode: 'scale', amount: 0, offset: 0, value: 100, from: 40, to: 110, curve: 0 },
    length: { mode: 'legato', gap: 0, grid: '1/16', feel: 'n', pct: 100 },
    pitch: { mode: 'transpose', semis: 0, octaves: 0, key: 0, scale: 'major', dir: 'nearest', pivot: 'mid', keepScale: false, low: 48, high: 72 },
    groove: { grid: '1/16', template: 'mpc', swing: 62, quant: 100, timing: 100, vel: 50, custom: null },
    strum: { dir: 'up', gap: 25, curve: 0, fade: 0 },
    chop: { mode: 'chop', grid: '1/16', feel: 'n', gate: 90, fade: 0, off: 30, count: 1, graceVel: 60, gap: 30 },
    time: { mode: 'reverse', steps: 1, grid: '1/16' },
  };
  const saved = store.get('opts') ?? {};
  const opts = Object.fromEntries(KINDS.map((k) => [k, { ...DEFAULTS[k], ...(saved[k] ?? {}) }]));
  let kind = KINDS.includes(store.get('kind')) ? store.get('kind') : 'quantize';
  const save = () => { store.set('opts', opts); store.set('kind', kind); };
  const ICON = {
    quantize: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 10h14M10 3v14"/>',
    humanize: '<path d="M2 12c2-5 4 3 6-2s3-6 5-1 3 4 5-1"/>',
    velocity: '<path d="M4 17V10M8 17V6M12 17V9M16 17V4"/>',
    length: '<path d="M3 10h14M3 6v8M17 6v8"/>',
    pitch: '<path d="M10 16V4M5 9l5-5 5 5"/>',
    time: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
    groove: '<path d="M2 13h3l2-6 3 9 2-6h6"/>',
    strum: '<path d="M4 15l3-10M9 15l3-10M14 15l3-10"/>',
    chop: '<path d="M3 7h3M8.5 7h3M14 7h3M3 13h14"/>',
  };
  const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const noteName = (p) => `${NOTE_NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`;

  function knob(label, value, min, max, fmt, onSet, def, step = 1) {
    const box = document.createElement('div'); box.className = 'knob';
    box.innerHTML = '<div class="kl"></div><svg viewBox="0 0 40 40"></svg><div class="kv"></div>';
    box.querySelector('.kl').textContent = label;
    const svg = box.querySelector('svg'), kv = box.querySelector('.kv');
    const pt = (deg, r) => { const rad = (deg - 90) * Math.PI / 180; return [20 + r * Math.cos(rad), 20 + r * Math.sin(rad)]; };
    const arc = (from, to) => { const [x1, y1] = pt(from, 15), [x2, y2] = pt(to, 15); return `M${x1.toFixed(2)} ${y1.toFixed(2)}A15 15 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; };
    const zero = min < 0 && max > 0 ? -135 + ((0 - min) / (max - min)) * 270 : -135;
    const paint = () => {
      const frac = (value - min) / (max - min || 1), a = -135 + frac * 270, [px, py] = pt(a, 10);
      const lo = Math.min(zero, a), hi = Math.max(zero, a);
      svg.innerHTML = `<path d="${arc(-135, 135)}" class="ktrack"/>${hi - lo > 0.5 ? `<path d="${arc(lo, hi)}" class="kval"/>` : ''}<line x1="20" y1="20" x2="${px.toFixed(2)}" y2="${py.toFixed(2)}" class="kptr"/>`;
      kv.textContent = fmt(value);
    };
    const set = (v) => { v = Math.max(min, Math.min(max, Math.round(v / step) * step)); if (v === value) return; value = v; paint(); onSet(v); };
    svg.onpointerdown = (ev) => {
      svg.setPointerCapture(ev.pointerId);
      const y0 = ev.clientY, v0 = value, span = max - min;
      svg.onpointermove = (e) => set(v0 + ((y0 - e.clientY) / 160) * span);
      svg.onpointerup = () => { svg.onpointermove = null; svg.onpointerup = null; };
    };
    svg.onwheel = (ev) => { ev.preventDefault(); set(value + (ev.deltaY < 0 ? 1 : -1) * Math.max(step, Math.round((max - min) / 100 / step) * step)); };
    svg.ondblclick = () => set(def);
    paint();
    return box;
  }
  function seg(items, cur, onPick) {
    const box = document.createElement('div'); box.className = 'seg';
    for (const [v, label] of items) {
      const b = Object.assign(document.createElement('button'), { textContent: label });
      b.classList.toggle('on', v === cur);
      b.onclick = () => { onPick(v); paintParams(); };
      box.append(b);
    }
    return box;
  }
  function row(label, ...kids) {
    const r = document.createElement('div'); r.className = 'prow';
    if (label) r.append(Object.assign(document.createElement('label'), { textContent: label }));
    r.append(...kids);
    return r;
  }
  const knobs = (...k) => { const r = document.createElement('div'); r.className = 'knobrow'; r.append(...k); return r; };
  const hint = (k) => Object.assign(document.createElement('div'), { className: 'hint', textContent: t(k) });
  const check = (k, on, onSet) => {
    const l = document.createElement('label'); l.className = 'check';
    l.innerHTML = '<input type="checkbox"><span></span>';
    l.querySelector('input').checked = on;
    l.querySelector('input').onchange = (e) => { onSet(e.target.checked); changed(); };
    l.querySelector('span').textContent = t(k);
    return l;
  };
  const GRIDS = ['1/4', '1/8', '1/16', '1/32'];
  const signed = (v) => (v > 0 ? `+${v}` : String(v));

  let redraw = () => {};
  let readKey = () => false;
  let capture = () => {};
  let relabel = () => {};
  const changed = () => { save(); redraw(); };

  function paintParams() {
    const o = opts[kind];
    const set = (k) => (v) => { o[k] = v; changed(); };
    const box = $('params');
    const kids = [];
    if (kind === 'quantize') {
      kids.push(row(t('grid'), seg(GRIDS.map((g) => [g, g]), o.grid, (v) => { o.grid = v; changed(); })));
      const fs = seg([['n', t('feelN')], ['t', t('feelT')], ['d', t('feelD')], ['5', t('feel5')], ['7', t('feel7')], ['m', t('feelM')]], o.feel, (v) => { o.feel = v; changed(); });
      fs.classList.add('grid3');
      kids.push(row(t('feel'), fs));
      kids.push(knobs(
        knob(t('strength'), o.strength, 0, 100, (v) => `${v}%`, set('strength'), 100),
        ...(o.feel === 'n' || o.feel === 'm' ? [knob(t('swing'), o.swing, 0, 100, (v) => `${v}%`, set('swing'), 0)] : []),
        knob(t('range'), o.range, 0, 100, (v) => `${v}%`, set('range'), 100),
        knob(t('zone'), o.zone, 0, 100, (v) => `${v}%`, set('zone'), 0)));
      kids.push(check('ends', o.ends, (v) => { o.ends = v; }));
      kids.push(hint('qHint'));
    } else if (kind === 'humanize') {
      kids.push(knobs(
        knob(t('timing'), o.timing, 0, 60, (v) => `±${v} ms`, set('timing'), 12),
        knob(t('vel'), o.vel, 0, 40, (v) => `±${v}`, set('vel'), 10),
        knob(t('len'), o.len, 0, 50, (v) => `±${v}%`, set('len'), 0)));
      const b = document.createElement('button'); b.className = 'btn';
      b.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg><span></span>`;
      b.querySelector('span').textContent = t('reroll');
      b.onclick = () => { o.seed = 1 + Math.floor(Math.random() * 99999); changed(); };
      kids.push(row('', b), hint('humHint'));
    } else if (kind === 'velocity') {
      kids.push(row(t('mode'), seg([['scale', t('vScale')], ['fixed', t('vFixed')], ['ramp', t('vRamp')]], o.mode, (v) => { o.mode = v; changed(); })));
      if (o.mode === 'scale') {
        kids.push(knobs(knob(t('dyn'), o.amount, -100, 100, (v) => `${signed(v)}%`, set('amount'), 0), knob(t('offset'), o.offset, -64, 64, signed, set('offset'), 0)), hint('dynHint'));
      } else if (o.mode === 'fixed') {
        kids.push(knobs(knob(t('value'), o.value, 1, 127, String, set('value'), 100)));
      } else {
        kids.push(knobs(knob(t('from'), o.from, 1, 127, String, set('from'), 40), knob(t('to'), o.to, 1, 127, String, set('to'), 110), knob(t('curve'), o.curve, -100, 100, signed, set('curve'), 0)), hint('rampHint'));
      }
    } else if (kind === 'length') {
      kids.push(row(t('mode'), seg([['legato', t('lLegato')], ['fixed', t('lFixed')], ['scale', t('lScale')]], o.mode, (v) => { o.mode = v; changed(); })));
      if (o.mode === 'legato') kids.push(knobs(knob(t('gap'), o.gap, 0, 200, (v) => `${v} ms`, set('gap'), 0, 5)), hint('legHint'));
      else if (o.mode === 'fixed') {
        kids.push(row(t('grid'), seg(['1/2', ...GRIDS].map((g) => [g, g]), o.grid, (v) => { o.grid = v; changed(); })));
        kids.push(row(t('feel'), seg([['n', t('feelN')], ['t', t('feelT')], ['d', t('feelD')]], o.feel, (v) => { o.feel = v; changed(); })));
      } else kids.push(knobs(knob(t('len'), o.pct, 10, 400, (v) => `${v}%`, set('pct'), 100, 5)));
    } else if (kind === 'pitch') {
      const ps = seg([['transpose', t('pTranspose')], ['scale', t('pScale')], ['invert', t('pInvert')], ['limit', t('pLimit')]], o.mode, (v) => { o.mode = v; changed(); });
      ps.classList.add('grid2');
      kids.push(row(t('mode'), ps));
      const keyRow = () => {
        const k = document.createElement('select'); k.replaceChildren(...NOTE_NAMES.map((n, i) => Object.assign(document.createElement('option'), { value: String(i), textContent: n }))); k.value = String(o.key);
        k.onchange = () => { o.key = Number(k.value); changed(); };
        const sc = document.createElement('select'); sc.replaceChildren(...Object.keys(T.SCALES).map((n) => Object.assign(document.createElement('option'), { value: n, textContent: t(n) }))); sc.value = o.scale;
        sc.onchange = () => { o.scale = sc.value; changed(); };
        const lb = Object.assign(document.createElement('button'), { className: 'btn', textContent: t('fromLuna') });
        lb.onclick = () => { if (readKey(false)) paintParams(); };
        const r = document.createElement('div'); r.className = 'row2'; r.append(k, sc, lb);
        return row(`${t('key')} · ${t('scale')}`, r);
      };
      if (o.mode === 'limit') kids.push(knobs(knob(t('lo'), o.low, 0, 127, noteName, set('low'), 48), knob(t('hi'), o.high, 0, 127, noteName, set('high'), 72)), hint('limHint'));
      else if (o.mode === 'transpose') kids.push(knobs(knob(t('semis'), o.semis, -12, 12, signed, set('semis'), 0), knob(t('octaves'), o.octaves, -3, 3, signed, set('octaves'), 0)));
      else if (o.mode === 'scale') {
        kids.push(keyRow());
        kids.push(row(t('dir'), seg([['nearest', t('dNear')], ['up', t('dUp')], ['down', t('dDown')]], o.dir, (v) => { o.dir = v; changed(); })));
      } else {
        kids.push(row(t('pivot'), seg([['low', t('pivLow')], ['mid', t('pivMid')], ['high', t('pivHigh')]], o.pivot, (v) => { o.pivot = v; changed(); })));
        kids.push(check('keepScale', o.keepScale, (v) => { o.keepScale = v; paintParams(); }));
        if (o.keepScale) kids.push(keyRow());
      }
    } else if (kind === 'groove') {
      kids.push(row(t('grid'), seg([['1/8', '1/8'], ['1/16', '1/16']], o.grid, (v) => { o.grid = v; changed(); })));
      const gs = seg([['mpc', t('gMpc')], ['shuffle', t('gShuffle')], ['funk', t('gFunk')], ['house', t('gHouse')], ['push', t('gPush')], ['laid', t('gLaid')], ['mine', t('gMine')]], o.template, (v) => { o.template = v; changed(); });
      gs.classList.add('grid4');
      kids.push(row(t('tpl'), gs));
      kids.push(knobs(
        ...(o.template === 'mpc' ? [knob(t('swing'), o.swing, 50, 75, (v) => `${v}%`, set('swing'), 62)] : []),
        knob(t('quantize'), o.quant, 0, 100, (v) => `${v}%`, set('quant'), 100),
        knob(t('timing'), o.timing, 0, 150, (v) => `${v}%`, set('timing'), 100),
        knob(t('vel'), o.vel, 0, 150, (v) => `${v}%`, set('vel'), 50)));
      if (o.template === 'mine') {
        const b = Object.assign(document.createElement('button'), { className: 'btn', textContent: t('capture') });
        b.onclick = () => { if (capture()) paintParams(); };
        const info = Object.assign(document.createElement('span'), { className: 'cap', textContent: o.custom ? t('captured', { n: o.custom.notes, grid: o.custom.grid }) : t('noCustom') });
        kids.push(row('', b, info));
      }
      kids.push(hint(o.template === 'mine' ? 'mineHint' : 'grvHint'));
    } else if (kind === 'strum') {
      kids.push(row(t('sDir'), seg([['up', t('sUp')], ['down', t('sDown')], ['alt', t('sAlt')]], o.dir, (v) => { o.dir = v; changed(); })));
      kids.push(knobs(
        knob(t('sGap'), o.gap, 0, 120, (v) => `${v} ms`, set('gap'), 25),
        knob(t('curve'), o.curve, -100, 100, signed, set('curve'), 0),
        knob(t('fade'), o.fade, -50, 50, (v) => `${signed(v)}%`, set('fade'), 0)));
      kids.push(hint('strHint'));
    } else if (kind === 'chop') {
      kids.push(row(t('mode'), seg([['chop', t('cChop')], ['flam', t('cFlam')], ['glue', t('cGlue')]], o.mode, (v) => { o.mode = v; changed(); })));
      if (o.mode === 'chop') {
        kids.push(row(t('grid'), seg(GRIDS.map((g) => [g, g]), o.grid, (v) => { o.grid = v; changed(); })));
        kids.push(row(t('feel'), seg([['n', t('feelN')], ['t', t('feelT')]], o.feel, (v) => { o.feel = v; changed(); })));
        kids.push(knobs(knob(t('gate'), o.gate, 10, 100, (v) => `${v}%`, set('gate'), 90, 5), knob(t('fade'), o.fade, -50, 50, (v) => `${signed(v)}%`, set('fade'), 0)), hint('chopHint'));
      } else if (o.mode === 'flam') {
        kids.push(knobs(
          knob(t('fOff'), o.off, 5, 120, (v) => `${v} ms`, set('off'), 30),
          knob(t('fCount'), o.count, 1, 4, String, set('count'), 1),
          knob(t('fVel'), o.graceVel, 10, 100, (v) => `${v}%`, set('graceVel'), 60)), hint('flamHint'));
      } else kids.push(knobs(knob(t('gap'), o.gap, 0, 500, (v) => `${v} ms`, set('gap'), 30, 5)), hint('glueHint'));
    } else if (kind === 'time') {
      const ts = seg([['reverse', t('tReverse')], ['double', t('tDouble')], ['half', t('tHalf')], ['shift', t('tShift')]], o.mode, (v) => { o.mode = v; changed(); });
      ts.classList.add('grid2');
      kids.push(row(t('mode'), ts));
      if (o.mode === 'shift') {
        kids.push(row(t('grid'), seg(['1/4', '1/8', '1/16', '1/32'].map((g) => [g, g]), o.grid, (v) => { o.grid = v; changed(); })));
        kids.push(knobs(knob(t('steps'), o.steps, -16, 16, signed, set('steps'), 1)));
      } else kids.push(hint(o.mode === 'reverse' ? 'revHint' : o.mode === 'double' ? 'dblHint' : 'halfHint'));
    }
    box.replaceChildren(...kids);
  }

  function paintTabs() {
    $('tabs').replaceChildren(...KINDS.map((k) => {
      const b = document.createElement('button');
      b.className = k === kind ? 'on' : '';
      b.innerHTML = `<svg viewBox="0 0 20 20">${ICON[k]}</svg><span></span>`;
      b.querySelector('span').textContent = t(k);
      b.onclick = () => { kind = k; save(); paintTabs(); paintParams(); redraw(); };
      return b;
    }));
    $('apply').textContent = `${t('apply')} · ${t(kind)}`;
  }

  const closeColors = () => { $('colorMenu').hidden = true; $('colorBtn').classList.remove('open'); };
  function paintStatic() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.color = color;
    $('ver').textContent = `v${VERSION}`;
    $('lang').replaceChildren(...Object.keys(I18N).map((c) => Object.assign(document.createElement('option'), { value: c, textContent: I18N[c]._name })));
    $('lang').value = lang;
    for (const [id, name] of [['tDark', 'dark'], ['tGrey', 'grey']]) { $(id).classList.toggle('on', theme === name); $(id).title = t(name); }
    $('colorBtn').title = t('color'); $('help').title = t('help'); { const q = document.createElement('b'); q.textContent = '?'; const sp = document.createElement('span'); sp.textContent = t('helpBtn'); $('help').replaceChildren(q, sp); } $('colorBtn').setAttribute('aria-label', t('color'));
    $('colorMenu').replaceChildren(...COLORS.map((c) => {
      const b = document.createElement('button');
      b.className = c === color ? 'on' : '';
      b.innerHTML = `<i class="sw" data-color="${c}" data-theme="${theme}"></i><span></span><svg viewBox="0 0 12 12"><path d="M2.5 6.5L5 9L9.5 3.5"/></svg>`;
      b.querySelector('span').textContent = t(`c${c[0].toUpperCase()}${c.slice(1)}`);
      b.onclick = () => { color = c; store.set('color', c); closeColors(); paintStatic(); };
      return b;
    }));
    $('reset').textContent = t('reset'); $('undo').textContent = t('undo');
    $('pBefore').textContent = t('before'); $('pAfter').textContent = t('after');
    paintTabs(); paintParams(); redraw(); relabel();
  }
  $('lang').onchange = () => { lang = $('lang').value; store.set('lang', lang); paintStatic(); };
  for (const b of [$('tDark'), $('tGrey')]) b.onclick = () => { theme = b.dataset.t; store.set('theme', theme); paintStatic(); };
  $('colorBtn').onclick = (ev) => { ev.stopPropagation(); const open = $('colorMenu').hidden; $('colorMenu').hidden = !open; $('colorBtn').classList.toggle('open', open); };
  document.addEventListener('mousedown', (ev) => { if (!ev.target.closest?.('.colors')) closeColors(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeColors(); });
  $('reset').onclick = () => { opts[kind] = { ...DEFAULTS[kind], ...(kind === 'pitch' ? { key: opts.pitch.key, scale: opts.pitch.scale } : {}) }; changed(); paintParams(); };
  paintStatic();

  let luna, built;
  async function build() {
    const s = luna.sessions.current();
    if (s === built) return;
    built = s;
    if (!s) { say('noSession'); return; }
    await s.ready();
    if (s !== built) return;
    await s.musical.ready().catch(() => undefined);
    say(null);
    const ctx = s.context, tl = s.musical.timeline;
    const TPB = Luna.TICKS_PER_BEAT;
    T.setTPB(TPB);
    let busy = false, undoSteps = 0;
    let jobs = [], fromNotes = false;   // [{ clip, lane, track, notes: Note[] }]

    const isMidiTrack = (x) => x && ['instrument', 'midi_matrix'].includes(x.trackType?.value);
    const laneOf = (tk) => s.playlistFor(tk);

    // What to transform: the notes selected in LUNA; else every note that starts inside the
    // selected range, on the selected MIDI tracks.
    async function gather() {
      const out = [];
      const sel = ctx.notes;
      const tracks = s.tracks.items.filter(isMidiTrack);
      if (sel.length) {
        for (const { playlist_uid: uid, notes } of sel) {
          const tk = tracks.find((x) => { const l = laneOf(x); return l && (l.id === uid || l.uid?.value === uid); });
          if (!tk) continue;
          const lane = laneOf(tk);
          await lane.clips.load();
          const rows = new Set(notes.map((n) => n[3]));
          for (const clip of lane.clips.items) {
            await clip.midi.ready();
            const chosen = clip.midi.notes.items.filter((n) => rows.has(n.rowid) && n.stopTick !== undefined);
            if (chosen.length) out.push({ clip, lane, track: tk, notes: chosen });
          }
        }
        return { jobs: out, fromNotes: true };
      }
      const S = ctx.selectionStart.value, E = ctx.selectionStop.value;
      if (typeof S !== 'number' || typeof E !== 'number' || E <= S) return { jobs: out, fromNotes: false };
      const ids = ctx.selectionTracks.value ?? [];
      for (const tk of ids.map((id) => s.tracks.byId(id)).filter(isMidiTrack)) {
        const lane = laneOf(tk);
        if (!lane) continue;
        await lane.clips.load();
        for (const clip of lane.clips.items.filter((c) => c.stop.value > S && c.start.value < E)) {
          await clip.midi.ready();
          const c0 = clip.start.value;
          const chosen = clip.midi.notes.items.filter((n) => n.stopTick !== undefined && c0 + n.startTick >= S && c0 + n.startTick < E);
          if (chosen.length) out.push({ clip, lane, track: tk, notes: chosen });
        }
      }
      return { jobs: out, fromNotes: false };
    }

    const absNotes = () => jobs.flatMap((j) => {
      const c0 = j.clip.start.value ?? 0;
      return j.notes.map((n) => ({ pitch: n.pitch, start: c0 + n.startTick, stop: c0 + n.stopTick, velocity: n.velocity, channel: n.channel, muted: n.muted, group: j.clip.id, ref: n, job: j }));
    });
    const bpmAt = (tick) => { try { return tl.tempoAt(tick) || 120; } catch { return 120; } };
    // The settings of the current tool, in ticks where the page shows milliseconds.
    function params(notes) {
      const o = { ...opts[kind] };
      const at = notes.length ? notes[0].start : 0;
      const ms = (v) => Math.round(((v / 1000) * bpmAt(at) / 60) * TPB);
      if (kind === 'humanize') o.timing = ms(o.timing);
      if (kind === 'length') o.gap = ms(o.gap);
      if (kind === 'strum') o.gap = ms(o.gap);
      if (kind === 'chop') { o.off = ms(o.off); o.gap = ms(o.gap); }
      return o;
    }
    const compute = () => { const before = absNotes(); return { before, after: before.length ? T.apply(kind, before, params(before)) : [] }; };

    relabel = () => paintTarget();
    function paintTarget() {
      const n = jobs.reduce((a, j) => a + j.notes.length, 0);
      $('target').classList.toggle('has', n > 0);
      if (!n) { $('tMain').textContent = t('noNotes'); $('tSub').textContent = t('noNotesSub'); }
      else {
        $('tMain').textContent = t(fromNotes ? 'selNotes' : 'rangeNotes', { n });
        const names = [...new Set(jobs.map((j) => j.track.name.value))].join(', ');
        $('tSub').textContent = t(jobs.length === 1 ? 'clipOn' : 'clipsOn', { c: jobs.length, tracks: names });
      }
      $('apply').disabled = busy || !n;
      $('undo').disabled = busy || !undoSteps;
    }

    // ---- Before / after ---------------------------------------------------------------------------
    redraw = () => {
      const svg = $('roll');
      const W = Math.max(200, svg.clientWidth || 400), H = Math.max(120, svg.clientHeight || 260);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      $('pTitle').textContent = `${t('previewOf')} · ${t(kind)}`;
      const { before, after } = compute();
      if (!before.length) { svg.innerHTML = `<text class="empty" x="${W / 2}" y="${H / 2}">${t('noNotes')}</text>`; return; }
      const all = [...before, ...after];
      let a = Math.min(...all.map((n) => n.start)), b = Math.max(...all.map((n) => n.stop));
      const pad = Math.max(TPB / 4, (b - a) * 0.03); a -= pad; b += pad;
      let lo = Math.min(...all.map((n) => n.pitch)) - 2, hi = Math.max(...all.map((n) => n.pitch)) + 2;
      if (hi - lo < 12) { const m = (hi + lo) / 2; lo = Math.floor(m - 6); hi = Math.ceil(m + 6); }
      const VH = 46, RH = H - VH - 6;
      const X = (tk) => ((tk - a) / (b - a)) * W;
      const rowH = RH / (hi - lo + 1);
      const Y = (p) => (hi - p) * rowH;
      const parts = [];
      // Beats and bars, and the quantize grid when it is the tool in use.
      const beat = TPB;
      const step = (b - a) / beat > 64 ? beat * 4 : beat;
      for (let x = Math.ceil(a / step) * step; x <= b; x += step) {
        let bar = false;
        try { bar = tl.barBeat(x).beat === 1 && tl.barBeat(x).tick === 0; } catch { bar = x % (4 * TPB) === 0; }
        parts.push(`<line class="${bar ? 'bl' : 'gl'}" x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" y1="0" y2="${RH}"/>`);
      }
      if (kind === 'quantize') {
        const q = opts.quantize;
        for (const f of q.feel === 'm' ? ['n', 't'] : [q.feel]) {
          const g = T.gridTicks(q.grid, f);
          if ((b - a) / g < 160) for (let i = Math.ceil(a / g); i * g <= b; i++) {
            const x = T.snap(i * g, g, f === 'n' ? q.swing : 0);
            parts.push(`<line class="ql" x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" y1="0" y2="${RH}"/>`);
          }
        }
      }
      for (let p = lo; p <= hi; p++) if (p % 12 === 0) parts.push(`<text class="pl" x="3" y="${(Y(p) + rowH - 2).toFixed(1)}">C${Math.floor(p / 12) - 1}</text>`);
      const h = Math.max(3, rowH - 1.5);
      for (const n of before) parts.push(`<rect class="old" x="${X(n.start).toFixed(1)}" y="${(Y(n.pitch) + 0.75).toFixed(1)}" width="${Math.max(2, X(n.stop) - X(n.start)).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`);
      for (const n of after) parts.push(`<rect class="new" fill="url(#ngrad)" fill-opacity="${(0.45 + 0.55 * n.velocity / 127).toFixed(2)}" x="${X(n.start).toFixed(1)}" y="${(Y(n.pitch) + 0.75).toFixed(1)}" width="${Math.max(2, X(n.stop) - X(n.start)).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`);
      // Velocity lane underneath.
      const vy = (v) => H - 2 - (v / 127) * (VH - 6);
      parts.push(`<line class="sep" x1="0" x2="${W}" y1="${RH + 3}" y2="${RH + 3}"/>`);
      for (const n of before) parts.push(`<line class="vold" x1="${(X(n.start) - 1.5).toFixed(1)}" x2="${(X(n.start) - 1.5).toFixed(1)}" y1="${H - 2}" y2="${vy(n.velocity).toFixed(1)}"/>`);
      for (const n of after) parts.push(`<line class="vnew" x1="${(X(n.start) + 1.5).toFixed(1)}" x2="${(X(n.start) + 1.5).toFixed(1)}" y1="${H - 2}" y2="${vy(n.velocity).toFixed(1)}"/><circle class="vdot" cx="${(X(n.start) + 1.5).toFixed(1)}" cy="${vy(n.velocity).toFixed(1)}" r="2.2"/>`);
      svg.innerHTML = parts.join('');
    };
    new ResizeObserver(() => redraw()).observe($('roll'));

    // ---- Following LUNA ---------------------------------------------------------------------------
    let gen = 0, watched = [];
    async function refresh() {
      const my = ++gen;
      try {
        const g = await gather();
        if (my !== gen) return;
        jobs = g.jobs; fromNotes = g.fromNotes;
        for (const off of watched) off?.();
        watched = jobs.map((j) => j.clip.midi.notes.onChange?.(() => { if (!busy) later(); }));
      } catch (e) { note('gather failed', { e: errText(e) }); jobs = []; }
      paintTarget(); redraw();
    }
    let timer;
    const later = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 120); };
    for (const p of [ctx.selectionStart, ctx.selectionStop, ctx.selectionTracks, ctx.selectionNotes]) p?.onChange?.(() => { if (!busy) later(); });
    window.addEventListener('focus', later);

    readKey = (quiet) => {
      const first = absNotes()[0];
      const k = s.musical.keySignatureAt?.(first ? first.start : 0) ?? s.musical.keySignatures?.items?.[0];
      if (!k || typeof k.sharpsAndFlats?.value !== 'number') { if (!quiet) say('noKeyLuna', {}, 'bad', 5000); return false; }
      const minor = !!k.isMinor?.value, maj = ((k.sharpsAndFlats.value * 7) % 12 + 12) % 12;
      opts.pitch.key = minor ? (maj + 9) % 12 : maj;
      opts.pitch.scale = minor ? 'minor' : 'major';
      changed();
      return true;
    };
    if (!saved.pitch) readKey(true);
    capture = () => {
      const c = T.captureGroove(absNotes(), opts.groove.grid);
      if (!c) { say('noNotes', {}, 'bad', 4000); return false; }
      opts.groove.custom = c; changed();
      say('captured', { n: c.notes, grid: c.grid }, 'ok', 4000);
      return true;
    };

    // ---- Apply ------------------------------------------------------------------------------------
    async function apply() {
      if (busy) return;
      const { before, after } = compute();
      if (!before.length) return;
      const same = (x, y) => x.pitch === y.pitch && x.start === y.start && x.stop === y.stop;
      const moved = after.length !== before.length || after.some((n, i) => !same(n, before[i]));
      const revel = !moved && after.some((n, i) => n.velocity !== before[i].velocity);
      if (!moved && !revel) { say('nothing', {}, 'bad', 4000); return; }
      busy = true; paintTarget(); say('working');
      const name = t(kind);
      let grew = false, clamped = false;
      try {
        if (!moved) {
          await s.transaction(`MIDI Transform: ${name}`, async () => {
            for (const j of jobs) {
              const changes = after.filter((n) => n.job === j).map((n) => ({ note: n.ref, velocity: n.velocity })).filter((c) => c.velocity !== c.note.velocity);
              if (changes.length) await j.clip.midi.setVelocities(changes);
            }
          });
          undoSteps = 1;
        } else {
          const plans = [];
          for (const j of jobs) {
            const mine = after.filter((n) => n.job === j);
            const c0 = j.clip.start.value, cEnd = j.clip.stop.value;
            let end = cEnd;
            const need = Math.max(...mine.map((n) => n.stop));
            if (need > cEnd) {
              // Make room: grow the clip up to the next bar line past the last note, if the lane is free.
              let want = need;
              try { const bb = tl.barBeat(need); want = bb.beat === 1 && bb.tick === 0 ? need : tl.tickAtBar(bb.bar + 1); } catch { want = Math.ceil(need / (4 * TPB)) * 4 * TPB; }
              const next = j.lane.clips.items.filter((c) => c !== j.clip && c.start.value >= cEnd).reduce((m, c) => Math.min(m, c.start.value), Infinity);
              end = Math.min(want, next);
              if (end > cEnd) grew = true;
            }
            const fresh = mine.map((n) => {
              let start = Math.max(c0, n.start), stop = Math.min(end, n.stop);
              if (start !== n.start || stop !== n.stop) clamped = true;
              if (start >= end) start = end - T.MIN();
              if (stop <= start) stop = start + T.MIN();
              return { pitch: n.pitch, tick: start - c0, lengthTicks: stop - start, velocity: n.velocity, channel: n.channel ?? 0, muted: n.muted, start };
            });
            plans.push({ j, end, fresh });
          }
          await s.transaction(`MIDI Transform: ${name}`, async () => {
            for (const p of plans) {
              if (p.end > p.j.clip.stop.value) await p.j.clip.trim(p.j.clip.start.value, p.end);
              await p.j.clip.midi.deleteNotes(p.j.notes);
              await p.j.clip.addNotes(p.fresh.map(({ pitch, tick, lengthTicks, velocity, channel }) => ({ pitch, tick, lengthTicks, velocity, channel })));
            }
          });
          undoSteps = 1;
          for (const p of plans) await p.j.clip.midi.refresh().catch(() => undefined);
          // Notes that were muted stay muted, and the new notes stay selected so the next tool
          // (or the same one again) works on them.
          const sel = [];
          for (const p of plans) {
            const c0 = p.j.clip.start.value;
            const items = p.j.clip.midi.notes.items;
            const used = new Set();
            const found = p.fresh.map((f) => { const m = items.find((n) => !used.has(n.rowid) && n.pitch === f.pitch && c0 + n.startTick === f.start); if (m) used.add(m.rowid); return m; });
            const mute = found.filter((m, i) => m && p.fresh[i].muted);
            if (mute.length) { await p.j.clip.midi.setMuted(mute, true); undoSteps++; }
            if (fromNotes) {
              const uid = p.j.lane.uid?.value ?? p.j.lane.id;
              let entry = sel.find((x) => x.playlist_uid === uid);
              if (!entry) { entry = { playlist_uid: uid, notes: [] }; sel.push(entry); }
              for (const m of found) if (m) entry.notes.push([m.pitch, c0 + m.startTick, c0 + m.stopTick, m.rowid]);
            }
          }
          if (fromNotes && sel.length) await ctx.selectionNotes.set(sel).catch((e) => note('reselect failed', { e: errText(e) }));
        }
        note('apply', { kind, opts: opts[kind], notes: before.length, clips: jobs.length, moved, grew, clamped });
        say(grew ? 'grew' : clamped ? 'clamped' : 'applied', { name, n: Math.max(before.length, after.length) }, 'ok', 5000);
      } catch (e) {
        note('apply failed', { kind, e: errText(e) });
        say('failed', { e: errText(e) }, 'bad', 8000);
      }
      busy = false;
      await refresh();
    }
    $('apply').onclick = () => void apply();
    $('undo').onclick = async () => {
      if (!undoSteps || busy) return;
      try { await s.undo(undoSteps); undoSteps = 0; say('undone', {}, 'ok', 3000); } catch (e) { say('failed', { e: errText(e) }, 'bad', 6000); }
      await refresh();
    };
    $('ver').onclick = async (ev) => {
      if (!ev.altKey) return;
      const text = JSON.stringify({ version: VERSION, kind, opts, target: { fromNotes, clips: jobs.map((j) => ({ track: j.track.name.value, clip: j.clip.name?.value, notes: j.notes.length })) }, log }, null, 2);
      try { if (await AddOnCopy(text)) say('report', {}, 'ok', 5000); } catch { /* nothing */ }
    };
    document.addEventListener('keydown', (ev) => { if (tour?.active) return; if (ev.key === 'Enter' && !ev.target.closest?.('select, input')) { ev.preventDefault(); void apply(); } });
    tour ??= window.AddOnTour?.attach({
      button: $('help'), key: `${KEY}tourSeen`,
      labels: () => ({ next: t('tNext'), back: t('tBack'), skip: t('tSkip'), done: t('tDone') }),
      language: {
        sel: '#lang',
        list: () => Object.keys(I18N).map((c) => [c, I18N[c]._name]),
        current: () => lang,
        set: (c) => { lang = c; store.set('lang', c); paintStatic(); },
        title: () => t('langT'), text: () => t('langX'),
      },
      steps: () => [
        { sel: '#target', title: () => t('q1t'), text: () => t('q1') },
        { sel: '#tabs', title: () => t('q2t'), text: () => t('q2') },
        { sel: '#params', title: () => t('q3t'), text: () => t('q3') },
        { sel: '#preview', title: () => t('q4t'), text: () => t('q4') },
        { sel: '.actions', title: () => t('q5t'), text: () => t('q5') },
        { sel: '#help', title: () => t('zt'), text: () => t('z') },
      ],
    });
    await refresh();
  }

  (async () => {
    for (;;) {
      try { luna = await Luna.connect(); break; }
      catch { say('waiting'); await new Promise((r) => setTimeout(r, 1500)); }
    }
    Luna.bindShortcuts(luna, { onError: () => undefined });
    await luna.sessions.ready();
    luna.sessions.focused.onChange(() => void build());
    await build();
  })();
})();
