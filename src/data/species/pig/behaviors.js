// Pig AI behaviors (#197). Same { id, test, run } shape as the other species'
// modules: `test` is pure (unit-tested in ./behaviors.test.js), `run` is the
// scene-coupled primitive (charm.js pigGoWallow). Purely cosmetic — no stat/mood
// effects — so it's registered at the LOWEST priority in the pig's `behaviors` list
// (pig/index.js), after seekFood/seekWater/seekStream/graze: a hungry or thirsty pig
// always tends to that first, and only wallows once she's content and idle.
//
// The pig otherwise reuses the horse behavior modules (seekFood/seekWater/seekStream/
// graze — see species/index.js BEHAVIORS.pig), so this file only adds the one thing
// unique to the pig.

// Content pig, off cooldown, daytime → flop and roll in the mud. Purely a random
// per-tick chance (like the dog's herd cooldown, not a need threshold) — "sometimes
// flops/rolls in a muddy spot" rather than anything hunger/thirst-driven.
export const wallow = {
  id: 'wallow',
  test: (ctx) =>
    !ctx.isNight &&
    (ctx.lastWallow == null || ctx.now - ctx.lastWallow > ctx.wallowCooldown) &&
    Math.random() < ctx.wallowChance,
  run: (scene, a) => scene.pigGoWallow(a),
};
