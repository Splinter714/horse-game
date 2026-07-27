// Where ambient flyers enter from and leave to (#354).
//
// Background: the bird/owl spawners were written when the world was just the farm
// (x ∈ [0, WORLD_W]), so "off-screen" was hardcoded as `-40` / `WORLD_W + 40`. The
// trail (#36, x down to TRAIL_X0 < 0) and town (#222, x up to TOWN_X1) then pushed
// the world's true edges far past those numbers, so a bird spawning at `WORLD_W + 40`
// now materialises in plain sight at the town edge, and one leaving toward `-40` winks
// out at the forest/trail edge.
//
// Fix: resolve the entry/exit x from the CAMERA's current view instead of any fixed
// world number — just beyond whatever the player can see right now is off-screen no
// matter where in the (much wider) world they're standing. `_spawnHorsePerch` in
// wildlife.js already did exactly this, so this just generalises the pattern.
//
// Pure helpers (they only read `scene.cameras.main.worldView`), unit-tested in
// offscreen.test.js with a stub camera.

import { TRAIL_X0, TOWN_X1 } from './constants.js';

// Fallback when there's no camera yet (tests, very early boot): the true world edges.
const WORLD_LEFT = TRAIL_X0;
const WORLD_RIGHT = TOWN_X1;

// Minimum clearance past a target so a flyer never starts/ends its arc right on top of
// the thing it's heading for, even if the target is currently off-camera.
const TARGET_CLEARANCE = 200;

function viewOf(scene) {
  const v = scene?.cameras?.main?.worldView;
  return v && v.width ? v : null;
}

// The x just outside the current view on the given side. `targetX` (optional) widens
// the span so the result also sits clear of a target that's off-camera.
export function offscreenX(scene, fromLeft, pad = 40, targetX = null) {
  const v = viewOf(scene);
  let left = v ? v.x : WORLD_LEFT;
  let right = v ? v.x + v.width : WORLD_RIGHT;
  if (targetX != null) {
    left = Math.min(left, targetX - TARGET_CLEARANCE);
    right = Math.max(right, targetX + TARGET_CLEARANCE);
  }
  return fromLeft ? left - pad : right + pad;
}

// Where a flyer currently at `x` should exit: whichever side of the view is nearer,
// far enough past it to be out of sight. Returns `{ toLeft, x }`.
export function exitX(scene, x, pad = 60) {
  const v = viewOf(scene);
  const mid = v ? v.x + v.width / 2 : (WORLD_LEFT + WORLD_RIGHT) / 2;
  const toLeft = x < mid;
  return { toLeft, x: offscreenX(scene, toLeft, pad, x) };
}

// Sky band for a fly-by: a height near the top of what's on screen, so a high pass
// reads as a high pass wherever the player is standing (the old fixed y ∈ [90, 300]
// was only overhead back at the farm).
export function skyY(scene, rand, minUp = 60, maxUp = 260) {
  const v = viewOf(scene);
  if (!v) return rand(minUp, maxUp);
  return v.y + rand(minUp, Math.max(minUp + 20, Math.min(maxUp, Math.round(v.height * 0.35))));
}
