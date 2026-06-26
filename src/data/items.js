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
  basket: { capacity: 999, emptyIcon: 'iconBasket', accepts: ['hay', 'apple', 'carrot', 'seed', 'egg'] },
  bucket: { capacity: 1, emptyIcon: 'iconBucket', accepts: ['water', 'milk'] },
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
  hay:    { label: 'Hay',     icon: 'iconBasketHay',    action: 'feed',  ground: 'hayPile',    feeds: ['horse', 'cow', 'sheep'] },
  // Apples and carrots feed the pig too; hay does NOT (pigs won't touch it). This
  // `feeds` list is the single source of truth for the pig's pickier diet — the
  // grazing AI reads it (speciesEatsContent) when choosing which pile to walk to.
  apple:  { label: 'Apples',  icon: 'iconBasketApple',  action: 'feed',  ground: 'applePile',  feeds: ['horse', 'cow', 'pig'] },
  carrot: { label: 'Carrots', icon: 'iconBasketCarrot', action: 'feed',  ground: 'carrotPile', feeds: ['horse', 'cow', 'pig'] },
  seed:   { label: 'Seed',    icon: 'iconBasketSeed',   action: 'feed',  ground: 'seedPile',   feeds: ['chicken'] },
  egg:    { label: 'Eggs',    icon: 'iconBasketEgg',    action: 'egg' },
  water:  { label: 'Water',   icon: 'iconBucketWater',  action: 'water' },
  // Milk is produced by milking a well-cared-for cow into an empty bucket, then
  // sold at the farm stand (action 'sell', like eggs — see STAND_DEFS).
  milk:   { label: 'Milk',    icon: 'iconBucketMilk',   action: 'sell' },
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
];

// Inventory list: the grouped carriers + tools (individual members aren't shown).
export const ALL_ITEMS = [...GROUP_ITEMS, ...TOOL_ITEMS];

// Lookup by any key: group keys, individual member keys, and tools.
export const ITEM_MAP = Object.fromEntries(
  [...GROUP_ITEMS, ...CARRIER_MEMBERS, ...TOOL_ITEMS].map(i => [i.key, i]),
);

// backward compat
export const ITEMS = ALL_ITEMS;
