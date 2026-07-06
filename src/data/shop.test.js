// Shop / market tests (#29 — core economy). Covers the pure buy-math (purchase),
// the stock definition's integrity, and the invariant that keeps the economy loop
// honest: every shop item costs MORE than the same produce sells back for at the
// farm stand (no buy-low/sell-high free money).

import { describe, it, expect } from 'vitest';
import { SHOP_STOCK, getShopItem, purchase, ALL_TOOL_UPGRADES, purchaseUpgrade } from './shop.js';
import { CONTENT_DEFS, CARRIER_DEFS } from './items.js';
import { STAND_DEFS } from '../scenes/paddock/constants.js';

describe('purchase() money math', () => {
  const hay = getShopItem('buyHay'); // price 3

  it('debits exactly the item price when affordable', () => {
    const res = purchase(10, hay);
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(hay.price);
    expect(res.balance).toBe(10 - hay.price);
  });

  it('allows a purchase that spends the balance down to exactly zero', () => {
    const res = purchase(hay.price, hay);
    expect(res.ok).toBe(true);
    expect(res.balance).toBe(0);
  });

  it('refuses when the player is one coin short and leaves the balance untouched', () => {
    const res = purchase(hay.price - 1, hay);
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(hay.price - 1);
  });

  it('never debits more than one unit per call', () => {
    const res = purchase(100, hay);
    expect(res.cost).toBe(hay.price); // single unit, not a batch
  });

  it('handles a missing item safely (no-op)', () => {
    const res = purchase(50, null);
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(50);
  });

  it('a sequence of buys debits cumulatively and stops when broke', () => {
    let money = 7; // affords 2 hay (3+3), 1 left over (not enough for a 3rd)
    let bought = 0;
    for (let i = 0; i < 5; i++) {
      const res = purchase(money, hay);
      if (!res.ok) break;
      money = res.balance;
      bought++;
    }
    expect(bought).toBe(2);
    expect(money).toBe(1);
  });
});

describe('SHOP_STOCK integrity', () => {
  it('has a non-empty starter stock', () => {
    expect(SHOP_STOCK.length).toBeGreaterThan(0);
  });

  it('every row has unique keys, a positive integer price, and required fields', () => {
    const keys = new Set();
    for (const item of SHOP_STOCK) {
      expect(keys.has(item.key)).toBe(false); // unique
      keys.add(item.key);
      expect(typeof item.label).toBe('string');
      expect(typeof item.desc).toBe('string');
      expect(item.price).toBeGreaterThan(0);
      expect(Number.isInteger(item.price)).toBe(true);
    }
  });

  it('every row references a real content type and a real carrier', () => {
    for (const item of SHOP_STOCK) {
      expect(CONTENT_DEFS[item.content], `unknown content ${item.content}`).toBeDefined();
      expect(CARRIER_DEFS[item.carrier], `unknown carrier ${item.carrier}`).toBeDefined();
    }
  });

  it('the required carrier actually accepts the content it deposits', () => {
    for (const item of SHOP_STOCK) {
      expect(CARRIER_DEFS[item.carrier].accepts).toContain(item.content);
    }
  });

  it('getShopItem resolves a known key and returns null for an unknown one', () => {
    expect(getShopItem('buyHay')).toBe(SHOP_STOCK.find((i) => i.key === 'buyHay'));
    expect(getShopItem('nope')).toBeNull();
  });
});

describe('economy loop is not exploitable (buy price > sell price)', () => {
  // For any shop item whose content is also sellable at the farm stand, the buy price
  // must exceed the sell price — otherwise you could buy N and immediately resell for
  // profit. (Items the stand doesn't buy back are unconstrained.)
  it('no shop item can be bought and resold at the stand for a profit', () => {
    for (const item of SHOP_STOCK) {
      const sell = STAND_DEFS[item.content];
      if (!sell) continue; // stand doesn't buy this content back — no arbitrage possible
      expect(item.price, `${item.key} buys at ${item.price} but resells at ${sell.price}`)
        .toBeGreaterThan(sell.price);
    }
  });
});

describe('purchaseUpgrade() money math (#295 tool upgrades)', () => {
  const scoop = ALL_TOOL_UPGRADES.find((u) => u.tool === 'scooper');

  it('debits exactly the tier price when affordable and not yet owned', () => {
    const res = purchaseUpgrade(100, scoop, false);
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(scoop.price);
    expect(res.balance).toBe(100 - scoop.price);
  });

  it('refuses when already owned, regardless of gold', () => {
    const res = purchaseUpgrade(9999, scoop, true);
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(9999); // untouched
  });

  it('refuses when one coin short and leaves the balance untouched', () => {
    const res = purchaseUpgrade(scoop.price - 1, scoop, false);
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(scoop.price - 1);
  });

  it('allows spending down to exactly zero', () => {
    const res = purchaseUpgrade(scoop.price, scoop, false);
    expect(res.ok).toBe(true);
    expect(res.balance).toBe(0);
  });

  it('handles a missing upgrade safely (no-op)', () => {
    const res = purchaseUpgrade(50, null, false);
    expect(res.ok).toBe(false);
    expect(res.balance).toBe(50);
  });
});
