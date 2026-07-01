// Cat AI behaviors (#163/#202). Same { id, test, run } shape as the horse modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads a context
//                       snapshot built by _catContext (scenes/paddock/catAI.js).
//   run(scene, agent)   SCENE-COUPLED — reuses the shared eating primitive
//        -> bool        (horseGoEat, scenes/paddock/horseAI.js) or the cat fishing
//                       primitive (WithCatAI, scenes/paddock/catAI.js). Returns true
//                       when it claims the cat so the dispatcher stops (else falls to
//                       wander).
//
// `seekFood` is checked first (registered ahead of `catFish` in cat/index.js
// `behaviors`): a hungry cat prefers walking to real dropped food over the cosmetic
// fishing loop. Only when no fish pile is reachable does it fall back to fishing at
// the stream — which still never actually catches anything (#201), so it's a
// fallback distraction, not a food source.

const HUNGER_SEEK = 90;  // eat a dropped fish pile while hunger is below this
const FISH_RANGE  = 900; // …and the nearest reachable pile is within this many px
const HUNGER_HUNT = 55;  // below this hunger, a daytime cat heads to the stream to try fishing

// Hungry → walk to the nearest reachable dropped fish pile and eat, via the shared
// grazing primitive (horseGoEat/_nearestReachableHay — species-generic despite the
// filename, gated by speciesEatsContent so the cat only ever walks to fish, #202).
export const seekFood = {
  id: 'seekFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestFishDist < FISH_RANGE,
  run: (scene, a) => {
    const pile = scene._nearestReachableHay(a);
    return pile ? scene.horseGoEat(a, pile) : false;
  },
};

// Hungry with no fish out → walk to the nearest stream bank and try to fish. NB the
// cat never actually catches a fish (#201), so fishing doesn't restore hunger — this
// is just a charming fallback loop while it waits for real food. `streamDist` is
// Infinity only when no stream is reachable at all (there always is one), so the gate
// is really "hungry + daytime". Night is excluded: the cat goes home to the barn to
// sleep (dayNight.js catGoHome) and shouldn't be lured back out to fish.
export const catFish = {
  id: 'catFish',
  test: (ctx) => !ctx.isNight && ctx.hunger < HUNGER_HUNT && ctx.streamDist < Infinity,
  run: (scene, a) => scene.catGoFish(a),
};
