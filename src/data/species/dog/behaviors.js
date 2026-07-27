// Dog AI behaviors (#187 — cross-animal charm; #347 — feeding). Same { id, test, run }
// shape as the other species: `test` is pure (unit-tested in ./behaviors.test.js),
// `run` is the scene-coupled primitive (charm.js dogGoHerd, catAI.js petEatFromBowl).
//
// #347 — the dog now has real hunger/thirst, so its first priority is its own combined
// food+water bowl by the doghouse (worldObjects.js buildDogBowl): a hungry or thirsty
// dog trots over and eats/drinks a serving DIRECTLY from the stocked side, exactly like
// the cat and bunny. The bowl distances are Infinity when that side is empty
// (_catBowlDist), so an empty dish reads as "nothing to seek" and the dog just gets on
// with its herding/swimming/wandering rather than pacing an empty bowl.
//
// Its herding flavour is unchanged: when a sheep flock is within range and the per-dog
// cooldown has elapsed, it ambles over and noses the flock into a bunch, then loses
// interest. A fuller "dog job" is the bigger #186.

const HUNGER_SEEK = 90;   // eat from the food bowl while hunger is below this
const THIRST_SEEK = 90;   // drink from the water bowl while thirst is below this
const BOWL_RANGE  = 1200; // …and the (stocked) bowl is within this many px

// Hungry → trot to the stocked dog food bowl and eat a serving straight from it.
export const seekDogFood = {
  id: 'seekDogFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestFoodDist < BOWL_RANGE,
  run: (scene, a) => scene.petEatFromBowl(a, scene.props.dogBowl, 'food'),
};

// Thirsty → trot to the stocked dog water bowl and drink a serving from it
// (petEatFromBowl with the `water` action → restores thirst).
export const seekDogWater = {
  id: 'seekDogWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.nearestWaterDist < BOWL_RANGE,
  run: (scene, a) => scene.petEatFromBowl(a, scene.props.dogBowl, 'water'),
};

// Sheep nearby (and off cooldown) → amble over and bunch the flock. nearestSheepDist
// is Infinity unless at least one sheep is within herding range (the scene context
// applies that range when building it), so this is really "sheep in range + not on
// cooldown + daytime". Night is excluded — the dog beds down then.
export const dogHerdSheep = {
  id: 'dogHerdSheep',
  test: (ctx) =>
    !ctx.isNight &&
    ctx.nearestSheepDist < Infinity &&
    (ctx.lastHerd == null || ctx.now - ctx.lastHerd > ctx.herdCooldown),
  run: (scene, a) => scene.dogGoHerd(a),
};
