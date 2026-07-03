// Duck AI behaviors (#275). Same { id, test, run } shape as the fox/bunny modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads the context
//                       snapshot the dispatcher builds for the duck (_duckContext,
//                       scenes/paddock/behaviors.js), which carries hunger/thirst plus
//                       the distance to the nearest reachable dropped pile / filled
//                       trough / stream (the last for the generic swimStream, ../swim.js).
//   run(scene, agent)   SCENE-COUPLED — reuses the shared grazing movement primitives
//        -> bool        (horseGoEat / horseGoDrink), so a tamed duck waddles to the
//                       nearest dropped DUCK-FOOD pile and eats, exactly like a fox
//                       grazes. `_nearestReachableHay` already respects the duck's diet
//                       (only duckFood piles pass `speciesEatsContent('duck', …)`), so
//                       the duck walks past hay/apples and heads for its own food.
//
// This is the "approach and eat" behavior the taming loop pays off into: once the wild
// duck commits to the roster (paddock/duck.js), it lives as a grazer that seeks the same
// duck-food piles that won it over, PLUS the generic swimStream behavior (registered in
// species/index.js's BEHAVIORS map) for an occasional dip. The wild-phase taming/approach
// itself is scene-coupled (paddock/duck.js) and driven by the pure `feedWildDuck` counter
// (./index.js), not a behavior module — a behavior only runs for an already-spawned agent.

const HUNGER_SEEK = 90;   // waddle to a dropped duck-food pile while hunger is below this
const FOOD_RANGE  = 700;  // …and the nearest reachable pile is within this many px
const THIRST_SEEK = 90;   // drink from the filled trough while thirst is below this
const TROUGH_RANGE = 1000; // …and it's within this many px

// Hungry → waddle to the nearest reachable dropped duck-food pile and eat it. The
// context's `nearestHayDist` is Infinity when there's no duck-food pile the duck can
// reach (the diet gate in `_nearestReachableHay` filters to duckFood), so this only
// fires when there's actually food out for it.
export const seekDuckFood = {
  id: 'seekDuckFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestHayDist < FOOD_RANGE,
  run: (scene, a) => {
    const pile = scene._nearestReachableHay(a);
    return pile ? scene.horseGoEat(a, pile) : false;
  },
};

// Thirsty → drink at the filled trough. `troughDist` is Infinity unless the trough is
// filled, mirroring the fox's seekFoxWater. Lower priority than food (its later slot in
// the `behaviors` list), and both take priority over the swim (purely cosmetic).
export const seekDuckWater = {
  id: 'seekDuckWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.troughDist < TROUGH_RANGE,
  run: (scene, a) => scene.horseGoDrink(a),
};
