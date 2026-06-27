// Dog AI behaviors (#187 — cross-animal charm). Same { id, test, run } shape as the
// other species: `test` is pure (unit-tested in ./behaviors.test.js), `run` is the
// scene-coupled primitive (charm.js dogGoHerd). Purely cosmetic.
//
// The dog's only goal-driven behavior so far is herding flavour: when a sheep flock
// is within range and the per-dog cooldown has elapsed, it ambles over and noses the
// flock into a bunch, then loses interest. A fuller "dog job" is the bigger #186.

// Sheep nearby (and off cooldown) → amble over and bunch the flock. nearestSheepDist
// is Infinity unless at least one sheep is within herding range (the scene context
// applies that range when building it), so this is really "sheep in range + not on
// cooldown + daytime". Night is excluded — the dog beds down then.
export const dogHerdSheep = {
  id: 'dogHerdSheep',
  test: (ctx) =>
    !ctx.isNight &&
    ctx.nearestSheepDist < Infinity &&
    (ctx.lastHerd == null || ctx.now - ctx.lastHerd > ctx.herdCooldown),
  run: (scene, a) => scene.dogGoHerd(a),
};
