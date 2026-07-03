// Generic stream-swim charm behavior (#231). Species-NEUTRAL by design — the point of
// this file is that any species that declares the `swims` capability (species/<name>/
// index.js `capabilities.swims = true`) can reuse this one module with zero extra code,
// mirroring the reused horse grazer modules. The dog is the only swimmer for now; a
// future swimmer (ducks, #275) just needs `swims: true` + its own `${key}_swim_0/1` art
// frames — no changes here.
//
// Same { id, test, run } shape as every other species behavior: `test` is pure (unit-
// tested in ./swim.test.js), `run` is the scene-coupled primitive (charm.js
// animalGoSwim). Purely cosmetic — no stat/mood effects — so species that want it
// register it at LOW priority (after any need-driven behaviors), the same slot the pig
// wallow / llama spit occupy.
//
// A content, off-cooldown, daytime animal → occasionally wander to the stream and
// swim. Purely a random per-tick chance (like the pig wallow), not need-driven —
// "sometimes takes a dip" rather than anything hunger/thirst related.
export const swimStream = {
  id: 'swimStream',
  test: (ctx) =>
    !ctx.isNight &&
    ctx.streamDist < Infinity &&
    (ctx.lastSwim == null || ctx.now - ctx.lastSwim > ctx.swimCooldown) &&
    Math.random() < ctx.swimChance,
  run: (scene, a) => scene.animalGoSwim(a),
};
