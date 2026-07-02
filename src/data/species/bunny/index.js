// Bunny species definition (#224). A small cared-for roster animal that arrives via
// placeable **bunny food** rather than the pet store or a random wild spawn: put a
// pile of bunny food out in the world and a bunny hops in and joins the roster. The
// roster is capped at one bunny per coat colour (grey / white / brown / black — 4),
// with the coat assigned randomly on arrival. Unlike every other species its default
// roster is EMPTY (rosters.js) — bunnies only exist once attracted (paddock/bunny.js
// `attractBunny`, fired from the generic `onFoodPlaced` hook when a bunnyFood pile is
// dropped).
//
// Care-wise it's an ordinary grazer-shaped companion: hunger + thirst decay gently
// (kid-friendly) and it can be petted. It walks to dropped bunny-food/water piles and
// eats via the shared grazing AI (the `grazes` capability), the same seam the cat and
// cow use. Its one movement differentiator is the HOP: its walk cycle is drawn as a
// bouncing hop (bunnyArt.js) rather than a plodding step, so it reads as a bunny in
// motion without any bespoke movement-engine code.

// The four coat colours, in order. This list is the single source of truth for both
// the cap (4) and the per-key coat assignment — bunny key `bunny<i>` always wears
// `BUNNY_COATS[i]`, so a persisted bunny keeps its colour across reloads. Palette
// swaps only (bunnyArt.js reads the id); the silhouette is identical.
export const BUNNY_COATS = ['grey', 'white', 'brown', 'black'];

// How many bunnies can ever join — one per coat colour.
export const BUNNY_CAP = BUNNY_COATS.length;

// Pure attraction/cap logic (unit-tested in ./index.test.js). Given the set of coat
// ids already taken by the current roster, pick the next bunny to add: a registry key
// (`bunny<i>` for the first free coat slot) and its coat id, chosen RANDOMLY among the
// still-available colours. Returns null when the roster is already full (cap reached),
// so the caller simply does nothing — the food pile is still dropped, no bunny joins.
//   takenCoats — array/Set of coat ids currently in the roster
//   rng        — () => [0,1) random source (injectable for deterministic tests)
export function nextBunny(takenCoats, rng = Math.random) {
  const taken = new Set(takenCoats);
  const free = BUNNY_COATS.filter((c) => !taken.has(c));
  if (!free.length) return null; // cap reached — no room for another bunny
  const coat = free[Math.floor(rng() * free.length)];
  const i = BUNNY_COATS.indexOf(coat);
  return { key: `bunny${i}`, coat, index: i };
}

export const BUNNY = {
  id: 'bunny',
  defaults: {
    id: () => `bunny-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Clover', breed: 'Cottontail', coat: 'grey', age: 1, sex: 'female',
  },
  // Hunger + thirst, both restored at dropped bunny-food/water piles via the shared
  // grazing AI (the same mechanic the cat's food/water bowls use). Gentle decay —
  // a touch gentler than the horse, kid-friendly — and forgiving offline decay
  // (rosters.js offlineDecay:true) so a bunny is never neglected into misery.
  needs: {
    hunger: { decay: 0.05,  default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 80, label: 'Water', color: 0x378add },
  },
  happiness: { default: 70, baseline: 55, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // Feed/water are applied by the shared grazing AI when the bunny reaches a dropped
  // pile (bunnyFood/bunnyWater content, items.js); pet tops happiness up and fades.
  actions: {
    pet:   { stat: 'happiness', amount: 14, care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'binky-happy'],
    [50, 'content'],
    [25, 'timid'],
    [0,  'wants attention'],
  ],
  traits: { personality: 'gentle' },
  optionalAttrs: [],
  // Personality & preferences (#88 v1) — a bunny's own vocabulary.
  personality: {
    pools: {
      activity: ['hopping about', 'nibbling clover', 'napping in the shade', 'exploring', 'binkying'],
      food: ['clover', 'carrots', 'fresh greens', 'hay'],
      treat: ['a bit of banana', 'a dandelion leaf', 'carrot tops'],
    },
  },
  // `grazes` wires the shared food/water goal-tick at spawn (creatures.js) — a hungry
  // or thirsty bunny heads for the nearest dropped pile before a plain wander, exactly
  // like the cow/cat. No riding/leading/eggs.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, grazes: true },

  // Paddock "feel": bunnies are quick and skittish — short, frequent hops with brief
  // pauses, so the wander delays run shorter than the placid grazers.
  movement: {
    wanderMin: 2500,
    wanderMax: 6500,
  },

  // World spawn (#167 B4). `inWorld` so buildAnimals walks the (initially empty)
  // roster; placements are per-key so an attracted bunny lands where its food pile
  // was dropped (attractBunny sets the model's spawn slot before rebuilding). The
  // static placements below are fallbacks near the north yard if a pile position is
  // unavailable. 1× art (like the chicken/cat), roams the whole world.
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.26, walkFps: 6, tweenRate: 14, eatFps: 4, bodyR: 9,
    roam: 'world',
    placements: [
      { x: 360, y: 360 }, { x: 420, y: 300 }, { x: 300, y: 420 }, { x: 480, y: 380 },
    ],
  },

  // Info-panel presentation: animated portrait (idle frames), an italic personality
  // line, and Food + Water + Love bars (rendered generically from `needs`). No action
  // buttons — care happens in-world (dropped piles + the Interact pet).
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list: a hungry/thirsty bunny walks to the nearest reachable dropped
  // bunny-food/water pile (seekBunnyFood/seekBunnyWater, ./behaviors.js) before its
  // ordinary hop-wander. Same shape as the cat's seekFood/seekWater.
  behaviors: ['seekBunnyFood', 'seekBunnyWater'],
};
