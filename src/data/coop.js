// Local two-player co-op (#302) — the PURE decision logic behind the second
// player. No Phaser, no scene: just the maths the coop mixin
// (`scenes/paddock/coop.js`) drives its second body with, so it's unit-testable
// in the `node` test env like every other `src/data` module.
//
// Design in one line: player 2 is a second BODY in the same world, sharing the
// same camera, the same farm and the same save — not a second save file, not a
// split screen, not networked.

// How far player 2 may drift from player 1 before the leash pulls them along.
// Sized so both bodies always fit comfortably inside one camera view at the
// game's logical resolution (the camera follows the MIDPOINT of the two, so the
// worst case is half this in each direction from the centre of the screen).
export const COOP_TETHER = 380;

// Stick deadzone — mirrors the player-1 movement code so both pads feel the same.
export const COOP_DEADZONE = 0.15;

// A movement vector from whatever player 2's scheme produced this frame.
// `keys` is the arrow-key state, `stickX/stickY` a gamepad's left stick.
// Returns a normalised-ish {vx, vy} in the same convention player 1 uses:
// clamped to [-1,1] per axis and scaled by 0.707 on a diagonal so diagonal
// movement isn't faster than straight movement.
export function coopMoveVector({ up = false, down = false, left = false, right = false,
                                 stickX = 0, stickY = 0 } = {}) {
  let vx = 0, vy = 0;
  if (left)  vx -= 1;
  if (right) vx += 1;
  if (up)    vy -= 1;
  if (down)  vy += 1;
  if (Math.abs(stickX) > COOP_DEADZONE) vx += stickX;
  if (Math.abs(stickY) > COOP_DEADZONE) vy += stickY;
  vx = Math.max(-1, Math.min(1, vx));
  vy = Math.max(-1, Math.min(1, vy));
  if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
  return { vx, vy };
}

// Which way a body should face for a movement vector (dominant axis wins), or
// null when it isn't moving. Same rule player 1 uses.
export function coopFacing(vx, vy) {
  if (vx === 0 && vy === 0) return null;
  if (Math.abs(vx) >= Math.abs(vy)) return vx < 0 ? 'left' : 'right';
  return vy < 0 ? 'up' : 'down';
}

// The soft leash. Player 1 is never blocked or slowed by co-op — instead player
// 2 is *dragged along* once the gap opens past `max`, so the pair can never be
// separated further than one screen and player 2 can never be left off-camera.
// Returns the position player 2 should occupy: unchanged when inside the leash,
// otherwise pulled straight back onto the leash circle around player 1.
export function tetherPull(x, y, anchorX, anchorY, max = COOP_TETHER) {
  const dx = x - anchorX, dy = y - anchorY;
  const d = Math.hypot(dx, dy);
  if (d <= max || d === 0) return { x, y, pulled: false };
  const k = max / d;
  return { x: anchorX + dx * k, y: anchorY + dy * k, pulled: true };
}

// Where the shared camera should look. One camera, one screen (no split-screen):
// solo it follows player 1 exactly as before; in co-op it follows the midpoint
// so both bodies stay framed.
export function coopCameraFocus(p1, p2) {
  if (!p2) return { x: p1.x, y: p1.y };
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// Nearest entry of `items` (anything with x/y) to (x,y) within `maxDist`, or
// null. Used to resolve player 2's pet target independently of player 1's
// proximity pass — each player acts on whatever is nearest to THEM.
export function nearestWithin(items, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const it of items) {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}
