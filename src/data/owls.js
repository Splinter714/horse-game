// Pure decision logic for the ambient NOCTURNAL OWL (issue #271). Kept separate from
// the scene mixin (scenes/paddock/owls.js) so the *decisions* — whether owls are active
// (night-only), whether one should appear on a given visit tick, how soon the next visit
// is — are Phaser-free and unit-testable (mirrors data/wildlife.js for the raccoon and
// data/ambientEvents.js for the event gates). The scene wires these to sprites/tweens.
//
// Owls are AMBIENT wildlife, not a cared-for roster species: they appear, hoot, and
// glide after dark for cozy night atmosphere, and register into the ambient-events
// registry (#253) like the other critters. Their defining hook is that they are active
// ONLY at night — strictly the 'Night' phase (when the day/night cycle reports
// isNight === true), a tighter window than the raccoon's dusk+night "nocturnal".

// The single phase in which owls are out. The day/night cycle emits PHASE_CHANGE with
// isNight === true exactly for this phase, so "owls active" == "isNight".
export const OWL_ACTIVE_PHASE = 'Night';

// Are owls active in this phase? Night only — the cozy nocturnal window. This is the
// pure core the whole feature is gated on (the ambient-events `night` gate, the visit
// scheduler, and the smoke test all resolve back to this).
export function isOwlActivePhase(phase) {
  return phase === OWL_ACTIVE_PHASE;
}

// Should an owl appear on this visit tick? Only at night, and never while the player is
// asleep (the whole world is frozen then). No daytime cameo — owls are strictly a
// night beat, unlike the raccoon which has a rare daytime appearance.
export function shouldOwlAppear({ phase, sleeping }) {
  if (sleeping) return false;
  return isOwlActivePhase(phase);
}

// How soon the next owl visit is scheduled (ms). A gentle cadence at night; a long,
// effectively-dormant wait outside the night phase (it's re-checked each tick, so the
// owl simply won't spawn until night returns). `rand` is injected (Phaser.Math.Between)
// so the scene stays the only Phaser-coupled part.
export function owlVisitDelay(phase, rand) {
  return isOwlActivePhase(phase) ? rand(12000, 26000) : rand(30000, 60000);
}
