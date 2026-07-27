import { describe, it, expect } from 'vitest';
import { flockFollowSpot, flockGatherSpot } from './flockSpots.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// The spot maths behind the two flock formations (#328). The property that matters
// is simply: different slots must land on visibly different pixels, so no two birds
// park on top of each other.
describe('flock formation spots', () => {
  const SLOTS = [0, 1, 2, 3, 4, 5, 6];

  it('gives every follow slot a distinct spot behind the player', () => {
    const spots = SLOTS.map((s) => flockFollowSpot(s, 500, 400));
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(dist(spots[i], spots[j])).toBeGreaterThan(10);
      }
    }
  });

  it('gives every gather slot a distinct spot around the bin', () => {
    const spots = SLOTS.map((s) => flockGatherSpot(s, 800, 300));
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        // Each bird parks once it's within 18px of its spot (flock.js), so spots
        // need to be further apart than that to keep two birds from overlapping.
        expect(dist(spots[i], spots[j])).toBeGreaterThan(18);
      }
    }
  });

  it('keeps the spots anchored near the point they fan out from', () => {
    for (const s of SLOTS) {
      expect(dist(flockFollowSpot(s, 500, 400), { x: 500, y: 400 })).toBeLessThan(90);
      expect(dist(flockGatherSpot(s, 800, 300), { x: 800, y: 300 })).toBeLessThan(90);
    }
  });

  // Regression (#328): slots used to come from the LAST CHARACTER of the sprite key,
  // which collides across species — 'chicken0' (the white hen) and 'rooster0' both
  // end in '0', so the hen and the rooster targeted the same pixel and stood stuck
  // together. Slots are now the bird's flock position, so the collision is impossible.
  it('the old key-last-character scheme collided for chicken0 and rooster0', () => {
    const legacySlot = (key) => key.charCodeAt(key.length - 1) || 0;
    expect(legacySlot('chicken0')).toBe(legacySlot('rooster0'));
    expect(flockGatherSpot(legacySlot('chicken0'), 800, 300))
      .toEqual(flockGatherSpot(legacySlot('rooster0'), 800, 300));
    // The replacement (distinct flock slots) separates them.
    expect(dist(flockGatherSpot(0, 800, 300), flockGatherSpot(5, 800, 300)))
      .toBeGreaterThan(18);
  });
});
