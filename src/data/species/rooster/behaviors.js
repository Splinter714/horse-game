// Rooster AI behaviors (#269). The rooster REUSES the chicken's flock behaviors
// (fleeDog / seekSeed / followForSeed / followWhenHungry / gatherAtBin) — those are
// merged in via the BEHAVIORS registry (species/index.js), so this module only adds
// the one thing that makes a rooster a rooster: the dawn CROW.
//
// Same { id, test, run } shape as the other behaviors: `test` is pure (unit-tested in
// ./behaviors.test.js), `run` is scene-coupled and reuses a scene primitive.

// The dawn crow. Like egg-laying/roosting on the hen, the crow is scheduler-driven
// (armed by the Morning PHASE_CHANGE in paddock/dayNight.js), NOT a free per-tick
// decision — so its `test` only fires when the scene has armed `ctx.crowing` for this
// bird. Top priority in the list so, once armed, it interrupts whatever milling the
// rooster was doing; the moment the scene clears the flag (after the crow plays) it
// falls back to the shared flock behaviors. This keeps the *decision* pure/testable
// while the timing stays with the day/night scheduler.
export const crowAtDawn = {
  id: 'crowAtDawn',
  test: (ctx) => !!ctx.crowing,
  run: (scene, a) => { scene.roosterCrow(a); return true; },
};
