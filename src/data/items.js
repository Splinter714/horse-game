// Carrier-based inventory (issue #62).
//
// The player no longer carries discrete food/water items. Instead they carry
// *carriers* — baskets (solids) and buckets (liquids) — that hold a single
// content type at a time. A basket becomes a hay-basket when filled at the hay
// pile, an apple-basket at the trees, an egg-basket at the nests, etc. Empty it
// and it reverts to a generic carrier, ready to be refilled with anything.

// Carrier kinds: what they accept, how much they hold, and their empty icon.
export const CARRIER_DEFS = {
  // Effectively unlimited: a gather only ever pulls what's *needed* (one food per
  // animal that eats it, #136), so the basket's cap is just a safety ceiling, not a
  // limit you should hit. Kept finite (not Infinity) so it never trips serialization
  // or UI maths — but high enough that the demand always fits (and you can hoard eggs).
  basket: { capacity: 999, emptyIcon: 'iconBasket', accepts: ['hay', 'apple', 'carrot', 'seed', 'catFood', 'bunnyFood', 'foxFood', 'egg', 'eggBrown', 'wool', 'yarn', 'compost', 'strawberry', 'wheat', 'honey'] },
  bucket: { capacity: 1, emptyIcon: 'iconBucket', accepts: ['water', 'milk', 'nectar'] },
};

// What each content type looks like in a carrier and what using it does.
//   action 'feed'  → dropped as food (horses eat hay/apple/carrot; chickens eat seed)
//   action 'water' → fills the trough
//   action 'egg'   → sold at the farm stand
// `feeds` lists the species ids whose members eat this food. It drives both where a
// dropped pile lands and how much a basket auto-gathers (#136): one per animal that
// can eat it. A food eaten by several species sums their counts (e.g. apples eaten by
// horses + pigs → horses + pigs). Multiple foods overlapping the same animals is fine
// and intended — the owner wants "N apples for N horses", overlap with carrots and all.
export const CONTENT_DEFS = {
  // The GOAT (#267) is on EVERY edible pile's `feeds` list — that's her eat-everything
  // charm quirk, realized as data: unlike the pickier grazers she'll trot over to any
  // food the farm drops (hay, apples, carrots, even the chickens' seed). The grazing AI
  // reads `feeds` (speciesEatsContent) when choosing which pile to walk to. Llamas (#268)
  // eat hay like the sheep/cow but refuse apples/carrots.
  hay:    { label: 'Hay',     icon: 'iconBasketHay',    action: 'feed',  ground: 'hayPile',    feeds: ['horse', 'cow', 'sheep', 'goat', 'llama'] },
  // Apples and carrots feed the pig too; hay does NOT (pigs won't touch it). This
  // `feeds` list is the single source of truth for the pig's pickier diet — the
  // grazing AI reads it (speciesEatsContent) when choosing which pile to walk to.
  apple:  { label: 'Apples',  icon: 'iconBasketApple',  action: 'feed',  ground: 'applePile',  feeds: ['horse', 'cow', 'pig', 'goat'] },
  carrot: { label: 'Carrots', icon: 'iconBasketCarrot', action: 'feed',  ground: 'carrotPile', feeds: ['horse', 'cow', 'pig', 'goat'] },
  // Seed feeds the chickens — and the goat (she eats everything). A dropped seed pile in
  // the pasture is fair game for a wandering goat.
  seed:   { label: 'Seed',    icon: 'iconBasketSeed',   action: 'feed',  ground: 'seedPile',   feeds: ['chicken', 'goat'] },
  // Cat food feeds only the cat (#202 rework) — scooped from the kibble sack into a
  // basket, then poured into the FOOD BOWL (fillCatBowl), which the cat eats from
  // directly. It is NOT dropped as a ground pile: `stocks: 'catFood'` marks it as a
  // bowl-fill content (see useDispatch), so Use near the bowl fills it and there's no
  // drop-on-ground fallback (no `ground` texture). `feeds` still names the cat so the
  // basket auto-gathers one serving per cat (#136) and demand maths stay data-driven.
  catFood: { label: 'Cat Food', icon: 'iconBasketCatFood', action: 'feed', stocks: 'catFood', feeds: ['cat'] },
  egg:    { label: 'Eggs',    icon: 'iconBasketEgg',    action: 'egg' },
  // Brown eggs (#276): laid by brown & gold hens (see species/chicken/eggColor.js).
  // A separate content type so colour rides the existing basket → farm-stand → sell
  // pipeline unchanged — same 'egg' action, its own icon and sellable stand variant.
  eggBrown: { label: 'Brown Eggs', icon: 'iconBasketEggBrown', action: 'egg' },
  // Water fills the trough (horses) AND the pets' water bowls — the cat's and, as of
  // #283, the bunny's (fillPetBowl). The Use dispatch picks whichever fillable spot the
  // player is facing / is nearest. Plain water from the well/stream; the pet water bowls
  // need no special content (#202 rework, #283).
  water:  { label: 'Water',   icon: 'iconBucketWater',  action: 'water' },
  // Bunny food (#224, reworked #283): gathered from the bunny hutch (a gathering
  // source) into a basket, then poured into the bunny FOOD BOWL — the bunnies eat from
  // the bowl directly (like the cat's, #202). It is NOT dropped as a ground pile:
  // `stocks: 'bunnyFood'` marks it as a bowl-fill content (useDispatch), so Use near the
  // bowl fills it and there's no drop-on-ground fallback (no `ground` texture). Stocking
  // the bowl is also what ATTRACTS a wild bunny to join the roster (capped at 4,
  // paddock/bunny.js `attractBunny`, fired from the bowl's `onFill` hook), so bunny food
  // both attracts and sustains. `feeds: ['bunny']` keeps the demand/gather maths data-driven.
  bunnyFood:  { label: 'Bunny Food',  icon: 'iconBasketBunnyFood',  action: 'feed',  stocks: 'bunnyFood',  feeds: ['bunny'] },
  // Fox food (#266): gathered from the fox den (a gathering source) into a basket, then
  // DROPPED as a ground pile the fox trots over to and eats (unlike the cat/bunny bowl
  // contents, it has a `ground` texture — the fox is befriended by leaving food out for
  // it, so the pile is the taming interaction). Dropping a foxFood pile also advances the
  // wild fox's taming counter and, once fed enough, lures it into the roster (paddock/fox.js
  // `onFoodPlaced` → `_feedWildFox`). `feeds: ['fox']` keeps the demand/gather + diet-gate
  // maths data-driven (only the fox seeks a foxFood pile; grazers walk past it).
  foxFood:    { label: 'Fox Food',    icon: 'iconBasketFoxFood',    action: 'feed',  ground: 'foxFoodPile', feeds: ['fox'] },
  // Milk is produced by milking a well-cared-for cow into an empty bucket, then
  // sold at the farm stand (action 'sell', like eggs — see STAND_DEFS).
  milk:   { label: 'Milk',    icon: 'iconBucketMilk',   action: 'sell' },
  // Nectar / sugar water (#226) — the hummingbird feeder's OWN refillable resource,
  // distinct from the songbirds' seed (#240). Gathered from the nectar station (a
  // sugar-water jug by the house) into a bucket, then poured into the hummingbird
  // feeder (fillNectarFeeder). Like cat food (`stocks`), it's a feeder-fill content
  // with no ground-drop and no `feeds` — nothing eats it directly; the hummingbirds
  // are ambient wildlife drawn to the stocked feeder, not a roster species.
  nectar: { label: 'Nectar',  icon: 'iconBucketNectar', action: 'water', stocks: 'nectar' },
  // Wool is sheared from a sheep into a basket (like eggs — a solid), then either
  // sold raw at the farm stand OR spun into yarn at the spinning wheel (#233).
  // `craftsTo` names the processed content the spinning wheel converts it into.
  wool:   { label: 'Wool',    icon: 'iconBasketWool',   action: 'sell', craftsTo: 'yarn' },
  // Yarn is the processed form of wool — spun 1:1 at the spinning wheel — worth more
  // at the stand than raw wool (the payoff for the extra crafting step, #233).
  yarn:   { label: 'Yarn',    icon: 'iconBasketYarn',   action: 'sell' },
  // Compost (#232): the resource made by scooping up animal droppings with the
  // scooper tool and dumping them in the compost bin. It's a STORED resource only
  // for now — its payoff (fertilising future crops) lands with #27/#40. It rides in
  // a basket (a solid) so a future crop plot can be fed straight from a basket, but
  // the scoop/dump loop itself uses the scooper's own load (see SCOOPER below), not
  // a basket. No `feeds`/`ground`/`action` beyond stored: nobody eats it, it doesn't
  // drop as food, and it isn't sold.
  compost: { label: 'Compost', icon: 'iconBasketCompost', action: 'store' },
  // Crops (#242): harvested from the garden plot into a basket, then sold at the farm
  // stand (action 'sell', like eggs/wool). Strawberries and wheat are new sellables;
  // carrots reuse the existing `carrot` content (already sold + basket-accepted). These
  // are the future inputs to crop processing (#40: jam / flour / pig feed).
  strawberry: { label: 'Strawberries', icon: 'iconBasketStrawberry', action: 'sell' },
  wheat:      { label: 'Wheat',        icon: 'iconBasketWheat',      action: 'sell' },
  // Honey (#239): harvested from the beehive into a basket once it's ripened on the
  // hive's timer, then sold at the farm stand (action 'sell', like eggs/milk/wool). A
  // future cooking ingredient (#41). No `feeds`/`ground` — nobody eats it, it doesn't
  // drop as a pile; it's an in-world produce source alongside eggs/milk/wool.
  honey:      { label: 'Honey',        icon: 'iconBasketHoney',      action: 'sell' },
};

// How many of a food to gather in one fill-up (#136): one unit per live animal that
// can mechanically eat it, summed across every species in its `feeds` diet. Returns
// 0 for non-food contents (water, egg) — those keep their own fill-to-capacity rule.
// Pure: `speciesCounts` maps species id → number of live animals (e.g. {horse:7}).
export function foodDemand(content, speciesCounts = {}) {
  const feeds = CONTENT_DEFS[content]?.feeds;
  if (!feeds) return 0;
  return feeds.reduce((n, sp) => n + (speciesCounts[sp] || 0), 0);
}

// Does a species' diet include this food content? Drives which dropped piles a
// grazing animal will actually walk to (a pig eats apples and carrots but ignores
// hay). Pure — just reads the food's `feeds` list. A content type with no `feeds`
// (water, egg) is eaten by nobody.
export function speciesEatsContent(speciesId, content) {
  return !!CONTENT_DEFS[content]?.feeds?.includes(speciesId);
}

// Same-type carriers are grouped into a single hotbar slot with a fly-out picker
// (#75): the 3 baskets share one "Basket" slot, the 3 buckets one "Bucket" slot.
// The individual members still exist (their contents live per-member in game
// state) — only the *hotbar layout* references the group keys; a group resolves
// to its currently-active member when you fill/use/render it.
export const CARRIER_GROUPS = {
  basketGroup: { carrier: 'basket', label: 'Basket', members: ['basket1', 'basket2', 'basket3', 'basket4'] },
  bucketGroup: { carrier: 'bucket', label: 'Bucket', members: ['bucket1', 'bucket2', 'bucket3', 'bucket4'] },
};

// The individual carrier members. Kept in ITEM_MAP (so a group resolves to one),
// but not listed in the hotbar/inventory — the group represents them.
export const CARRIER_MEMBERS = [
  { key: 'basket1', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'basket2', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'basket3', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'basket4', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'bucket1', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
  { key: 'bucket2', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
  { key: 'bucket3', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
  { key: 'bucket4', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
];

// Group items, as they appear in the hotbar/inventory.
const GROUP_ITEMS = Object.entries(CARRIER_GROUPS).map(([key, g]) => ({
  key, label: g.label, type: 'carrierGroup', carrier: g.carrier, members: g.members,
}));

// Tools. (There's no "hand" tool — interacting/petting is the universal default
// on tap/click/E/controller; tools apply via the Use button / F / controller-X.)
const TOOL_ITEMS = [
  { key: 'brush',  label: 'Brush',  icon: 'iconBrush',  action: 'brush',  type: 'tool' },
  { key: 'saddle', label: 'Saddle', icon: 'iconSaddle', action: 'saddle', type: 'tool' },
  { key: 'lead',   label: 'Lead',   icon: 'iconLead',   action: 'lead',   type: 'tool' },
  // The scooper (#232): scoops up animal droppings and carries them to the compost
  // bin. Unlike the other tools it holds a load — its own little `compost` count,
  // tracked in game state (scooperLoad), not in a carrier — so it has a Use action
  // both on a dropping (scoop) and at the bin (dump). Capacity is SCOOPER.capacity.
  { key: 'scooper', label: 'Scooper', icon: 'iconScooper', action: 'scoop', type: 'tool' },
];

// Inventory list: the grouped carriers + tools (individual members aren't shown).
export const ALL_ITEMS = [...GROUP_ITEMS, ...TOOL_ITEMS];

// Lookup by any key: group keys, individual member keys, and tools.
export const ITEM_MAP = Object.fromEntries(
  [...GROUP_ITEMS, ...CARRIER_MEMBERS, ...TOOL_ITEMS].map(i => [i.key, i]),
);

// backward compat
export const ITEMS = ALL_ITEMS;

// ── Scooper + compost (#232) ─────────────────────────────────────────────────
// The scooper carries a small load of scooped droppings until it's dumped in the
// compost bin. Kept small so it's a genuine carry-and-dump chore (fill it, walk it
// to the bin) rather than a bottomless bag. Its load persists in game state.
export const SCOOPER = { capacity: 6, content: 'compost' };

// Pure loop helpers (unit-tested). All take/return plain numbers so the scoop/dump
// mechanic can be verified without Phaser.

// How many droppings a scoop adds to the scooper, given its current load. One per
// scoop, but never past capacity — a full scooper scoops nothing (must dump first).
export function scoopAmount(load, cap = SCOOPER.capacity) {
  return load < cap ? 1 : 0;
}

// Is the scooper carrying anything to dump?
export function scooperHasLoad(load) {
  return load > 0;
}

// Dumping the scooper at the bin: the whole load moves into the farm's compost
// store. Returns the new { load, compost } after the dump (load → 0). A no-op
// (unchanged) when the scooper is empty.
export function dumpScooper(load, compost) {
  if (load <= 0) return { load, compost };
  return { load: 0, compost: compost + load };
}

// Emptying a carrier into the trash (#284): discard its whole load in one go,
// reverting the carrier state to empty regardless of what (or how much) it held —
// generic over any content, nothing recoverable. Returns { state, discarded }: the
// reset { content:null, count:0 } and how many units were tossed (0 for an already-
// empty carrier, a no-op). Pure so the discard contract is unit-tested without Phaser.
export function emptyCarrier(state) {
  const count = state?.count ?? 0;
  if (count <= 0) return { state: { content: null, count: 0 }, discarded: 0 };
  return { state: { content: null, count: 0 }, discarded: count };
}
