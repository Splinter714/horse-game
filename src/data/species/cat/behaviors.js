// Cat AI behaviors (#163/#202). Same { id, test, run } shape as the horse modules:
//   test(ctx) -> bool   PURE (unit-tested in ./behaviors.test.js) — reads a context
//                       snapshot built by _catContext (scenes/paddock/catAI.js).
//   run(scene, agent)   SCENE-COUPLED — the cat's bowl-eating primitive
//        -> bool        (catEatFromBowl) or fishing primitive (catGoFish), both in
//                       WithCatAI (scenes/paddock/catAI.js). Returns true when it
//                       claims the cat so the dispatcher stops (else falls to wander).
//
// #202 rework — the cat eats and drinks DIRECTLY from its food + water bowls, which
// the player keeps stocked. `seekFood`/`seekWater` are checked first (registered
// ahead of `catFish` in cat/index.js `behaviors`): a hungry or thirsty cat walks to
// its stocked bowl and consumes from it. `nearestFoodDist`/`nearestWaterDist` are
// Infinity when the bowl is empty (_catBowlDist), so an empty food bowl lets a hungry
// cat fall back to fishing at the stream — which still never catches anything (#201),
// a distraction, not a food source — and an empty water bowl just leaves the cat to
// wander (thirst has no fishing fallback).

const HUNGER_SEEK = 90;  // eat from the food bowl while hunger is below this
const THIRST_SEEK = 90;  // drink from the water bowl while thirst is below this
const BOWL_RANGE  = 900; // …and the bowl is within this many px (it's a home bowl, always is)
const HUNGER_HUNT = 55;  // below this hunger, a daytime cat heads to the stream to try fishing

// Hungry → walk to the stocked food bowl and eat a serving directly from it
// (catEatFromBowl, WithCatAI). `nearestFoodDist` is Infinity when the bowl is empty,
// so this only fires when there's actually food in the dish (#202 rework).
export const seekFood = {
  id: 'seekFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestFoodDist < BOWL_RANGE,
  run: (scene, a) => scene.catEatFromBowl(a, scene.props.catFoodBowl, 'feed'),
};

// Thirsty → walk to the stocked water bowl and drink a serving directly from it
// (catEatFromBowl with the `water` action → restores thirst). `nearestWaterDist` is
// Infinity when the bowl is empty, so this only fires when there's water in the dish.
export const seekWater = {
  id: 'seekWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.nearestWaterDist < BOWL_RANGE,
  run: (scene, a) => scene.catEatFromBowl(a, scene.props.catWaterBowl, 'water'),
};

// Hungry with the food bowl empty → walk to the nearest stream bank and try to fish.
// NB the cat never actually catches a fish (#201), so fishing doesn't restore hunger —
// it's just a charming fallback loop while it waits for the bowl to be refilled.
// `streamDist` is Infinity only when no stream is reachable at all (there always is
// one), so the gate is really "hungry + daytime". Night is excluded: the cat goes
// home to the barn to sleep (dayNight.js catGoHome) and shouldn't be lured out to fish.
export const catFish = {
  id: 'catFish',
  test: (ctx) => !ctx.isNight && ctx.hunger < HUNGER_HUNT && ctx.streamDist < Infinity,
  run: (scene, a) => scene.catGoFish(a),
};
