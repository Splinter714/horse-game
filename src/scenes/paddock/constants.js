// Shared tuning constants for PaddockScene and its concern mixins (./paddock/*).
// Centralised here so the scene file and every extracted mixin read one source of
// truth (and so balance/layout values are easy to find and tweak).

// World dimensions. The playable farm/pasture occupies x ∈ [0, WORLD_W]; the
// riding trail (#36) extends the SAME continuous world further west, so the
// world's true left edge is TRAIL_X0 (negative) rather than 0. No new Phaser
// scene — walking past x=0 just keeps going in PaddockScene, camera and all.
export const WORLD_W = 1920;
export const WORLD_H = 1600;

// ── Riding trail (#36) ──────────────────────────────────────────────────────
// A continuous westward extension of the farm/pasture world — no loading
// screen, no scene swap (unlike the house interior). Farm-stand customers
// already enter from the EAST edge (WORLD_W), so the trail goes west to avoid
// colliding with that entry point. TRAIL_X0 is negative (world-space x can go
// below 0 once the trail is added) and TRAIL_W is how far it extends.
// Widened per the 2026-07-06 playtest ("make the trail bigger — a long loop,
// not the short stretch") — nearly double the original 900, with more vertical
// room too so the loop path (trail.js) has space to curve around and back.
export const TRAIL_W = 1700;
export const TRAIL_X0 = -TRAIL_W;
// The trail occupies a wide band (not the full world height) so it still
// reads as a path leading off into the woods rather than a second full map —
// widened from the original 880px band to give the loop shape room to curve.
export const TRAIL_Y0 = 60;
export const TRAIL_Y1 = 1240;

// ── Town (#222) ─────────────────────────────────────────────────────────────
// A continuous EASTward extension of the farm/pasture world — same technique as
// the riding trail (#36), just the opposite edge: no loading screen, no scene
// swap. The farm-stand customer and neighbor NPC already walk in from the east
// edge (WORLD_W - 20, see paddock/farmStand.js / paddock/neighbor.js), so they
// now narratively read as coming FROM town — no change needed to their spawn
// logic, this just builds the space they're walking in from. TOWN_X0 is the
// world-space x where town terrain starts (== WORLD_W, the old east edge) and
// TOWN_W is how far it extends; TOWN_X1 is the new outer edge.
export const TOWN_W  = 900;
export const TOWN_X0 = WORLD_W;
export const TOWN_X1 = WORLD_W + TOWN_W;
// Same vertical band as the farm (not the full world height), so it reads as a
// street leading off into town rather than a second full map.
export const TOWN_Y0 = 120;
export const TOWN_Y1 = 1000;

// Movement.
export const INTERACT_DIST = 100;
// Reach for the "care" interactions (petting and brushing). Much larger than
// INTERACT_DIST so you can quickly tend a whole crowd of animals — the prompt
// keeps targeting the nearest still-uncared-for one until they're all done,
// without making you stand right on top of each.
export const CARE_DIST = 200;
// Range at which a horse voices its mood as you walk up (squeal if neglected,
// nicker if content) — a touch wider than CARE_DIST so the greeting reads before
// you're right on top of it.
export const GREET_DIST = 260;
// Minimum gap between petting nickers, so rapidly petting one horse doesn't
// machine-gun the sound (each pet still lands its happiness + heart).
export const PET_SOUND_MS = 500;
// In-place reach for using a tool on an animal (brush/saddle/lead, cow care). Use
// never walks you anywhere — the animal has to already be within this range.
export const USE_REACH = 110;
export const PLAYER_SPEED  = 210;
export const RIDE_SPEED    = 340;
// Drivable tractor (#264): faster than walking, slower than a ridden horse — a
// first-pass balance number, flag for playtest.
export const TRACTOR_SPEED = 260;

// Press shorter than this (without dragging) is a plain tap → walk all the way to
// the tapped point. Once the press passes this, live "hold-to-move" steering kicks
// in and releasing stops you where you are.
export const HOLD_MS = 250;
// The finger must travel at least this far (screen px) before a press counts as a
// drag — keeps tiny tap jitter from being read as intentional hold-to-move.
export const HOLD_DRAG_PX = 28;

// Wander/spawn bounds and the pasture rectangle. Farm-roster animals (herd/flock)
// stay within the farm proper (BOUNDS) — only the PLAYER's walkable/ridable area
// (PLAYER_BOUNDS) extends west into the trail (#36) and east into town (#222), so
// horses/chickens don't wander off into the woods or into town on their own.
export const BOUNDS         = { minX: 180, maxX: 1740, minY: 200, maxY: 900 };
export const PLAYER_BOUNDS  = { minX: TRAIL_X0 + 40, maxX: TOWN_X1 - 40, minY: 80, maxY: 1550 };
export const PASTURE_BOUNDS = { minX: 180, maxX: 1740, minY: 910, maxY: 1450 };

// Water trough capacity, in "drinks" (#103). The trough holds a numeric water
// level 0..TROUGH_CAP; each poured bucket raises it by TROUGH_PER_BUCKET and each
// horse drink lowers it by one. CAP/PER_BUCKET = 3 buckets to fill from empty.
export const TROUGH_CAP = 9;
export const TROUGH_PER_BUCKET = 3;

// Cat food + water bowls (#202 rework). Each bowl holds a numeric level 0..BOWL_CAP
// in "servings": the player refilling it (a scoop of cat food / a pour of water)
// tops it to BOWL_CAP, and each meal the cat takes lowers it by one. The bowl sprite
// swaps between its filled and empty texture as the level crosses zero.
export const BOWL_CAP = 4;

// Gate opening in the top pasture fence (the only gap; gate sits here).
export const GATE_X = 960;
export const GATE_GAP_X0 = 900;
export const GATE_GAP_X1 = 1020;
export const GATE_HALF_W = (GATE_GAP_X1 - GATE_GAP_X0) / 2; // 60 — half the gate opening, each fence end's offset from GATE_X

// Global sprite scale.
export const S = 2;

// The 'fence' texture (worldArt.js) is one repeating unit of "post (near the
// left edge, x2-6) + rail spanning the FULL tile width to connect to the NEXT
// post". #372 rework: house-fence posts are now ALWAYS cropped to just the post
// column (no per-tile rail baked in at all, not even an end-cap special case) —
// the rails themselves are drawn separately as two continuous line segments
// spanning the whole run (see FENCE_RAIL_* below), so no post sprite needs its
// own rail slice.
export const FENCE_TEX_W = 48;   // native texture px (96 world px at S)
export const FENCE_TEX_H = 24;
export const FENCE_POST_CROP_W = 8; // native px: just enough to keep the post, drop the rail

// House-fence rail lines (#372 rework — replaces the earlier per-tile rotated-
// sprite rail approach). A continuous Graphics line per rail follows any run
// angle with zero per-tile rotation math and reaches exactly post-to-post (no
// dangling end past the last post, unlike a fixed-length tile sprite).
// Offsets/colors are read off the 'fence' texture's two rail bands (worldArt.js:
// top rail native y 6-9, bottom rail native y 14-17, texture vertical center at
// y=12, scaled by S) so a horizontal run's lines land exactly where the old
// per-tile rails used to.
export const FENCE_RAIL_TOP_OFFSET    = -9; // screen px from a post's y (its vertical center) to the top rail
export const FENCE_RAIL_BOTTOM_OFFSET = 7;  // screen px from a post's y to the bottom rail
export const FENCE_RAIL_THICKNESS     = 6;  // screen px (native rail band height 3 * S)
export const FENCE_RAIL_TOP_COLOR     = 0xc8924c;
export const FENCE_RAIL_BOTTOM_COLOR  = 0xbc8442;

// #375 z-order split: the native 'fence' texture row where the post crosses
// the TOP rail's centerline (mirrors FENCE_RAIL_TOP_OFFSET, converted back
// from screen px/post-center-relative to native texture-top-relative). Each
// post sprite is split in two at this row so its cap (above) can render IN
// FRONT of the rail Graphics while the rest of the post (crossing both rails)
// renders BEHIND it — owner ask, 2026-07-27: "the highest left/right stick-
// out part and above" should sit above the top rail, "the rest below".
export const FENCE_POST_TOP_SPLIT_Y = FENCE_TEX_H / 2 + FENCE_RAIL_TOP_OFFSET / S; // native px, = 7.5

// Pasture-perimeter fence (#376 — converted to the same bendable-joint model as
// the house fence, but keeps its OWN different placement scheme). Unlike the
// house fence (posts cropped to just the post column + two separate continuous
// rail lines), the pasture fence's 'fence' tile is drawn WHOLE (post + baked-in
// rail) and stepped at HALF its own rendered width so consecutive tiles overlap
// ~50% and the rail reads as continuous — no separate rail Graphics needed, but
// every post must be individually rotated to match its segment's angle (the
// house fence's posts stay unrotated since its rail is a separate line).
// FENCE_TEX_W * S = 96 world px rendered tile width, so 48 is exactly half.
export const PASTURE_FENCE_SPACING = (FENCE_TEX_W * S) / 2; // 48
export const PASTURE_FENCE_BAND    = 20; // world px collision thickness — matches the old fixed-wall thickness

// ── Animal droppings (#232) ─────────────────────────────────────────────────
// The most droppings allowed lying in the pasture at once. Cosmetic clutter the
// player scoops up with the scooper — capped so an ignored pasture never carpets
// in poop (a gentle chore, not a punishment). No mood/stat effect.
export const DROPPINGS_CAP = 8;

// ── Horse begging behaviour (horseAI.js) ────────────────────────────────────
// The main "feel" knobs for hungry horses coming to beg / gathering at the gate.
// Tweak here rather than hunting through the AI mixin.
export const BEG = {
  HUNGER:        50,   // start begging when hunger drops below this
  KEEP_HUNGER:   55,   // keep loitering until a feed pushes hunger back over this
  NOTICE_DIST:  520,   // gate shut: only gather if the player is within this
  LINGER_DIST:  480,   // keep waiting only while the player stays within this
  THROTTLE_MS: 8000,   // min gap between a horse re-launching a beg trip
  STANDOFF:     120,   // stop this far from the player (don't pile on)
  AT_PLAYER:    150,   // already close enough to the player → just wait
  AT_GATE:       70,   // already at the gate gap → just wait
};

// ── Hungry chickens (behaviors.js / creatures.js) ───────────────────────────
// While a chicken is unfed for the day it crowds the grain bin and, when the
// player wanders within this range, trails them hoping to be fed — even with no
// seeds out yet (#128). Reset to ordinary behaviour once fed (#129).
export const CHICKEN_HUNGRY_FOLLOW_DIST = 200;

// ── Herd clustering (creatures.js) ──────────────────────────────────────────
// Buddy pairing (the head-to-tail "fly-swatting" pose) and the gentle drift that
// keeps an idle cluster from collapsing into one overlapping blob.
export const HERD = {
  HAPPY_AT:    60,   // happiness needed before a horse seeks out a buddy
  PAIR_CHANCE: 0.6,  // chance a content horse's wander becomes a buddy pairing
  STAND_GAP:   28,   // how far fore/aft of the buddy to pull up
  SEP_MIN:     28,   // idle horses closer than this gently drift apart
  SEP_PUSH:   0.6,   // max px/frame a horse is nudged to separate (a slow drift)
  // Cosmetic herd bonds (#31): each horse has a favoured companion (bondKey,
  // assigned at buildHorses). When a content horse has drifted away from its
  // bonded buddy it occasionally ambles back over to linger head-to-tail. Purely
  // charm — NO stat/care effect. Lowest AI priority (below every need + graze), so
  // it never interrupts feeding/watering/begging.
  BOND_LINGER_GAP: 120,   // only amble back when the buddy is farther than this
  BOND_CHANCE:     0.5,   // per-eligible-tick odds a horse drifts back to its buddy
  BOND_COOLDOWN:   14000, // min ms between a horse re-launching a bond amble
};

// ── Cross-animal charm behaviors (#187) ─────────────────────────────────────
// Low-frequency "aww" moments layered on top of the need-driven AI: the dog
// noses the sheep into a bunch, chickens scatter from a passing dog, the pig
// flops for a sunbathe, the barnyard beds down together at night, and the cat
// curls up by a companion. All purely cosmetic (no stat/mood effects) and lower
// priority than any need, so they never get in the way of care. Tuned to read as
// occasional special beats rather than constant motion.
export const CHARM = {
  // Dog ↔ sheep: the dog ambles over to a nearby sheep and the flock bunches up.
  HERD_RANGE:    280,   // dog notices sheep within this many px and trots over
  HERD_COOLDOWN: 22000, // min ms between herding bouts (keeps it occasional)
  HERD_STANDOFF: 70,    // dog pulls up this far short of the flock centre
  SHEEP_BUNCH:   28,    // px a startled sheep hops in toward the flock centre
  // Chickens scatter when the dog trots close.
  SCATTER_DIST:  96,    // a chicken this close to the dog bolts
  SCATTER_RUN:  140,    // how far away it darts before settling
  // Pig sunbathe flop (an onSettle nap, like the horse roll / chicken peck).
  PIG_NAP_CHANCE: 0.22, // odds a pig naps when it finishes a wander (daytime only)
  NAP_MS: [4000, 7000], // how long a sunbathe / curl-up lasts
  // Pig wallow (#197): an occasional charm behavior in the AI priority list — a
  // content, not-hungry-or-thirsty pig sometimes flops and rolls in a muddy spot,
  // like the horse roll but its own dedicated art + its own low-priority behavior
  // module (rather than an onSettle hook) so it competes with (but never overrides)
  // seekFood/seekWater/graze.
  WALLOW_CHANCE:   0.18,  // odds a wallow-eligible pig wallows on a given AI tick
  WALLOW_COOLDOWN: 20000, // min ms between wallows (keeps it occasional)
  WALLOW_MS: 1800,        // how long the flop/roll lasts
  // Llama spit (#268) had tuning here — turned off per playtest feedback
  // (2026-07-26); removed along with the behavior itself.
  // Night settling: non-horse pasture animals drift in to bed down with the herd;
  // the dog beds down near the house; the cat curls by a companion or the house.
  CLUSTER_CHANCE: 0.7,  // odds an animal drifts to the night huddle (else rests put)
  CAT_CURL_CHANCE: 0.5, // odds the cat curls outside instead of going into the house
  // Stream swim (#231): a GENERIC ambient charm behavior — any species with the
  // `swims` capability occasionally wades into the stream and doggy-paddles a bit,
  // like the pig wallow but with a walk to the bank first (mirrors horseGoToStream).
  // Kept a rare, short background beat — occasional, not a centerpiece.
  SWIM_CHANCE:   0.16,          // odds a swim-eligible animal takes a dip on a given AI tick
  SWIM_COOLDOWN: 26000,         // min ms between swims (keeps it occasional)
  SWIM_MS: [3200, 5200],        // how long a dip lasts once it's in the water
};

// Dog companion charm (#186): the farm dog trots alongside the player with slack —
// it hangs back at a comfortable trailing distance and only catches up when the
// player moves off, then sits/lies down near them when the player stands idle. A
// self-contained per-frame follow (updateDogCompanion), autonomous like a loose dog
// rather than a led horse. Purely cosmetic — no stats, no care effect.
// Loosened in #353 — the dog read as glued to the player. It now hangs further
// back, tolerates a much bigger gap before bothering to close it, trots at about
// the player's own pace instead of overtaking them, and settles onto its haunches
// sooner and from further out. The result is a contented companion that drifts in
// and out of step rather than a shadow.
export const DOG_COMPANION = {
  GAP:        84,   // preferred trailing distance behind the player
  SLACK:      110,  // rest once within this of the follow slot (keeps the rope loose)
  CATCH_UP:   260,  // beyond this from the slot the dog breaks into a run to keep up
  LEASH:      520,  // farther than this (e.g. player crossed the fence) → teleport-catch is NOT used; the dog just paths as far as it can
  SPEED:      205,  // px/s trot — roughly the player's own pace, so it ambles rather than overtakes
  RUN_MULT:   1.4,  // multiplier on SPEED when catching up from beyond CATCH_UP
  SIT_IDLE_MS: 1100, // player must stand still this long before the dog sits down
  SIT_NEAR:   150,  // dog only sits if it's already this close to its slot (else it keeps closing first)
};

// Cleanliness (issue #26): below DUST_CLEAN_AT grooming the dust overlay starts
// to show, ramping to DUST_MAX_ALPHA opacity at grooming 0. Below STINK_AT a
// very dirty horse also gets wavering "stink" lines above its back.
export const DUST_CLEAN_AT  = 55;
export const DUST_MAX_ALPHA = 0.85;
export const STINK_AT       = 33;

// What the farm stand can sell. Each product type has a sale price (per unit),
// a counter texture (with its own scale), an emoji for the count badge, and the
// floating icon shown when the player stocks it.
export const STAND_DEFS = {
  egg:    { price: 5,  tex: 'egg',        scale: S,   emoji: '🥚', floatIcon: 'iconEgg' },
  // Brown eggs (#276): brown & gold hens lay these. Same price as white for now —
  // colour is cosmetic; a price premium/variance is a balance lever to tune at playtest.
  eggBrown: { price: 5, tex: 'eggBrown',  scale: S,   emoji: '🥚', floatIcon: 'iconEggBrown' },
  apple:  { price: 4,  tex: 'iconApple',  scale: 0.9, emoji: '🍎', floatIcon: 'iconApple' },
  carrot: { price: 3,  tex: 'iconCarrot', scale: 0.9, emoji: '🥕', floatIcon: 'iconCarrot' },
  milk:   { price: 8,  tex: 'iconMilk',   scale: 0.9, emoji: '🥛', floatIcon: 'iconMilk' },
  // Raw wool sells cheap; spinning it into yarn at the spinning wheel roughly doubles
  // the value — the payoff for the extra crafting step (#233).
  wool:   { price: 7,  tex: 'iconWool',   scale: 0.9, emoji: '🧶', floatIcon: 'iconWool' },
  yarn:   { price: 15, tex: 'iconYarn',   scale: 0.9, emoji: '🧶', floatIcon: 'iconYarn' },
  // Crops (#242): sold at the stand like eggs/produce. Prices are a first-pass balance
  // lever to tune at playtest. Strawberries fetch a bit more (fruit → future jam), wheat
  // a bit less (bulk grain → future flour / pig feed).
  strawberry: { price: 6, tex: 'iconStrawberry', scale: 0.9, emoji: '🍓', floatIcon: 'iconStrawberry' },
  wheat:      { price: 4, tex: 'iconWheat',       scale: 0.9, emoji: '🌾', floatIcon: 'iconWheat' },
  // Honey (#239): a premium produce — harvested from the beehive on a timer, sold like
  // eggs/milk. Priced high (a jar of honey is a treat); a balance lever to tune at playtest.
  honey:      { price: 12, tex: 'iconHoney',       scale: 0.9, emoji: '🍯', floatIcon: 'iconHoney' },
  // Crop processing (#40): jam/flour are the kitchen counter's processed forms of
  // strawberries/wheat — priced noticeably above their raw crop (the payoff for the
  // extra crafting step, mirrors wool→yarn roughly doubling). A first-pass balance
  // lever to tune at playtest. (Ground pig feed isn't sellable — it's a feed, not a
  // stand product, mirroring hay/apple/carrot's other feed siblings.)
  jam:        { price: 13, tex: 'iconJam',        scale: 0.9, emoji: '🍓', floatIcon: 'iconJam' },
  flour:      { price: 9,  tex: 'iconFlour',      scale: 0.9, emoji: '🌾', floatIcon: 'iconFlour' },
  // Crop variety (#216): blueberries fetch a bit more than strawberries (slower to
  // ripen, higher yield per harvest); potatoes are priced like carrots (a humble root
  // veg). First-pass balance levers to tune at playtest.
  blueberry:  { price: 7,  tex: 'iconBlueberry',   scale: 0.9, emoji: '🫐', floatIcon: 'iconBlueberry' },
  potato:     { price: 3,  tex: 'iconPotato',      scale: 0.9, emoji: '🥔', floatIcon: 'iconPotato' },
  // More tree/bush fruit (#228): oranges (a second gatherable TREE, mirrors apple)
  // and berries (a gatherable BUSH — same mechanic, low trunkless canopy). Priced a
  // touch above apples/carrots; both also craft into jam at the kitchen counter
  // (items.js craftsTo) alongside strawberries. First-pass balance levers to tune
  // at playtest, same as every other crop price here.
  orange: { price: 5, tex: 'iconOrange', scale: 0.9, emoji: '🍊', floatIcon: 'iconOrange' },
  berry:  { price: 6, tex: 'iconBerry',  scale: 0.9, emoji: '🫐', floatIcon: 'iconBerry' },
  // Cooking (#41): dishes cooked at the house stove (#213) from TWO combined raw
  // ingredients (unlike jam/flour's single-crop grind). Priced above the combined
  // raw value of their ingredients (see data/cooking.js rawIngredientValue —
  // unit-tested) so cooking is the better payoff, mirroring jam/flour/yarn. First-
  // pass balance levers to tune at playtest.
  vegetableStew: { price: 16, tex: 'iconStew',       scale: 0.9, emoji: '🍲', floatIcon: 'iconStew' },
  berryPie:      { price: 26, tex: 'iconBerryPie',   scale: 0.9, emoji: '🥧', floatIcon: 'iconBerryPie' },
  honeyBread:    { price: 27, tex: 'iconHoneyBread', scale: 0.9, emoji: '🍞', floatIcon: 'iconHoneyBread' },
  // Trail trinket (#36 playtest follow-up, 2026-07-26): the trailside collectible,
  // now sold at the stand like any other gathered good instead of an instant cash
  // pickup. Priced comparably to the other low-tier sellables above (carrot 3,
  // potato 3, orange 5, egg 5) — a first-pass balance lever to tune at playtest.
  trinket: { price: 6, tex: 'iconTrinket', scale: 0.9, emoji: '✨', floatIcon: 'iconTrinket' },
  // Sugar cubes (#227): raw sugar is a bought-in pantry staple (data/shop.js
  // SHOP_STOCK), priced a touch above hay/carrot since it's a store-bought good,
  // not gathered. Sugar cubes (the cooked dish) reuse the existing 'iconTreat'
  // texture (art/iconArt.js) — a sugar-cube-with-sparkle icon that was already
  // drawn but unused before this issue. Priced above its raw sugar + water
  // ingredient cost (data/cooking.js isProfitableToCook), same payoff pattern as
  // the other dishes.
  rawSugar:      { price: 4,  tex: 'iconRawSugar',   scale: 0.9, emoji: '🧂', floatIcon: 'iconRawSugar' },
  sugarCube:     { price: 20, tex: 'iconTreat',       scale: 0.9, emoji: '🍬', floatIcon: 'iconTreat' },
};
export const STAND_TYPES = Object.keys(STAND_DEFS);

// ─── House interior (#56) ──────────────────────────────────────────────────
// The enterable one-room cottage (HouseInteriorScene). The `houseInterior` texture
// is a 160×120 design-grid floor plan; the scene draws it at HOUSE_INTERIOR.scale so
// there's real room to walk. Furniture hit-zones are declared in DESIGN-GRID coords
// (matching worldArt's houseInterior draw) and the scene converts them with the same
// scale, so art + collision stay in lockstep — retune the art and the zones together.
export const HOUSE_INTERIOR = {
  dw: 160, dh: 120,   // design-grid footprint (must match worldArt houseInterior)
  scale: 4,           // world px per design px (room = 640×480)
  // Furniture interaction zones, in DESIGN-GRID coords. `stand` is where the player
  // walks to use it; `label`/`action` drive the prompt + activation in the scene.
  stations: {
    // Bed stand point (#334): it used to be (122,74), which the fireplace footprint
    // added later — collision rect (112,60)-(158,106) — completely swallowed. The
    // player physically could NOT reach it, so tap-to-walk never fired its arrival
    // callback and sleeping stopped working entirely. Moved to the bed's LEFT side
    // (108,42), clear of both the bed frame (x0=112) and the hearth.
    bed:     { x: 132, y: 42,  standX: 108, standY: 42, label: 'Sleep',             action: 'sleep' },
    dresser: { x: 25,  y: 30,  standX: 25,  standY: 66, label: 'Customize Character', action: 'customize' },
    // Stove & oven (#213): the kitchen counter is now a real interactable object
    // (placement + prompt) — still no recipes/cooking system (#41 owns that).
    kitchen: { x: 80,  y: 30,  standX: 80,  standY: 46, label: 'Stove & Oven',      action: 'kitchen' },
    // Pantry/fridge (#212): a standalone cupboard on the back wall between the
    // dresser and the kitchen counter — a separate storage pool, not part of the
    // counter itself. Deposits the active carrier's whole load on Use.
    pantry:  { x: 47,  y: 30,  standX: 47,  standY: 46, label: 'Pantry',           action: 'pantry' },
  },
  // Solid furniture footprints (DESIGN-GRID coords, matching worldArt's hit rects)
  // the player can't walk through. v1: just the bed frame — playtest (#210) found
  // the player could walk right on top of it. Extend this list as other furniture
  // gets a footprint.
  collision: [
    { x0: 112, y0: 22, x1: 152, y1: 62 }, // bed frame (worldArt houseInterior fillRect)
    // Fish tank footprint (#221 playtest fix — the player could walk onto/through
    // the tank). Matches the stand + frame drawn in worldArt.js's houseInterior
    // `fishtank` layer (post-#221 flattened-proportions pass).
    { x0: 8, y0: 78, x1: 48, y1: 108 },
    // Fireplace footprint (#230 playtest fix — the player could walk right onto the
    // hearth). Bounding box of the mantel shelf (worldArt fillRect(112,60,46,5)) +
    // stone surround block (fillRect(114,62,42,44)) drawn in the `fireplace` layer,
    // so the whole hearth reads as solid, not just the dark firebox opening.
    { x0: 112, y0: 60, x1: 158, y1: 106 },
  ],
  // South doorway: the exit strip. When the player walks onto it they leave the house.
  exit: { x: 80, y: 116, w: 34 },
  // Where the player sprite spawns on entering (just inside the doorway).
  spawn: { x: 80, y: 104 },
  // Purely decorative props (#221 fish tank, #230 fireplace) — no `standX/standY`
  // walk-up interaction, no `action`; the scene just renders them (and any ambient
  // animation) and skips them in the interactable/prompt scan. DESIGN-GRID coords,
  // matching the `fishtank`/`fireplace` layers drawn in worldArt.js's houseInterior.
  decor: {
    // Fish tank (#221): glass bounds (design-grid) the scene keeps its 2 ambient
    // swimming fish within — a little inset from the tank frame drawn in the art.
    fishTank: { bounds: { x0: 13, x1: 43, y0: 81, y1: 91 } },
    // Fireplace (#230): where the flame-flicker sprite sits over the hearth's
    // firebox opening (worldArt houseInterior's `fireplace` layer, x=122-144,
    // y=76-100) — origin (0.5,1) so this is the flame's base/floor point.
    fireplace: { x: 133, y: 99 },
  },
};
