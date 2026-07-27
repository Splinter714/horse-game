// Llama / Alpaca species definition (#268) — drives the generic Animal model
// (../../Animal.js). Everything about the animal lives in this folder: this definition,
// the model class (model.js), and the AI (behaviors.js); the procedural art is the one
// exception and lives in src/art/llamaArt.js.
//
// ONE species, TWO appearance variants (like horse coats): a tall LLAMA and a rounder,
// fluffier ALPACA. The variant is data on the roster individual (rosters.js), read by
// the art builder (art/index.js) — the game logic is identical for both.
//
// Like the sheep, the llama is a placid GRAZER (opts into the shared herbivore food/
// water AI via the `grazes` capability) and a FLEECE PRODUCER (shearable on a regrowth
// timer, mirroring the sheep's wool).
//
// Note: she originally also had a charming SPITTING quirk (a purely cosmetic,
// harmless "ptooey", like the pig's wallow) — turned off per playtest feedback
// (2026-07-26, #268). The behavior module, its test, and the scene-side primitive
// were removed rather than just unlisted, since nothing else referenced them.

// The two appearance variants, indexed by roster `coat` slot (0 = llama, 1 = alpaca).
// Exported so the art builder (art/index.js) can map coat → variant without hardcoding.
export const LLAMA_VARIANTS = ['llama', 'alpaca'];

export const LLAMA = {
  id: 'llama',
  defaults: {
    id: () => `llama-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Kuzco', breed: 'Llama', coat: 0, age: 4, sex: 'female',
  },

  // Per-second decay while playing. Placid grazers — gentle hunger/thirst, like the
  // sheep. Grooming is omitted (the brush only targets horses); the llama is fed/watered
  // by the grazing AI and loved via Interact.
  needs: {
    hunger: { decay: 0.048, default: 80, label: 'Food',  color: 0x63a31d },
    thirst: { decay: 0.043, default: 78, label: 'Water', color: 0x378add },
  },
  // Derived love bar — drifts toward the average of the needs above, gentle so a pet's
  // bump lingers (mirrors the sheep/cow/pig, #105).
  happiness: { default: 85, driftRate: 0.006, label: 'Love', color: 0x1d9e75 },

  // Care actions. Feed/water are applied by the grazing/drinking AI (she walks to
  // dropped hay and to the trough/stream); pet is the Interact action.
  actions: {
    feed:  { stat: 'hunger',    amount: 35, care: 'fed',     label: 'Feed',  sound: 'eat',   icon: 'iconFeed'  },
    water: { stat: 'thirst',    amount: 40, care: 'watered', label: 'Water', sound: 'drink', icon: 'iconWater' },
    pet:   { stat: 'happiness', amount: 7,  care: 'loved',   label: 'Love',  sound: 'chime', icon: 'iconHeart' },
  },

  // Produce (#268, mirrors the sheep #233): shearing yields raw wool into a BASKET
  // (a solid, like eggs — `carrier: 'basket'`). Wool is on a REGROWTH TIMER (`mode:
  // 'cooldown'`): shearable again once `cooldownMs` has elapsed. Between shearing and
  // regrowth she shows a shorn look (art `look.shorn`). The generic Animal model reads
  // this for canProduce/markProduced/isShorn; the generic care dispatch reads verb/
  // sound/icon/carrier to label the Use prompt, play the harvest sound, and float the
  // icon — all data, no llama code. `readyAtStart` lets a fresh llama be sheared right
  // away. Raw wool sells at the stand, or spins into yarn at the spinning wheel.
  // `requiresTool: 'shear'` (playtest 2026-07-24, mirrors the sheep #233): a bare
  // basket may no longer harvest wool directly — the shears tool (#254) is required.
  produces: {
    content: 'wool', mode: 'cooldown', cooldownMs: 6 * 60 * 1000,
    carrier: 'basket', readyAtStart: true, requiresTool: 'shear',
    verb: 'Shear', sound: 'brush', icon: 'iconBasketWool',
  },

  // Track these care flags each day; missing any (yesterday) makes her wake neglected.
  dailyCare: { track: ['fed', 'watered', 'loved'], requiredForContentment: ['fed', 'watered', 'loved'] },

  // Happiness → friendly label (highest threshold met wins).
  mood: [
    [80, 'happy'],
    [55, 'content'],
    [30, 'a bit down'],
    [0,  'needs you'],
  ],

  traits: {},
  optionalAttrs: [],
  // `grazes` opts her into the shared herbivore feeding/drinking AI (creatures.js /
  // horseAI.js): she walks to dropped hay, drinks at the trough/stream, and nibbles
  // grass — the same primitives the horses/cow/pig/sheep use.
  capabilities: { saddleable: false, rideable: false, leadable: false, laysEggs: false, milkable: false, grazes: true },

  // Paddock "feel" knobs read by the scene movement primitives (creatures.js).
  // Llamas amble in an unhurried, curious plod.
  movement: {
    wanderMin: 4000,
    wanderMax: 9000,
  },

  // World spawn (#167 B4) — read by creatures.js buildAnimals. Models come from the
  // allLlamas roster; `roam: 'pasture'` keeps them in the paddock; `grazes` wires the
  // shared food/water goal tick at spawn. The art is super-sampled (drawn on the
  // ART_SCALE grid like the horse/sheep), so `superSampled` displays it at S/ART_SCALE.
  // No dedicated eat frames, so eatFps aliases the idle pose (like the sheep/cow/pig).
  spawn: {
    inWorld: true,
    superSampled: true,
    shadowScale: 0.5, walkFps: 4, tweenRate: 13, eatFps: 6, bodyR: 14,
    roam: 'pasture',
    // One placement per roster individual: the llama and the alpaca, up in the pasture
    // near the sheep flock.
    // #349 moved these east out of the enlarged barn's ORIGINAL placeholder
    // footprint (x 210-890, y 900-1360) — but the owner then repositioned the
    // barn itself (#330 drag tool) to (1399, 1306), whose actual collision covers
    // x 1075-1723, y 962-1302, right back over both these spots. Moved west of
    // the barn instead (2026-07-27, part of the same spawn-point sweep as the
    // horse/cow/pig fixes).
    placements: [
      { x: 700, y: 1000 },   // llama0 (llama)
      { x: 820, y: 1120 },   // llama1 (alpaca)
    ],
  },

  // Info-panel presentation: animated portrait (idle frames), stat bars from `needs`
  // + the love bar. No trait line, no fixed attrs.
  panel: { portrait: 'animated', fixedAttrs: false },

  // AI priority list, highest first. The llama reuses the horse grazer behavior modules
  // (registered as BEHAVIORS.llama in ../index.js) — seek dropped hay, drink at the
  // trough/stream, graze the grass. (No more `spit` entry — see note above, #268.)
  // `seekShelter` (#349) sits after the real needs and before ambient grazing: rain
  // sends her into the barn until it clears.
  behaviors: ['seekFood', 'seekWater', 'seekStream', 'seekShelter', 'graze'],
};
