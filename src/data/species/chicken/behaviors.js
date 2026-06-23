// Chicken AI behaviors — the data-driven port of the old `chickenTick` if-ladder
// (src/scenes/paddock/creatures.js). Same { id, test, run } shape as the horse
// behaviors: `test` is pure (unit-tested in ./behaviors.test.js), `run` is
// scene-coupled and reuses the existing movement primitives unchanged.
//
// Note: egg laying (eggLayTick, a 45s timer) and roosting are scheduler-driven, not
// per-tick decisions, so they stay in the scene mixins and are not behaviors here.

// Dropped seed on the ground always wins. ctx.nearestSeed is the pile this chicken
// can actually reach (seed inside the pasture needs the gate open), or null.
export const seekSeed = {
  id: 'seekSeed',
  test: (ctx) => !!ctx.nearestSeed,
  run: (scene, a) => { scene.chickenGoEat(a, scene._nearestReachableSeed(a, scene._gateOpen())); return true; },
};

// A basket with seed in the active hand lures the whole flock — they trail the player.
export const followForSeed = {
  id: 'followForSeed',
  test: (ctx) => ctx.luring,
  run: (scene, a) => { scene.chickenFollow(a); return true; },
};

// Fresh-morning anticipation: until fed today, the flock crowds the grain bin.
export const gatherAtBin = {
  id: 'gatherAtBin',
  test: (ctx) => ctx.anticipating,
  run: (scene, a) => { scene.chickenGatherAt(a, scene._grainBin()); return true; },
};
