// ── Musical styles ("sections") for the generative soundtrack ──
// Pure data: the generative music engine (src/legacy/game.js) reads these; the
// harmony/groove math lives in src/systems/musicGroove.js. Each style is a
// complete kit — a scale/mode the melody wanders, its own bank of chord
// progressions (each in its own key/mode), a rhythmic groove, and a timbre set
// (bass/pad/lead oscillators + filters). The continuous fields (tempo, densities,
// percussion volumes) crossfade smoothly between styles; the discrete musical
// structure (scale, progs, groove) pivots cleanly at the midpoint of a fade.
//
// Triads are [root, third, fifth] in semitones from A2; scales are absolute
// semitone offsets spanning ~2 octaves.
//
// The groove has four per-eighth-note lanes across a 4/4 bar (STEPS_PER_BAR = 8):
//   bassPat  — a MOVING bassline. Each step is null (rest) or {d,l,v,p}:
//                d  degree resolved by musicGroove.bassSemi (r/8/5/5h/3/n1/n2/na)
//                l  note length in eighth-notes   v  velocity (0..1, ~ghost..accent)
//                p  probability it sounds this bar (default 1) — lets it breathe
//   chordPat — the harmony's RHYTHM. null or {l,v,voi,p,next}: a full triad struck
//                on this eighth. voi re-voices it (musicGroove.voiceChord); next
//                anticipates the following chord early; chordOct shifts the octave.
//   kickPat / hatPat — percussion, unchanged.
// arpVel scales the single-note arp sparkle that rides on top (the chord comp now
// carries the harmony, so most styles pull the arp back to a light shimmer; the
// bell-forward styles keep it loud because those arpeggios ARE their identity).
export const MUSIC_SECTIONS = [
  // Brooding A natural-minor dungeon — the classic theme, steady heartbeat kit.
  // Bass: driving 8th walk (root, octave hop, syncopated fifth, passing third) that
  // chromatically leads into each next chord. Comp: syncopated stabs + anticipation.
  { name: 'Cavern',  tempo: 0.26,
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 24],
    progs: [
      [[0,3,7],[8,12,15],[3,7,10],[10,14,17]],   // Am  F   C   G
      [[0,3,7],[5,8,12],[7,10,14],[0,3,7]],       // Am  Dm  Em  Am
    ],
    bass: { type: 'sawtooth', cutoff: 620,  q: 3, detune: 4, vol: 0.30 },
    pad:  { type: 'sine',     cutoff: 1500, q: 1, detune: 4, vol: 0.13 },
    lead: { type: 'triangle', cutoff: 3000, q: 1, detune: 5, vol: 0.20 },
    leadDensity: 0.66, arpDensity: 0.22,
    kickVol: 1.0, kickMidVol: 0.9, hatVol: 0.05,
    groove: { swing: 0.0, leadOct: 12, arpOct: 12, arpEvery: 4, arpVel: 0.5, chordOct: 0,
      leadLong: 0.3, leadRest: 0.12,
      bassPat: [{d:'r',l:1.3,v:1.0}, null, {d:'8',l:0.7,v:0.72,p:0.9}, {d:'5',l:0.7,v:0.85,p:0.9},
                {d:'r',l:1.1,v:1.0}, {d:'3',l:0.6,v:0.66,p:0.7}, {d:'n1',l:0.7,v:0.82,p:0.85}, {d:'n2',l:0.7,v:0.88,p:0.92}],
      chordPat: [{l:1.4,v:1.0,voi:'root'}, null, null, {l:0.8,v:0.82,voi:'inv1',p:0.85},
                 {l:1.2,v:0.95,voi:'open'}, null, {l:0.6,v:0.8,voi:'inv1',p:0.8}, {l:0.9,v:0.7,voi:'root',p:0.65,next:true}],
      kickPat: ['main', null, null, null, 'mid', null, null, null],
      hatPat:  [0,1,0,1,0,1,0,1] } },

  // Bright, shimmering D Dorian — busy bell arpeggios stay the star. Bass: a light
  // bouncing pluck (root, octave, fifth). Comp: sparse glassy stabs high overhead.
  { name: 'Crystal', tempo: 0.235,
    scale: [5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24, 26],
    progs: [
      [[5,8,12],[10,14,17],[5,8,12],[10,14,17]], // Dm  G   Dm  G   (Dorian IV)
      [[5,8,12],[7,10,14],[10,14,17],[3,7,10]],   // Dm  Em  G   C
    ],
    bass: { type: 'triangle', cutoff: 900,  q: 2, detune: 4, vol: 0.24 },
    pad:  { type: 'triangle', cutoff: 2600, q: 1, detune: 6, vol: 0.12 },
    lead: { type: 'sine',     cutoff: 4600, q: 1, detune: 3, vol: 0.17 },
    leadDensity: 0.5, arpDensity: 0.72,
    kickVol: 0.5, kickMidVol: 0.3, hatVol: 0.04,
    groove: { swing: 0.12, leadOct: 24, arpOct: 12, arpEvery: 1, arpVel: 0.95, chordOct: 12,
      leadLong: 0.45, leadRest: 0.18,
      bassPat: [{d:'r',l:1.0,v:1.0}, null, {d:'8',l:0.6,v:0.7,p:0.85}, null,
                {d:'5',l:0.9,v:0.8}, null, {d:'8',l:0.5,v:0.6,p:0.6}, {d:'n2',l:0.6,v:0.7,p:0.7}],
      chordPat: [null, {l:0.5,v:0.6,voi:'inv1',p:0.6}, null, {l:0.5,v:0.65,voi:'open',p:0.7},
                 null, {l:0.5,v:0.6,voi:'inv1',p:0.6}, null, {l:0.5,v:0.6,voi:'root',p:0.5,next:true}],
      kickPat: ['mid', null, null, null, 'mid', null, null, null],
      hatPat:  [0,0,1,0,0,0,1,0] } },

  // Dark, exotic A harmonic-minor forge — square-wave industrial drive. Bass: a
  // relentless straight-8th machine pedal with hard leading-tone pushes. Comp:
  // short mechanical on-beat stabs.
  { name: 'Forge',   tempo: 0.205,
    scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 20],
    progs: [
      [[0,3,7],[5,8,12],[7,11,14],[0,3,7]],       // Am  Dm  E   Am  (harmonic-minor V)
      [[0,3,7],[8,12,15],[7,11,14],[0,3,7]],       // Am  F   E   Am
    ],
    bass: { type: 'square',   cutoff: 520,  q: 4, detune: 6, vol: 0.22 },
    pad:  { type: 'sawtooth', cutoff: 1200, q: 2, detune: 4, vol: 0.10 },
    lead: { type: 'square',   cutoff: 2500, q: 1, detune: 5, vol: 0.15 },
    leadDensity: 0.8, arpDensity: 0.28,
    kickVol: 1.1, kickMidVol: 0.85, hatVol: 0.07,
    groove: { swing: 0.0, leadOct: 0, arpOct: 12, arpEvery: 4, arpVel: 0.5, chordOct: 0,
      leadLong: 0.18, leadRest: 0.08,
      bassPat: [{d:'r',l:0.9,v:1.0}, {d:'r',l:0.5,v:0.68,p:0.8}, {d:'r',l:0.9,v:1.0}, {d:'5',l:0.5,v:0.8,p:0.85},
                {d:'r',l:0.9,v:1.0}, {d:'r',l:0.5,v:0.68,p:0.8}, {d:'n2',l:0.6,v:0.85}, {d:'n2',l:0.6,v:0.9}],
      chordPat: [{l:0.6,v:1.0,voi:'root'}, null, {l:0.5,v:0.8,voi:'inv1',p:0.8}, null,
                 {l:0.6,v:1.0,voi:'root'}, null, {l:0.5,v:0.85,voi:'inv1',p:0.85}, {l:0.4,v:0.7,voi:'open',p:0.6,next:true}],
      kickPat: ['main', null, 'mid', null, 'main', null, 'mid', null],
      hatPat:  [0,1,0,1,0,1,0,1] } },

  // Airy, dreamy C Lydian — ambient drone, no percussion. Bass: a floating root
  // drone with a single slow rise. Comp: long swelling chords that drift between
  // voicings across the bar — motion from harmony, not rhythm.
  { name: 'Mist',    tempo: 0.30,
    scale: [3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
    progs: [
      [[3,7,10],[5,9,12],[3,7,10],[10,14,17]],   // C   D   C   G   (Lydian II)
      [[3,7,10],[10,14,17],[5,9,12],[3,7,10]],     // C   G   D   C
    ],
    bass: { type: 'sine',     cutoff: 400,  q: 1, detune: 3, vol: 0.30 },
    pad:  { type: 'sine',     cutoff: 1100, q: 1, detune: 4, vol: 0.15 },
    lead: { type: 'triangle', cutoff: 2400, q: 1, detune: 4, vol: 0.17 },
    leadDensity: 0.35, arpDensity: 0.2,
    kickVol: 0.0, kickMidVol: 0.0, hatVol: 0.0,
    groove: { swing: 0.0, leadOct: 24, arpOct: 12, arpEvery: 4, arpVel: 0.8, chordOct: 0,
      leadLong: 0.6, leadRest: 0.3,
      bassPat: [{d:'r',l:5.0,v:1.0}, null, null, null, {d:'8',l:2.6,v:0.6,p:0.6}, null, null, {d:'na',l:2.0,v:0.55,p:0.4}],
      chordPat: [{l:4.0,v:0.9,voi:'open'}, null, null, null, {l:3.5,v:0.85,voi:'inv2'}, null, null, null],
      kickPat: [null, null, null, null, null, null, null, null],
      hatPat:  [0,0,0,0,0,0,0,0] } },

  // Loose, bluesy A minor-pentatonic — heavy swing, laid-back. Bass: a lazy swung
  // walk with pentatonic passing tones. Comp: off-beat "skank" stabs up high.
  { name: 'Hollow',  tempo: 0.25,
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    progs: [
      [[0,3,7],[3,7,10],[5,8,12],[0,3,7]],         // Am  C   Dm  Am
      [[0,3,7],[10,14,17],[3,7,10],[5,8,12]],       // Am  G   C   Dm
    ],
    bass: { type: 'sawtooth', cutoff: 700,  q: 3, detune: 5, vol: 0.28 },
    pad:  { type: 'square',   cutoff: 1400, q: 2, detune: 5, vol: 0.10 },
    lead: { type: 'triangle', cutoff: 2800, q: 1, detune: 6, vol: 0.19 },
    leadDensity: 0.6, arpDensity: 0.2,
    kickVol: 0.85, kickMidVol: 0.6, hatVol: 0.05,
    groove: { swing: 0.3, leadOct: 12, arpOct: 12, arpEvery: 4, arpVel: 0.55, chordOct: 12,
      leadLong: 0.35, leadRest: 0.16,
      bassPat: [{d:'r',l:1.5,v:1.0}, null, null, {d:'5',l:0.8,v:0.85,p:0.8},
                {d:'r',l:1.2,v:0.95}, null, {d:'3',l:0.7,v:0.7,p:0.7}, {d:'n1',l:0.8,v:0.8,p:0.85}],
      chordPat: [null, {l:0.5,v:0.72,voi:'inv1',p:0.85}, null, {l:0.5,v:0.72,voi:'open',p:0.8},
                 null, {l:0.5,v:0.72,voi:'inv1',p:0.85}, null, {l:0.5,v:0.66,voi:'root',p:0.6,next:true}],
      kickPat: ['main', null, null, null, 'mid', null, 'mid', null],
      hatPat:  [0,1,0,1,0,1,0,1] } },

  // Epic, marching A minor — driving saw brass. Bass: a martial quarter-note pulse
  // with octave leaps and a cadential walk. Comp: big heroic wide-voiced swells.
  { name: 'March',   tempo: 0.22,
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 24],
    progs: [
      [[0,3,7],[7,10,14],[8,12,15],[0,3,7]],       // Am  Em  F   Am
      [[0,3,7],[8,12,15],[10,14,17],[7,10,14]],     // Am  F   G   Em
    ],
    bass: { type: 'sawtooth', cutoff: 700,  q: 3, detune: 5, vol: 0.30 },
    pad:  { type: 'sawtooth', cutoff: 1700, q: 1, detune: 6, vol: 0.12 },
    lead: { type: 'sawtooth', cutoff: 3200, q: 1, detune: 6, vol: 0.18 },
    leadDensity: 0.7, arpDensity: 0.25,
    kickVol: 1.1, kickMidVol: 0.9, hatVol: 0.06,
    groove: { swing: 0.0, leadOct: 12, arpOct: 12, arpEvery: 4, arpVel: 0.5, chordOct: 0,
      leadLong: 0.3, leadRest: 0.1,
      bassPat: [{d:'r',l:1.6,v:1.0}, null, {d:'8',l:1.0,v:0.8,p:0.9}, null,
                {d:'r',l:1.6,v:1.0}, null, {d:'n1',l:0.8,v:0.85}, {d:'n2',l:0.8,v:0.9}],
      chordPat: [{l:1.8,v:1.0,voi:'wide'}, null, null, null, {l:1.6,v:0.95,voi:'root'}, null,
                 {l:0.8,v:0.8,voi:'inv1',p:0.7}, {l:1.0,v:0.85,voi:'open',next:true}],
      kickPat: ['main', null, 'mid', null, 'main', null, 'mid', null],
      hatPat:  [0,1,0,1,0,1,0,1] } },

  // Bright, hopeful C major — uplifting bells over a gentle pulse. Bass: a bouncing
  // major root-fifth-octave line. Comp: a warm broken-chord comp, gently syncopated.
  { name: 'Bloom',   tempo: 0.24,
    scale: [3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
    progs: [
      [[3,7,10],[10,14,17],[12,15,19],[8,12,15]],   // C   G   Am  F
      [[3,7,10],[8,12,15],[10,14,17],[3,7,10]],      // C   F   G   C
    ],
    bass: { type: 'triangle', cutoff: 800,  q: 2, detune: 3, vol: 0.24 },
    pad:  { type: 'sine',     cutoff: 2400, q: 1, detune: 5, vol: 0.13 },
    lead: { type: 'sine',     cutoff: 4800, q: 1, detune: 3, vol: 0.17 },
    leadDensity: 0.55, arpDensity: 0.55,
    kickVol: 0.6, kickMidVol: 0.45, hatVol: 0.05,
    groove: { swing: 0.08, leadOct: 24, arpOct: 12, arpEvery: 1, arpVel: 0.85, chordOct: 12,
      leadLong: 0.45, leadRest: 0.16,
      bassPat: [{d:'r',l:1.2,v:1.0}, null, {d:'5',l:0.7,v:0.8,p:0.85}, null,
                {d:'8',l:0.9,v:0.85}, null, {d:'3',l:0.6,v:0.7,p:0.7}, {d:'n2',l:0.7,v:0.8,p:0.85}],
      chordPat: [{l:1.0,v:0.9,voi:'root'}, null, {l:0.8,v:0.8,voi:'inv1',p:0.8}, null,
                 {l:1.0,v:0.9,voi:'open'}, null, {l:0.7,v:0.75,voi:'inv2',p:0.7}, {l:0.8,v:0.7,voi:'root',p:0.6,next:true}],
      kickPat: ['mid', null, null, null, 'mid', null, null, null],
      hatPat:  [0,0,1,0,0,0,1,0] } },

  // Eerie, dissonant whole-tone — a creeping, weightless dread, no drums. Bass: an
  // unmoored drift with a chromatic slide (whole-tone has no leading tone, so it
  // never resolves). Comp: floating augmented clusters that drift between voicings.
  { name: 'Veil',    tempo: 0.29,
    scale: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    progs: [
      [[0,4,8],[2,6,10],[0,4,8],[6,10,14]],         // aug shifts
      [[0,4,8],[6,10,14],[4,8,12],[2,6,10]],
    ],
    bass: { type: 'sine',     cutoff: 420,  q: 1, detune: 4, vol: 0.28 },
    pad:  { type: 'triangle', cutoff: 1300, q: 1, detune: 7, vol: 0.14 },
    lead: { type: 'sine',     cutoff: 2200, q: 1, detune: 4, vol: 0.15 },
    leadDensity: 0.4, arpDensity: 0.25,
    kickVol: 0.0, kickMidVol: 0.0, hatVol: 0.0,
    groove: { swing: 0.0, leadOct: 24, arpOct: 12, arpEvery: 4, arpVel: 0.75, chordOct: 0,
      leadLong: 0.6, leadRest: 0.3,
      bassPat: [{d:'r',l:4.6,v:1.0}, null, null, {d:'na',l:2.4,v:0.7,p:0.6}, null, null, {d:'3',l:2.8,v:0.66,p:0.5}, null],
      chordPat: [{l:3.4,v:0.9,voi:'open'}, null, null, null, {l:3.0,v:0.85,voi:'inv1'}, null, null, {l:2.4,v:0.78,voi:'open',p:0.7,next:true}],
      kickPat: [null, null, null, null, null, null, null, null],
      hatPat:  [0,0,0,0,0,0,0,0] } },

  // Laid-back lo-fi D Dorian — heavy swing, mellow late-night. Bass: a fat lo-fi
  // head-nod that sits behind the beat, with a descending slide into the next
  // chord. Comp: soft muted off-beat keys, jazzy inversions.
  { name: 'Tide',    tempo: 0.275,
    scale: [5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24, 26],
    progs: [
      [[5,8,12],[10,14,17],[7,10,14],[5,8,12]],     // Dm  G   Em  Dm
      [[5,8,12],[3,7,10],[10,14,17],[7,10,14]],      // Dm  C   G   Em
    ],
    bass: { type: 'sine',     cutoff: 600,  q: 2, detune: 4, vol: 0.28 },
    pad:  { type: 'triangle', cutoff: 1600, q: 1, detune: 6, vol: 0.12 },
    lead: { type: 'triangle', cutoff: 2600, q: 1, detune: 5, vol: 0.18 },
    leadDensity: 0.5, arpDensity: 0.2,
    kickVol: 0.7, kickMidVol: 0.5, hatVol: 0.06,
    groove: { swing: 0.38, leadOct: 12, arpOct: 12, arpEvery: 4, arpVel: 0.6, chordOct: 0,
      leadLong: 0.4, leadRest: 0.2,
      bassPat: [{d:'r',l:1.8,v:1.0}, null, null, {d:'5',l:0.9,v:0.8,p:0.75},
                {d:'r',l:1.2,v:0.9}, null, {d:'na',l:0.8,v:0.72,p:0.7}, null],
      chordPat: [null, {l:0.9,v:0.7,voi:'open',p:0.8}, null, {l:0.9,v:0.7,voi:'inv2',p:0.75},
                 null, {l:0.9,v:0.7,voi:'open',p:0.8}, null, {l:0.8,v:0.66,voi:'inv1',p:0.6,next:true}],
      kickPat: ['main', null, null, null, 'mid', null, null, null],
      hatPat:  [0,1,0,1,0,1,0,1] } },

  // BOSS — only plays during boss fights. Fast, menacing A Phrygian-dominant with a
  // pounding kick. Bass: a relentless pounding pedal with half-step chromatic pushes
  // (the b2 is the menace). Comp: dense, driving, aggressive stabs. Kept LAST so the
  // normal drift never randomly selects it (see scheduleMusic / startMusic).
  { name: 'Boss',    tempo: 0.16,
    scale: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19, 20],
    progs: [
      [[0,4,7],[1,5,8],[0,4,7],[7,10,13]],          // A  Bb  A  E(ish) — menacing
      [[0,4,7],[8,12,15],[1,5,8],[0,4,7]],
    ],
    bass: { type: 'square',   cutoff: 560,  q: 5, detune: 7, vol: 0.30 },
    pad:  { type: 'sawtooth', cutoff: 1400, q: 2, detune: 5, vol: 0.12 },
    lead: { type: 'square',   cutoff: 2800, q: 1, detune: 6, vol: 0.18 },
    leadDensity: 0.9, arpDensity: 0.35,
    kickVol: 1.25, kickMidVol: 1.0, hatVol: 0.09,
    groove: { swing: 0.0, leadOct: 0, arpOct: 12, arpEvery: 4, arpVel: 0.55, chordOct: 0,
      leadLong: 0.15, leadRest: 0.06,
      bassPat: [{d:'r',l:0.8,v:1.0}, {d:'r',l:0.8,v:0.88,p:0.9}, {d:'r',l:0.8,v:1.0}, {d:'n2',l:0.7,v:0.9},
                {d:'r',l:0.8,v:1.0}, {d:'r',l:0.8,v:0.88,p:0.9}, {d:'5',l:0.7,v:0.85,p:0.85}, {d:'n2',l:0.7,v:0.95}],
      chordPat: [{l:0.6,v:1.0,voi:'root'}, null, {l:0.5,v:0.9,voi:'inv1',p:0.9}, {l:0.5,v:0.85,voi:'root',p:0.8},
                 null, {l:0.5,v:0.9,voi:'inv1',p:0.85}, {l:0.5,v:0.8,voi:'open',p:0.7}, {l:0.5,v:0.85,voi:'root',p:0.8,next:true}],
      kickPat: ['main', 'mid', 'main', 'mid', 'main', 'mid', 'main', 'mid'],
      hatPat:  [1,1,1,1,1,1,1,1] } },
];
