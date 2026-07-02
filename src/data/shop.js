// Shop / market stock (issue #29 — core economy).
//
// The farm stand is where you SELL produce for gold (see paddock/farmStand.js +
// STAND_DEFS). The shop is the other half of the loop: where you SPEND that gold.
//
// v1 sells feed supplies straight into your active carrier — a paid alternative to
// walking out to the gathering sources, plus premium feed you can't gather at all.
// Each entry buys one *unit* of a content type (the same contents carriers already
// hold, `CONTENT_DEFS` in items.js), so buying reuses the existing carrier plumbing
// (`fillActiveCarrier`) and needs no new inventory concept. Data-driven: add a row
// here and it appears in the shop, no UI edits.
//
// A row is:
//   { key, content, price, carrier, label, icon, desc }
//     content — the CONTENT_DEFS key the purchase deposits into the carrier
//     carrier — which carrier kind it needs equipped ('basket' | 'bucket')
//     price   — gold per unit
//     label/icon/desc — display (icon is a built texture key; see art/iconArt.js)
//
// Prices sit ABOVE what the same produce sells back for at the stand (a shop margin),
// so buying-to-resell is never a free-money exploit — the loop is care → sell → spend.
export const SHOP_STOCK = [
  { key: 'buyHay',     content: 'hay',     carrier: 'basket', price: 3,  label: 'Hay',      icon: 'iconBasketHay',     desc: 'Feed for horses, cows & sheep' },
  { key: 'buyApple',   content: 'apple',   carrier: 'basket', price: 6,  label: 'Apples',   icon: 'iconBasketApple',   desc: 'A treat horses, cows & pigs love' },
  { key: 'buyCarrot',  content: 'carrot',  carrier: 'basket', price: 5,  label: 'Carrots',  icon: 'iconBasketCarrot',  desc: 'Crunchy feed for horses, cows & pigs' },
  { key: 'buySeed',    content: 'seed',    carrier: 'basket', price: 2,  label: 'Chicken Feed', icon: 'iconBasketSeed', desc: 'Seed for the flock' },
  { key: 'buyCatFood', content: 'catFood', carrier: 'basket', price: 4,  label: 'Cat Food', icon: 'iconBasketCatFood', desc: 'A tin for the barn cat' },
];

// Look up a stock row by its key.
export function getShopItem(key) {
  return SHOP_STOCK.find((i) => i.key === key) || null;
}

// Pure buy-math helper (unit-tested): given the player's gold and a stock row,
// can they afford one unit, and what's the resulting balance? Keeps the money math
// in one testable place instead of inline in the scene.
//   returns { ok, cost, balance } — ok:false leaves balance unchanged.
export function purchase(money, item) {
  if (!item) return { ok: false, cost: 0, balance: money };
  const cost = item.price;
  if (money < cost) return { ok: false, cost, balance: money };
  return { ok: true, cost, balance: money - cost };
}
