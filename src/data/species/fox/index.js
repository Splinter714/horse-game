// Fox species definition (#266). A TAMEABLE roster animal: a wild fox turns up
// ambient at the edge of the yard and is befriended over time by REPEATED FEEDING —
// each fox-food pile the player drops that the fox eats nudges a taming counter, and
// once it's been fed enough times the fox commits and joins the cared-for roster as a
// pet. Self-contained taming loop (NOT dependent on the bird-befriending #223) and NOT
// a predator threat — it never touches the chickens/bunnies.
//
// This mirrors the BUNNY's attract/roster shape (data/species/bunny): the roster
// starts EMPTY (rosters.js), a wild one joins at runtime (paddock/fox.js), and the
// join is capped. The one differentiator is the taming COUNTER — a bunny joins on the
// first food, a fox needs FOX_TAME_FEEDS feeds first, so it "warms up" to you.
//
// Care-wise, once tamed it's an ordinary grazer-shaped companion: hunger + thirst decay
// gently (kid-friendly) and it can be petted. It walks to dropped fox-food/water piles
// and eats via the shared grazing AI (the `grazes` capability), the same seam the cow
// and bunny use.

// How many times a wild fox must be fed before it commits to joining the roster. The
// pure taming counter (below) is unit-tested; the scene half (paddock/fox.js) persists
// the running count on the wild-fox state and, on the FOX_TAME_FEEDS-th feed, spawns
// the tamed fox. Small so the befriending pays off within a play session but still
// reads as "won over gradually" rather than instant like the bunny.
export const FOX_TAME_FEEDS = 3;

// Only ever one fox joins for now (a single den). Keyed `fox0` so the coat texture
// (art/index.js fox builder) is ready before it's attracted, exactly like the bunny.
export const FOX_CAP = 1;
export const FOX_KEY = 'fox0';

// Pure taming step (unit-tested in ./index.test.js). Given the wild fox's current feed
// count and whether the roster already has room, return the next state after ONE feed:
//   { count, tamed }
//     count — the running feed tally after this feed
//     tamed — true on the feed that reaches FOX_TAME_FEEDS (the commit moment), so the
//             caller spawns the roster fox exactly once; false while still warming up.
// `rosterFull` short-circuits (a fox already joined) — the counter freezes and never
// re-tames, so feeding an already-tamed fox just feeds it (no duplicate join).
export function feedWildFox(count, rosterFull = false, needFeeds = FOX_TAME_FEEDS) {
  if (rosterFull) return { count, tamed: false }; // already have our fox — no more taming
  const next = count + 1;
  return { count: next, tamed: next >= needFeeds };
}

export const FOX = {
  id: 'fox',
  defaults: {
    id: () => `fox-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Rusty', breed: 'Red Fox', coat: 'red', age: 1, sex: 'male',
  },
  // Hunger + thirst, restored at dropped fox-food/water piles via the shared grazing
  // AI (the same mechanic the bunny uses). Gentle, kid-friendly decay + forgiving
  // offline decay (rosters.js offlineDecay:true) so a fox is never neglected into misery.
  needs: {
    hunger: { decay: 0.05,  default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.045, default: 80, label: 'Water', color: 0x378add },
  },
  happiness: { default: 70, baseline: 55, driftRate: 0.004, label: 'Happy', color: 0x1d9e75 },
  // Feed/water are applied by the shared grazing AI when the fox reaches a dropped
  // pile (foxFood/water content, items.js); pet tops happiness up and fades.
  actions: {
    pet:   { stat: 'happiness', amount: 14, care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
  },
  dailyCare: { track: ['loved'], requiredForContentment: [] },
  mood: [
    [75, 'playful'],
    [50, 'content'],
    [25, 'wary'],
    [0,  'skittish'],
  ],
  traits: { personality: 'clever' },
  optionalAttrs: [],
  // Personality & preferences (#88 v1) — a fox's own vocabulary.
  personality: {
    pools: {
      activity: ['pouncing at nothing', 'trotting the fenceline', 'curled in a sunbeam', 'exploring', 'stalking a leaf'],
      food: ['berries', 'eggs', 'a bit of meat', 'crunchy kibble'],
      treat: ['a scrap of chicken', 'a wild berry', 'a nibble of cheese'],
    },
  },
  // `grazes` wires the shared food/water goal-tick at spawn (creatures.js) — a hungry
  // or thirsty fox heads for the nearest dropped pile before a plain wander, exactly
  // like the bunny/cow. No riding/leading/eggs.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, grazes: true },

  // Paddock "feel": foxes are quick and light-footed — brisk, frequent little trots
  // with short pauses, so the wander delays run shorter than the placid grazers.
  movement: {
    wanderMin: 2500,
    wanderMax: 6500,
  },

  // World spawn (#167 B4). `inWorld` so buildAnimals walks the (initially empty) roster;
  // once a fox is tamed (paddock/fox.js) it's added under FOX_KEY and lands where it was
  // won over. The static placements below are fallbacks near the north yard. 1× art
  // (super-sampled like the bunny/cat), roams the whole world.
  spawn: {
    inWorld: true,
    superSampled: true, // drawn on the ART_SCALE grid — display at S/ART_SCALE
    shadowScale: 0.3, walkFps: 7, tweenRate: 13, eatFps: 4, bodyR: 10,
    roam: 'world',
    placements: [
      { x: 340, y: 400 },
    ],
  },

  // Info-panel presentation: animated portrait (idle frames), an italic personality
  // line, and Food + Water + Love bars (rendered generically from `needs`). No action
  // buttons — care happens in-world (dropped piles + the Interact pet).
  panel: { portrait: 'animated', traitLine: 'personality', fixedAttrs: false },

  // AI priority list: a hungry/thirsty fox trots to the nearest reachable dropped
  // fox-food/water pile (seekFoxFood/seekFoxWater, ./behaviors.js) before its ordinary
  // wander. Same shape as the bunny's seekBunnyFood/seekBunnyWater.
  behaviors: ['seekFoxFood', 'seekFoxWater'],
};
