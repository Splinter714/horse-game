// Neighbor relationship + trade tests (#294) — mirrors the rigor of
// birdFriendship.test.js: the gift counter ticks up per gift, commits (levels up)
// exactly on a threshold gift, and the trade offer resolves to the right tier as
// the score climbs.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  giftNeighbor, neighborLevel, neighborTradeOffer,
  NEIGHBOR_GIFT_THRESHOLDS, NEIGHBOR_TRADE_TIERS,
} from './neighbor.js';

describe('giftNeighbor — the relationship-score counter', () => {
  it('a first gift bumps the score and does not level up yet', () => {
    const step = giftNeighbor(0);
    expect(step.score).toBe(1);
    expect(step.leveledUp).toBe(false);
  });

  it('levels up on exactly the threshold gift', () => {
    let score = 0;
    let leveledAt = null;
    for (let i = 1; i <= NEIGHBOR_GIFT_THRESHOLDS[0]; i++) {
      const step = giftNeighbor(score);
      score = step.score;
      if (step.leveledUp && leveledAt == null) leveledAt = i;
    }
    expect(leveledAt).toBe(NEIGHBOR_GIFT_THRESHOLDS[0]);
  });

  it('does not level up before the first threshold', () => {
    let score = 0;
    for (let i = 1; i < NEIGHBOR_GIFT_THRESHOLDS[0]; i++) {
      const step = giftNeighbor(score);
      score = step.score;
      expect(step.leveledUp).toBe(false);
    }
  });

  it('levels up again at the second and third thresholds', () => {
    let score = 0;
    const leveledAt = [];
    for (let i = 1; i <= NEIGHBOR_GIFT_THRESHOLDS[NEIGHBOR_GIFT_THRESHOLDS.length - 1]; i++) {
      const step = giftNeighbor(score);
      score = step.score;
      if (step.leveledUp) leveledAt.push(i);
    }
    expect(leveledAt).toEqual(NEIGHBOR_GIFT_THRESHOLDS);
  });

  it('respects custom thresholds', () => {
    expect(giftNeighbor(0, [2]).leveledUp).toBe(false);
    expect(giftNeighbor(1, [2]).leveledUp).toBe(true);
  });
});

describe('neighborLevel — thresholds crossed', () => {
  it('starts at level 0 (stranger)', () => {
    expect(neighborLevel(0)).toBe(0);
  });

  it('reaches level 1 exactly at the first threshold', () => {
    expect(neighborLevel(NEIGHBOR_GIFT_THRESHOLDS[0] - 1)).toBe(0);
    expect(neighborLevel(NEIGHBOR_GIFT_THRESHOLDS[0])).toBe(1);
  });

  it('reaches the max level once every threshold is crossed', () => {
    const last = NEIGHBOR_GIFT_THRESHOLDS[NEIGHBOR_GIFT_THRESHOLDS.length - 1];
    expect(neighborLevel(last)).toBe(NEIGHBOR_GIFT_THRESHOLDS.length);
    expect(neighborLevel(last + 100)).toBe(NEIGHBOR_GIFT_THRESHOLDS.length); // never past max
  });
});

describe('neighborTradeOffer — the current offer for a relationship score', () => {
  it('a stranger (score 0) gets the level-0 tier', () => {
    expect(neighborTradeOffer(0)).toEqual(NEIGHBOR_TRADE_TIERS[0]);
  });

  it('crossing a threshold unlocks the next tier', () => {
    const offer = neighborTradeOffer(NEIGHBOR_GIFT_THRESHOLDS[0]);
    expect(offer.level).toBe(1);
  });

  it('the top tier is the best (cheapest-per-value) offer', () => {
    const last = NEIGHBOR_GIFT_THRESHOLDS[NEIGHBOR_GIFT_THRESHOLDS.length - 1];
    const offer = neighborTradeOffer(last);
    expect(offer.level).toBe(NEIGHBOR_TRADE_TIERS[NEIGHBOR_TRADE_TIERS.length - 1].level);
  });
});

describe('neighbor relationship persistence — score survives a reload', () => {
  let loadNeighborFriendship, saveNeighborFriendship;

  beforeEach(async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    ({ loadNeighborFriendship, saveNeighborFriendship } = await import('./save.js'));
  });

  it('starts at 0 on a fresh save', () => {
    expect(loadNeighborFriendship()).toEqual({ score: 0 });
  });

  it('round-trips a saved score', () => {
    saveNeighborFriendship({ score: 7 });
    expect(loadNeighborFriendship()).toEqual({ score: 7 });
  });

  it('is forgiving of corrupt/missing data', () => {
    localStorage.setItem('horse-game-neighbor-friendship-v1', '{not json');
    expect(loadNeighborFriendship()).toEqual({ score: 0 });
  });

  it('coerces a corrupt score field to 0', () => {
    localStorage.setItem('horse-game-neighbor-friendship-v1', JSON.stringify({ score: 'lots' }));
    expect(loadNeighborFriendship()).toEqual({ score: 0 });
  });
});
