// Cat AI behaviors (#163). Same { id, test, run } shape as the horse modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads a context
//                       snapshot built by _catContext (scenes/paddock/behaviors.js).
//   run(scene, agent)   SCENE-COUPLED — reuses the cat fishing primitive in the
//        -> bool        WithCatAI mixin (scenes/paddock/catAI.js). Returns true when it
//                       claims the cat so the dispatcher stops (else falls to wander).
//
// The cat has no farmer-provided food: it feeds itself by hunting fish at the stream.
// So this is the cat's only need-driven behavior — when it's hungry (and it's daytime
// and a stream is reachable) it goes fishing; otherwise it falls through to its
// ordinary prowl/wander.

const HUNGER_HUNT = 55; // below this hunger, a daytime cat heads to the stream to fish

// Hungry → walk to the nearest stream bank and fish. `streamDist` is Infinity only
// when no stream is reachable at all (there always is one), so the gate is really
// "hungry + daytime". Night is excluded: the cat goes home to the barn to sleep
// (dayNight.js catGoHome) and shouldn't be lured back out to fish.
export const catFish = {
  id: 'catFish',
  test: (ctx) => !ctx.isNight && ctx.hunger < HUNGER_HUNT && ctx.streamDist < Infinity,
  run: (scene, a) => scene.catGoFish(a),
};
