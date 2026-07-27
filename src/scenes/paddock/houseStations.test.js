// House-interior station geometry guards (#334).
//
// Sleeping at the bed silently stopped working because the DATA and the CODE that
// consumes it drifted apart in two independent ways:
//
//  1. The bed's walk-up `stand` point (122,74) ended up INSIDE the fireplace
//     collision rect (112,60)-(158,106) once #230 made the hearth solid. The player
//     physically could not reach it, so tap-to-walk's arrival callback — the only
//     thing that fires `_activate` on the tap path — never ran.
//  2. The prompt / [E] path measured the player against the furniture's drawn
//     CENTRE, not the stand point. The bed's centre is 134 world px from its stand
//     point, way past the 70px reach, so "[E] Sleep" never showed and the key never
//     worked from anywhere in the room.
//
// Both are geometry facts about pure data, so guard them here rather than relying on
// someone re-noticing in play. Phaser doesn't load in the node test env, so the
// scene-side rule (measure to the stand point) is checked as a source assertion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HOUSE_INTERIOR } from './constants.js';

const root = fileURLToPath(new URL('../../', import.meta.url)); // src/
const read = (rel) => readFileSync(root + rel, 'utf8');

// Mirrors HouseInteriorScene._collidesAt (strict inside test), in DESIGN-GRID coords.
const insideRect = (x, y, r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

// Must match PROMPT_REACH in scenes/houseInteriorInteract.js, converted to the
// design grid (the constants are design-grid; the scene scales them by HI.scale).
const PROMPT_REACH_DESIGN = 70 / HOUSE_INTERIOR.scale;

describe('#334 house-interior stations are actually usable', () => {
  const stations = Object.entries(HOUSE_INTERIOR.stations);

  it('has stations to check', () => {
    expect(stations.length).toBeGreaterThan(0);
  });

  for (const [id, s] of stations) {
    it(`${id}: its stand point is not inside solid furniture`, () => {
      const hit = HOUSE_INTERIOR.collision.find((r) => insideRect(s.standX, s.standY, r));
      expect(hit, `${id} stand (${s.standX},${s.standY}) is inside collision rect ` +
        `${JSON.stringify(hit)} — the player can never walk there, so tap-to-use never fires`)
        .toBeUndefined();
    });

    it(`${id}: standing at its stand point selects ${id} itself, not a neighbour`, () => {
      // _nearestStation(byStand) picks the closest stand point within reach; standing
      // exactly on one is distance 0, so this only fails if two stations share a spot.
      let best = null, bestD = Infinity;
      for (const [oid, o] of stations) {
        const d = Math.hypot(s.standX - o.standX, s.standY - o.standY);
        if (d <= PROMPT_REACH_DESIGN && d < bestD) { bestD = d; best = oid; }
      }
      expect(best, `standing at ${id}'s stand point prompts for ${best} instead`).toBe(id);
    });

    it(`${id}: its stand point is inside the room's walkable bounds`, () => {
      // Scene clamps movement to x∈[12, roomW-12], y∈[24, roomH-6] in WORLD px.
      const sc = HOUSE_INTERIOR.scale;
      expect(s.standX * sc).toBeGreaterThanOrEqual(12);
      expect(s.standX * sc).toBeLessThanOrEqual(HOUSE_INTERIOR.dw * sc - 12);
      expect(s.standY * sc).toBeGreaterThanOrEqual(24);
      expect(s.standY * sc).toBeLessThanOrEqual(HOUSE_INTERIOR.dh * sc - 6);
    });
  }

  it('the scene measures station proximity from the STAND point, not the furniture centre', () => {
    const src = read('scenes/houseInteriorInteract.js');
    // _checkStationPrompt must pass the byStand flag.
    expect(src).toMatch(/_nearestStation\(p\.x,\s*p\.y,\s*PROMPT_REACH,\s*true\)/);
  });

  it('the interior accepts gamepad A as an interact, not just keyboard/tap', () => {
    const src = read('scenes/houseInteriorInteract.js');
    expect(src).toMatch(/_padInteractJustDown/);
    expect(src).toMatch(/getGamepads/);
  });
});
