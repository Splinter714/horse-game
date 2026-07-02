// Bunny AI behaviors (#224). Same { id, test, run } shape as the cat's modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads the context
//                       snapshot built by _bunnyContext (scenes/paddock/behaviors.js).
//   run(scene, agent)   SCENE-COUPLED — reuses the shared grazing primitive
//        -> bool        (horseGoEat, scenes/paddock/horseAI.js), which is fully
//                       content-generic: it applies whichever care action the pile's
//                       content maps to (bunnyFood → feed, bunnyWater → water).
//
// A hungry or thirsty bunny hops to the nearest reachable dropped bunny-food/water
// pile before its ordinary hop-wander (the wander is the implicit fallback when
// neither test fires). Directly mirrors the cat's seekFood/seekWater — the only
// difference is the content ids the piles carry.

const HUNGER_SEEK = 90;  // eat a dropped bunny-food pile while hunger is below this
const THIRST_SEEK = 90;  // drink a dropped bunny-water pile while thirst is below this
const PILE_RANGE  = 1200; // …and the nearest reachable pile is within this many px

// Hungry → hop to the nearest reachable dropped bunny-food pile and eat, via the
// shared grazing primitive (horseGoEat/_nearestReachableHay — species-generic despite
// the name, gated by speciesEatsContent so the bunny only walks to its own food).
export const seekBunnyFood = {
  id: 'seekBunnyFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestFoodDist < PILE_RANGE,
  run: (scene, a) => {
    const pile = scene._nearestReachableHay(a, 'bunnyFood');
    return pile ? scene.horseGoEat(a, pile) : false;
  },
};

// Thirsty → hop to the nearest reachable dropped bunny-water pile and drink, via the
// same shared grazing primitive wired to the `water` action (CONTENT_DEFS.bunnyWater
// .action === 'water'), so it restores thirst instead of hunger.
export const seekBunnyWater = {
  id: 'seekBunnyWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.nearestWaterDist < PILE_RANGE,
  run: (scene, a) => {
    const pile = scene._nearestReachableHay(a, 'bunnyWater');
    return pile ? scene.horseGoEat(a, pile) : false;
  },
};
