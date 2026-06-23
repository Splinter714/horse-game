// Horse AI behaviors — the data-driven port of the old `horseTickForHorse` if-ladder
// (src/scenes/paddock/horseAI.js). Each module is { id, test, run }:
//
//   test(ctx) -> bool   PURE: a plain context snapshot in, may-I-fire out. Unit-tested
//                       (./behaviors.test.js). No Phaser/scene dependency.
//   run(scene, agent)   SCENE-COUPLED: actually start the behavior, reusing the
//        -> bool        existing movement primitives unchanged. Returns true if it
//                       claimed the horse (so the dispatcher stops walking the list),
//                       false if it bailed (e.g. the hay pile was already taken) so a
//                       lower-priority behavior — or wander — gets a turn.
//
// The thresholds below mirror the original hand-coded values exactly; this is a
// behavior-neutral refactor. Begging thresholds come in via ctx because they're
// shared with the begging primitive (BEG in scenes/paddock/constants.js).

const HUNGER_SEEK = 95;   // eat hay while hunger is below this
const HAY_RANGE   = 700;  // …and the nearest reachable pile is within this many px
const THIRST_SEEK = 95;   // drink while thirst is below this
const TROUGH_RANGE = 1000; // …and the filled trough is within this many px

// Hungry → walk to the nearest reachable hay pile and eat. ctx.nearestHayDist is
// Infinity when there's no pile the horse can get to (none exist, or the only ones
// are outside a shut gate), folding the old "hayPiles>0 && reachable" checks in.
export const seekFood = {
  id: 'seekFood',
  test: (ctx) => ctx.hunger < HUNGER_SEEK && ctx.nearestHayDist < HAY_RANGE,
  run: (scene, h) => {
    const pile = scene._nearestReachableHay(h);
    return pile ? scene.horseGoEat(h, pile) : false;
  },
};

// Thirsty → drink at the trough. ctx.troughDist is Infinity unless the trough is
// filled and inside the pasture, folding the old guards in.
export const seekWater = {
  id: 'seekWater',
  test: (ctx) => ctx.thirst < THIRST_SEEK && ctx.troughDist < TROUGH_RANGE,
  run: (scene, h) => scene.horseGoDrink(h),
};

// Hungry → go find the player and beg. Lazy horses can't be bothered. With the gate
// shut we only bother if the player is fairly near. Throttled per horse. (issue #26)
export const begPlayer = {
  id: 'begPlayer',
  test: (ctx) =>
    ctx.hunger < ctx.begHunger &&
    ctx.temperament !== 'lazy' &&
    ctx.hasPlayer &&
    (ctx.gateOpen || ctx.playerDist < ctx.begNoticeDist) &&
    (ctx.lastSeek == null || ctx.now - ctx.lastSeek > ctx.begThrottleMs),
  run: (scene, h) => {
    if (scene._horseBeg(h)) { h._lastSeek = scene.time.now; return true; }
    return false;
  },
};
