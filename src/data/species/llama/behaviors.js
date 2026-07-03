// Llama AI behaviors (#268). Same { id, test, run } shape as the other species'
// modules: `test` is pure (unit-tested in ./behaviors.test.js), `run` is the
// scene-coupled primitive (charm.js llamaGoSpit). Purely cosmetic — no stat/mood
// effects — so it's registered at the LOWEST priority in the llama's `behaviors` list
// (llama/index.js), after seekFood/seekWater/seekStream/graze: a hungry or thirsty
// llama always tends to that first, and only spits once she's content and idle.
//
// The llama otherwise reuses the horse grazer behavior modules (seekFood/seekWater/
// seekStream/graze — see species/index.js BEHAVIORS.llama), so this file only adds the
// one thing unique to the llama: her charming, harmless spitting quirk.

// Content llama, off cooldown, daytime → do a little harmless "ptooey" spit. Purely a
// random per-tick chance (like the pig's wallow / dog's herd cooldown, not a need
// threshold) — "sometimes spits" rather than anything hunger/thirst-driven. No harm,
// no target — just a charming puff of spit that arcs out and fizzles.
export const spit = {
  id: 'spit',
  test: (ctx) =>
    !ctx.isNight &&
    (ctx.lastSpit == null || ctx.now - ctx.lastSpit > ctx.spitCooldown) &&
    Math.random() < ctx.spitChance,
  run: (scene, a) => scene.llamaGoSpit(a),
};
