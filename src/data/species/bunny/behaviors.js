// Bunny AI behaviors (#224, reworked #283). Same { id, test, run } shape as the cat's
// modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads the context
//                       snapshot built by _bunnyContext (scenes/paddock/behaviors.js).
//   run(scene, agent)   SCENE-COUPLED — the shared pet-bowl eating primitive
//        -> bool        (petEatFromBowl, scenes/paddock/catAI.js), which is fully
//                       species-generic: it walks the animal to the bowl and applies
//                       whichever care action the bowl carries (food bowl → feed,
//                       water bowl → water), lowering the bowl's level.
//
// #283 rework — the bunny eats and drinks DIRECTLY from its food + water bowls, which
// the player keeps stocked (buildBunnyBowls). A hungry or thirsty bunny hops to its
// stocked bowl before its ordinary hop-wander (the wander is the implicit fallback
// when neither test fires). Directly mirrors the cat's seekFood/seekWater —
// `nearestFoodDist`/`nearestWaterDist` are Infinity when the bowl is empty
// (_catBowlDist), so an empty bowl reads as "nothing to seek" and the bunny just
// wanders instead of pacing an empty dish. No more gather-and-drop-on-the-ground piles.

const HUNGER_SEEK = 90;  // eat from the food bowl while hunger is below this
const THIRST_SEEK = 90;  // drink from the water bowl while thirst is below this
const BOWL_RANGE  = 1200; // …and the (stocked) bowl is within this many px

// Hungry → hop to the stocked bunny food bowl and eat a serving directly from it
// (petEatFromBowl). `nearestFoodDist` is Infinity when the bowl is empty, so this only
// fires when there's actually food in the dish.
export const seekBunnyFood = {
  id: 'seekBunnyFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestFoodDist < BOWL_RANGE,
  run: (scene, a) => scene.petEatFromBowl(a, scene.props.bunnyFoodBowl, 'feed'),
};

// Thirsty → hop to the stocked bunny water bowl and drink a serving directly from it
// (petEatFromBowl with the `water` action → restores thirst). `nearestWaterDist` is
// Infinity when the bowl is empty, so this only fires when there's water in the dish.
export const seekBunnyWater = {
  id: 'seekBunnyWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.nearestWaterDist < BOWL_RANGE,
  run: (scene, a) => scene.petEatFromBowl(a, scene.props.bunnyWaterBowl, 'water'),
};
