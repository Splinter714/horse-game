// #354 — ambient flyers must enter/leave past the CURRENT camera view, not the old
// farm-edge constants (which the trail/town extensions turned into mid-map positions).

import { describe, it, expect } from 'vitest';
import { offscreenX, exitX, skyY } from './offscreen.js';
import { TRAIL_X0, TOWN_X1, WORLD_W } from './constants.js';

// A stub scene exposing just the camera worldView the helpers read.
const sceneAt = (x, y = 0, width = 960, height = 640) => ({
  cameras: { main: { worldView: { x, y, width, height } } },
});

const rand = (a, b) => Math.round((a + b) / 2); // deterministic stand-in for Between

describe('offscreenX', () => {
  it('returns a point outside the current view on each side', () => {
    const s = sceneAt(600);
    expect(offscreenX(s, true)).toBeLessThan(600);
    expect(offscreenX(s, false)).toBeGreaterThan(600 + 960);
  });

  it('is view-relative — a player out in town gets town-side spawn points', () => {
    // Standing in town (east of the old WORLD_W edge): the old code spawned birds at
    // WORLD_W + 40, which is now well inside the visible town.
    const s = sceneAt(TOWN_X1 - 900);
    expect(offscreenX(s, false)).toBeGreaterThan(WORLD_W + 40);
    expect(offscreenX(s, true)).toBeCloseTo(TOWN_X1 - 900 - 40, 5); // just off the view
  });

  it('is view-relative out west on the trail as well', () => {
    const s = sceneAt(TRAIL_X0 + 100); // deep on the forest trail
    expect(offscreenX(s, true)).toBeLessThan(-40); // old fixed -40 was visible here
  });

  it('clears an off-camera target on the correct side', () => {
    const s = sceneAt(0);
    const target = 3000; // far east of the view
    expect(offscreenX(s, false, 40, target)).toBeGreaterThan(target);
    expect(offscreenX(s, true, 40, target)).toBeLessThan(0);
  });

  it('falls back to the true world edges without a camera', () => {
    expect(offscreenX({}, true)).toBeLessThan(TRAIL_X0);
    expect(offscreenX({}, false)).toBeGreaterThan(TOWN_X1);
  });
});

describe('exitX', () => {
  it('leaves by the nearer view edge', () => {
    const s = sceneAt(1000); // view spans 1000..1960
    expect(exitX(s, 1100).toLeft).toBe(true);
    expect(exitX(s, 1900).toLeft).toBe(false);
  });

  it('exits past the view, not the old farm edge', () => {
    const s = sceneAt(TOWN_X1 - 960);
    const e = exitX(s, TOWN_X1 - 100);
    expect(e.toLeft).toBe(false);
    expect(e.x).toBeGreaterThan(TOWN_X1);
  });

  it('never leaves the flyer short of where it already is', () => {
    const s = sceneAt(0);
    const e = exitX(s, -500); // already off to the west of the view
    expect(e.toLeft).toBe(true);
    expect(e.x).toBeLessThan(-500);
  });
});

describe('skyY', () => {
  it('sits near the top of the current view, wherever it is scrolled', () => {
    const s = sceneAt(0, 1200, 960, 640);
    const y = skyY(s, rand);
    expect(y).toBeGreaterThan(1200);
    expect(y).toBeLessThan(1200 + 640 * 0.5);
  });

  it('falls back to a fixed band without a camera', () => {
    expect(skyY({}, rand)).toBe(rand(60, 260));
  });
});
