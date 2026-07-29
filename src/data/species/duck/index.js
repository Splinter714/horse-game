// Duck species definition (#275). A WILD-STYLE roster animal, mirroring the fox
// (../fox/index.js): a duck turns up ambient near the stream and is befriended over
// time by REPEATED FEEDING — each duck-food pile the player drops that the duck eats
// nudges a taming counter, and once it's been fed enough times it commits and joins
// the cared-for roster. Resolved scope (#275): no dedicated pond feature, no duck-egg
// produce in v1 — just the wild→attract→roster loop plus swimming.
//
// The one thing a duck adds beyond the fox pattern: it SWIMS. That's not new behavior
// code — it's the generic stream-swim charm (../swim.js, #231) reused verbatim via the
// `swims` capability + this species' own `${key}_swim_0/1` art frames (art/duckArt.js).
// A tamed duck is otherwise an ordinary grazer-shaped companion: hunger + thirst decay
// gently and it can be petted; it walks to dropped duck-food/water piles via the shared
// grazing AI (the `grazes` capability), the same seam the fox/cow/bunny use, PLUS it
// occasionally wanders to the stream and takes a swim (the `swims` capability).

// How many times a wild duck must be fed before it commits to joining the roster.
// Mirrors FOX_TAME_FEEDS — small so the befriending pays off within a play session but
// still reads as "won over gradually" rather than instant like the bunny.
export const DUCK_TAME_FEEDS = 3;

// Two ducks can ever join — one male, one female (#409). Mirrors the bunny's
// one-per-coat cap (BUNNY_COATS/nextBunny, data/species/bunny/index.js): a fixed list
// of variants, one registry key per slot (`duck<i>`), so a persisted duck's sex/look
// stays stable across reloads and the art (art/index.js duck builder) can be built for
// every slot up front — a tamed duck always spawns into a key whose texture already
// exists, no runtime art build. Puddle (the original single duck, mallard-drake
// plumage) keeps his existing key/look; Willow is the new hen-coloured female.
export const DUCK_VARIANTS = [
  { sex: 'male',   coat: 'mallard', name: 'Puddle' },
  { sex: 'female', coat: 'hen',     name: 'Willow' },
];
export const DUCK_KEYS = DUCK_VARIANTS.map((_, i) => `duck${i}`);
export const DUCK_CAP = DUCK_VARIANTS.length;

// Pure taming step (unit-tested in ./index.test.js) — identical shape to feedWildFox.
// Given the wild duck's current feed count and whether the roster already has room,
// return the next state after ONE feed: { count, tamed }.
export function feedWildDuck(count, rosterFull = false, needFeeds = DUCK_TAME_FEEDS) {
  if (rosterFull) return { count, tamed: false }; // already have our duck — no more taming
  const next = count + 1;
  return { count: next, tamed: next >= needFeeds };
}

// Pure attraction/cap logic (mirrors nextBunny, data/species/bunny/index.js). Given
// the sexes already in the roster, pick the next wild duck to lure in: its registry
// key (`duck<i>`), sex, coat and default name, chosen RANDOMLY among the still-free
// sexes. Returns null once both slots are taken.
//   takenSexes — array/Set of sexes currently in the roster
//   rng        — () => [0,1) random source (injectable for deterministic tests)
export function nextDuck(takenSexes, rng = Math.random) {
  const taken = new Set(takenSexes);
  const free = DUCK_VARIANTS.filter((v) => !taken.has(v.sex));
  if (!free.length) return null; // cap reached — no room for another duck
  const variant = free[Math.floor(rng() * free.length)];
  const index = DUCK_VARIANTS.indexOf(variant);
  return { key: `duck${index}`, index, ...variant };
}

export const DUCK = {
  id: 'duck',
  defaults: {
    id: () => `duck-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Puddle', breed: 'Mallard', coat: 'mallard', age: 1, sex: 'male',
  },
  // Hunger + thirst, restored at dropped duck-food/water piles via the shared grazing
  // AI (the same mechanic the fox/bunny use). Gentle, kid-friendly decay + forgiving
  // offline decay (rosters.js offlineDecay:true) so a duck is never neglected into misery.
  needs: {
    hunger: { decay: 0.05,  default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 80, label: 'Water', color: 0x378add },
  },
  happiness: { default: 70, baseline: 55, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // Feed/water are applied by the shared grazing AI when the duck reaches a dropped
  // pile (duckFood/water content, items.js); pet tops happiness up and fades.
  actions: {
    pet:   { stat: 'happiness', amount: 14, care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'chipper'],
    [50, 'content'],
    [25, 'wary'],
    [0,  'skittish'],
  ],
  traits: { personality: 'sprightly' },
  optionalAttrs: [],
  // Personality & preferences (#88 v1) — a duck's own vocabulary.
  personality: {
    pools: {
      activity: ['paddling the stream', 'preening feathers', 'dabbling for bugs', 'waddling about', 'napping on the bank'],
      food: ['pond weed', 'bread crumbs', 'seeds', 'crunchy bugs'],
      treat: ['a bit of corn', 'a leafy green', 'a crust of bread'],
    },
  },
  // `grazes` wires the shared food/water goal-tick at spawn (creatures.js) — a hungry
  // or thirsty duck heads for the nearest dropped pile before a plain wander, exactly
  // like the fox/bunny. `swims` layers in the generic stream-swim charm (../swim.js,
  // #231) — the whole point of the duck: a content, off-cooldown duck occasionally
  // wanders to the stream and takes a swim. No riding/leading/eggs.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, grazes: true, swims: true },

  // Paddock "feel": ducks waddle — a touch slower and choppier than the bunny's hop,
  // frequent short wanders near the water's edge.
  movement: {
    wanderMin: 2500,
    wanderMax: 6500,
  },

  // World spawn (#167 B4). `inWorld` so buildAnimals walks the (initially empty)
  // roster; once a duck is tamed (paddock/duck.js) it's added under its slot key
  // (`duck0`/`duck1`, #409) and lands where it was won over. The static placements
  // below sit near the stream bank (world.js buildStream runs through ~x:1430-2140,
  // y:-60..380), matching the "shows up around the stream" resolved scope. 1× art
  // (super-sampled like the bunny/fox), roams the whole world so it can reach the
  // stream from anywhere.
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.24, walkFps: 6, tweenRate: 13, eatFps: 4, bodyR: 8,
    roam: 'world',
    placements: [
      { x: 1650, y: 330 }, { x: 1780, y: 300 },
    ],
  },

  // Info-panel presentation: animated portrait (idle frames), an italic personality
  // line, and Food + Water + Love bars (rendered generically from `needs`). No action
  // buttons — care happens in-world (dropped piles + the Interact pet).
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list: a hungry/thirsty duck waddles to the nearest reachable dropped
  // duck-food/water pile (seekDuckFood/seekDuckWater, ./behaviors.js) before its
  // generic stream swim (swimStream, ../swim.js) or its ordinary wander. Same shape
  // as the fox's seekFoxFood/seekFoxWater, with the swim layered on at low priority
  // (the same slot the pig wallow / llama spit occupy).
  behaviors: ['seekDuckFood', 'seekDuckWater', 'swimStream'],
};
