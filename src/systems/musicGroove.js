// Pure harmony/groove resolvers for the generative music engine (in
// src/legacy/game.js). No state, no rng, no DOM, no clock — just semitone math
// over a triad plus the groove data in src/data/musicSections.js. The engine's
// scheduler calls these once per note; keeping them here makes the musical rules
// unit-testable in isolation (the scheduler itself still lives in legacy).

// A bass-groove step names a chord/scale DEGREE; this resolves it to a semitone
// offset from A2 (the engine's reference pitch, 110 Hz). The bassline sits an
// octave below the chord (root − 12). The n*/na degrees don't belong to the
// current chord at all — they walk chromatically toward the NEXT chord's root so
// a progression drives forward across the bar line instead of resetting each bar.
//   r   root, low (root − 12)        8   root up an octave (root)
//   5   fifth, low (fifth − 12)      5h  fifth up an octave (fifth)
//   3   third, low (third − 12)
//   n1  whole-step below next root   n2  half-step below next root (leading tone)
//   na  half-step ABOVE next root (a descending lead-in)
// An unknown degree falls back to the low root, so a typo can never throw.
export function bassSemi(degree, chord, nextChord) {
  const root = chord[0];
  const nextRoot = ((nextChord && nextChord[0] != null) ? nextChord[0] : root) - 12;
  switch (degree) {
    case '8':  return root;
    case '5':  return chord[2] - 12;
    case '5h': return chord[2];
    case '3':  return chord[1] - 12;
    case 'n1': return nextRoot - 2;
    case 'n2': return nextRoot - 1;
    case 'na': return nextRoot + 1;
    case 'r':
    default:   return root - 12;
  }
}

// Re-voice a [root, third, fifth] triad (semitones from A2) for the chord-comp
// lane, so repeated stabs of the same chord aren't identical stamps and the
// harmony keeps shifting shape under the melody.
//   root  close root position          inv1  first inversion (3rd in the bass)
//   inv2  second inversion (5th low)    open  open voicing (third up an octave)
//   wide  root dropped an octave — a big, powerful spread for heroic/heavy styles
// An unknown voicing falls back to close root position.
export function voiceChord(triad, voi) {
  const [r, th, fi] = triad;
  switch (voi) {
    case 'inv1': return [th, fi, r + 12];
    case 'inv2': return [fi, r + 12, th + 12];
    case 'open': return [r, fi, th + 12];
    case 'wide': return [r - 12, th, fi];
    case 'root':
    default:     return [r, th, fi];
  }
}
