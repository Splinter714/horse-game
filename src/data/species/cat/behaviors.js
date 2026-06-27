// Cat AI behaviors (#163). Same { id, test, run } shape as the horse modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads a context
//                       snapshot built by _catContext (scenes/paddock/behaviors.js).
//   run(scene, agent)   SCENE-COUPLED — reuses the cat fishing primitive in the
//        -> bool        WithCatAI mixin (scenes/paddock/catAI.js). Returns true when it
//                       claims the cat so the dispatcher stops (else falls to wander).
//
// The cat's only need-driven behavior — when it's hungry (and it's daytime and a
// stream is reachable) it goes to the stream to try fishing; otherwise it falls
// through to its ordinary prowl/wander. NB the cat never actually catches a fish
// (#201), so fishing doesn't restore hunger — the gate still fires whenever it's
// hungry, so a hungry cat keeps heading to the stream to try. (A real feed mechanic
// is follow-up #202.)

const HUNGER_HUNT = 55; // below this hunger, a daytime cat heads to the stream to try fishing

// Hungry → walk to the nearest stream bank and try to fish. `streamDist` is Infinity
// only when no stream is reachable at all (there always is one), so the gate is really
// "hungry + daytime". Night is excluded: the cat goes home to the barn to sleep
// (dayNight.js catGoHome) and shouldn't be lured back out to fish.
export const catFish = {
  id: 'catFish',
  test: (ctx) => !ctx.isNight && ctx.hunger < HUNGER_HUNT && ctx.streamDist < Infinity,
  run: (scene, a) => scene.catGoFish(a),
};
