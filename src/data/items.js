// Carrier-based inventory (issue #62).
//
// The player no longer carries discrete food/water items. Instead they carry
// *carriers* — baskets (solids) and buckets (liquids) — that hold a single
// content type at a time. A basket becomes a hay-basket when filled at the hay
// pile, an apple-basket at the trees, an egg-basket at the nests, etc. Empty it
// and it reverts to a generic carrier, ready to be refilled with anything.

// Carrier kinds: what they accept, how much they hold, and their empty icon.
export const CARRIER_DEFS = {
  basket: { capacity: 5, emptyIcon: 'iconBasket', accepts: ['hay', 'apple', 'carrot', 'seed', 'egg'] },
  bucket: { capacity: 1, emptyIcon: 'iconBucket', accepts: ['water'] },
};

// What each content type looks like in a carrier and what using it does.
//   action 'feed'  → dropped as food (horses eat hay/apple/carrot; chickens eat seed)
//   action 'water' → fills the trough
//   action 'egg'   → sold at the farm stand
export const CONTENT_DEFS = {
  hay:    { label: 'Hay',     icon: 'iconBasketHay',    action: 'feed',  ground: 'hayPile' },
  apple:  { label: 'Apples',  icon: 'iconBasketApple',  action: 'feed',  ground: 'applePile' },
  carrot: { label: 'Carrots', icon: 'iconBasketCarrot', action: 'feed',  ground: 'carrotPile' },
  seed:   { label: 'Seed',    icon: 'iconBasketSeed',   action: 'feed',  ground: 'seedPile', feeds: 'chicken' },
  egg:    { label: 'Eggs',    icon: 'iconBasketEgg',    action: 'egg' },
  water:  { label: 'Water',   icon: 'iconBucketWater',  action: 'water' },
};

// Hotbar items: 3 baskets + 2 buckets, plus the existing tools.
export const ALL_ITEMS = [
  { key: 'basket1', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'basket2', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'basket3', label: 'Basket', type: 'carrier', carrier: 'basket' },
  { key: 'bucket1', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
  { key: 'bucket2', label: 'Bucket', type: 'carrier', carrier: 'bucket' },
  { key: 'brush',  label: 'Brush',  icon: 'iconBrush',  action: 'brush',    type: 'tool' },
  { key: 'saddle', label: 'Saddle', icon: 'iconSaddle', action: 'saddle',   type: 'tool' },
  { key: 'lead',   label: 'Lead',   icon: 'iconLead',   action: 'lead',     type: 'tool' },
  { key: 'hand',   label: 'Hand',   icon: 'iconHand',   action: 'interact', type: 'tool' },
];

export const ITEM_MAP = Object.fromEntries(ALL_ITEMS.map(i => [i.key, i]));

// backward compat
export const ITEMS = ALL_ITEMS;
