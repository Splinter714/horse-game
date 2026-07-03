// Fox AI behaviors (#266). Same { id, test, run } shape as the horse/bunny modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads the context
//                       snapshot the dispatcher builds for the fox (it rides the shared
//                       grazer `_horseContext`, so it carries hunger/thirst plus the
//                       distance to the nearest reachable dropped pile / filled trough).
//   run(scene, agent)   SCENE-COUPLED — reuses the shared grazing movement primitives
//        -> bool        (horseGoEat / horseGoDrink), so a tamed fox trots to the nearest
//                       dropped FOX-FOOD pile and eats, exactly like a cow/sheep grazes.
//                       `_nearestReachableHay` already respects the fox's diet (only
//                       foxFood piles pass `speciesEatsContent('fox', …)`), so the fox
//                       walks past hay/apples and heads for its own food.
//
// This is the "approach and eat" behavior the taming loop pays off into: once the wild
// fox commits to the roster (paddock/fox.js), it lives as a grazer that seeks the same
// fox-food piles that won it over. The wild-phase taming/approach itself is scene-coupled
// (paddock/fox.js) and driven by the pure `feedWildFox` counter (./index.js), not a
// behavior module — a behavior only runs for an already-spawned roster agent.

const HUNGER_SEEK = 90;   // trot to a dropped fox-food pile while hunger is below this
const FOOD_RANGE  = 700;  // …and the nearest reachable pile is within this many px
const THIRST_SEEK = 90;   // drink from the filled trough while thirst is below this
const TROUGH_RANGE = 1000; // …and it's within this many px

// Hungry → trot to the nearest reachable dropped fox-food pile and eat it. The context's
// `nearestHayDist` is Infinity when there's no fox-food pile the fox can reach (the diet
// gate in `_nearestReachableHay` filters to foxFood), so this only fires when there's
// actually food out for it.
export const seekFoxFood = {
  id: 'seekFoxFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestHayDist < FOOD_RANGE,
  run: (scene, a) => {
    const pile = scene._nearestReachableHay(a);
    return pile ? scene.horseGoEat(a, pile) : false;
  },
};

// Thirsty → drink at the filled trough. `troughDist` is Infinity unless the trough is
// filled (and the fox roams the whole world, so no gate gating), mirroring the horse's
// seekWater. Lower priority than food (its later slot in the `behaviors` list).
export const seekFoxWater = {
  id: 'seekFoxWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.troughDist < TROUGH_RANGE,
  run: (scene, a) => scene.horseGoDrink(a),
};
