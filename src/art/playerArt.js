// Procedural pixel-art player character. 16×24 sprite, 4 directions, 4 walk frames each.
// Rendered at scale 3 in the world (48×72 on screen). Origin (0.5, 1) — feet at bottom.
//
// Walk cycle is 4 frames: 0 = passing (neutral), 1 = left-foot lead,
// 2 = passing (neutral), 3 = right-foot lead. Frame 0 doubles as the idle pose.
// Arms swing opposite the same-side leg for a natural gait.
//
// The look is data-driven (#44): buildPlayerTextures takes a resolved `look` from
// data/customize.js (lookFromKeys('player', …)) carrying colour ramps (hair/skin/eyes/
// shirt/bottomColor) plus shape KEYS (hairStyle, sleeves, bottom). Called with no look
// it falls back to defaultLook('player'), which reproduces the original sprite exactly.
// Shoes are not customizable, so they stay a fixed dark brown.

import { gen } from './_frames.js';
import { defaultLook } from '../data/customize.js';

const SHOE = 0x2a1808; // dark brown — fixed (no shoe customization)

// Resolve a customizer `look` into the flat palette + shape flags the draw fns read.
function palette(look) {
  const L = look || defaultLook('player');
  return {
    HAIR:    L.hair.main,
    SKIN:    L.skin.main,
    EYE:     L.eyes.color,
    SHIRT:   L.shirt.main,
    SHIRT_D: L.shirt.shad,
    PANTS:   L.bottomColor.main, // "pants" colour also clothes the skirt
    PANTS_D: L.bottomColor.shad,
    SHOE,
    hairStyle: L.hairStyle, // 'short' | 'long' | 'bun'
    sleeves:   L.sleeves,   // 'long'  | 'short' | 'none'
    bottom:    L.bottom,    // 'pants' | 'skirt'
  };
}

// Per-frame stride for the front/back views. lead: 0 = none, -1 = left foot
// forward, +1 = right foot forward. A forward foot plants lower (toward camera
// for "down", away for "up"); the trailing foot lifts.
const STRIDE = [0, -1, 0, 1];

// One front/back arm (3px wide, `len` tall from `topY`). The sleeve covers the top of
// the arm; the rest is bare skin. Long = full sleeve, Short = a 2px cap, Sleeveless = none.
function drawArmVert(g, x, topY, len, P) {
  const sleeveLen = P.sleeves === 'long' ? len : P.sleeves === 'short' ? 2 : 0;
  if (sleeveLen > 0) { g.fillStyle(P.SHIRT, 1); g.fillRect(x, topY, 3, sleeveLen); }
  if (sleeveLen < len) { g.fillStyle(P.SKIN, 1); g.fillRect(x, topY + sleeveLen, 3, len - sleeveLen); }
}

// Pants legs OR a flared skirt for the front/back views, given the stride lead. Pants
// draw two PANTS-coloured legs; a skirt is a PANTS-coloured flare over bare (skin) lower
// legs. Either way the same shoes plant at the bottom.
function drawBottomVert(g, lead, P) {
  if (P.bottom === 'skirt') {
    g.fillStyle(P.PANTS, 1);
    g.fillRect(4, 15, 8, 3);   // waist (y15–18)
    g.fillRect(3, 18, 10, 2);  // flare (y18–20)
    g.fillStyle(P.PANTS_D, 1);
    g.fillRect(3, 19, 10, 1);  // hem shadow
    drawLegsVert(g, lead, P, P.SKIN, 20); // bare lower legs + shoes below the hem
  } else {
    g.fillStyle(P.PANTS, 1);
    g.fillRect(4, 15, 8, 2);   // waistband
    drawLegsVert(g, lead, P, P.PANTS, 16);
  }
}

// The two legs + shoes for the front/back views. `legColor`/`legTopY` let the same
// routine draw full pants (PANTS from y16) or bare lower legs under a skirt (SKIN from y20).
function drawLegsVert(g, lead, P, legColor, legTopY) {
  let llY = legTopY, rlY = legTopY;
  let lsY = 21, rsY = 21;
  const llX = 5, rlX = 9, lsX = 4, rsX = 9;
  if (lead === -1) {        // left foot forward, right trailing
    llY = legTopY + 1; lsY = 22;
    rlY = legTopY - 1; rsY = 20;
  } else if (lead === 1) {  // right foot forward, left trailing
    rlY = legTopY + 1; rsY = 22;
    llY = legTopY - 1; lsY = 20;
  }
  g.fillStyle(legColor, 1);
  g.fillRect(llX, llY, 2, 24 - llY);
  g.fillRect(rlX, rlY, 2, 24 - rlY);
  if (legColor === P.PANTS) {                 // subtle inseam shadow on pants only
    g.fillStyle(P.PANTS_D, 1);
    g.fillRect(llX + 1, llY + 2, 1, 2);
    g.fillRect(rlX + 1, rlY + 2, 1, 2);
  }
  g.fillStyle(P.SHOE, 1);
  g.fillRect(lsX, lsY, 3, 3);
  g.fillRect(rsX, rsY, 3, 3);
}

// Hands for the front/back views. Arms swing opposite the same-side leg, so a
// forward foot pairs with a raised (back) hand on that side.
function drawHandsVert(g, lead, P) {
  let lhY = 14, rhY = 14;
  if (lead === -1) { lhY = 13; rhY = 15; }      // left leg fwd → left arm back
  else if (lead === 1) { lhY = 15; rhY = 13; }  // right leg fwd → right arm back
  g.fillStyle(P.SKIN, 1);
  g.fillRect(2, lhY, 2, 2);
  g.fillRect(12, rhY, 2, 2);
}

// Facing down (toward camera) — we see the face.
function drawDown(g, frame, P) {
  const lead = STRIDE[frame];

  // Hair top + sides framing the face. Style sets how far the sides hang; a bun pulls
  // the hair back (minimal sides), long hangs past the jaw.
  const sideH = P.hairStyle === 'long' ? 9 : P.hairStyle === 'bun' ? 3 : 6;
  g.fillStyle(P.HAIR, 1);
  g.fillRect(4, 0, 8, 3);
  g.fillRect(3, 2, 2, sideH);  // left side
  g.fillRect(11, 2, 2, sideH); // right side

  // Face (drawn after hair, overwrites center hair pixels to show skin)
  g.fillStyle(P.SKIN, 1);
  g.fillRect(5, 2, 6, 7);

  // Eyes
  g.fillStyle(P.EYE, 1);
  g.fillRect(6, 5, 1, 2);
  g.fillRect(9, 5, 1, 2);

  // Shirt torso + arms
  g.fillStyle(P.SHIRT, 1);
  g.fillRect(4, 9, 8, 6);
  drawArmVert(g, 2, 9, 5, P);   // left arm
  drawArmVert(g, 11, 9, 5, P);  // right arm
  g.fillStyle(P.SHIRT_D, 1);
  g.fillRect(4, 13, 8, 2);      // bottom shadow

  // Long hair drapes over the shoulders (drawn over the arms).
  if (P.hairStyle === 'long') {
    g.fillStyle(P.HAIR, 1);
    g.fillRect(3, 9, 1, 4);
    g.fillRect(12, 9, 1, 4);
  }

  drawHandsVert(g, lead, P);
  drawBottomVert(g, lead, P);
}

// Facing up (away from camera) — we see the back of the head.
function drawUp(g, frame, P) {
  const lead = STRIDE[frame];

  // Back of head (all hair).
  g.fillStyle(P.HAIR, 1);
  g.fillRect(4, 0, 8, 3);
  g.fillRect(3, 2, 10, 6);  // wide hair covering back of head
  g.fillRect(3, 7, 2, 2);   // hair sides hanging
  g.fillRect(11, 7, 2, 2);

  // Tiny neck
  g.fillStyle(P.SKIN, 1);
  g.fillRect(7, 8, 2, 1);

  // Shirt + arms
  g.fillStyle(P.SHIRT, 1);
  g.fillRect(4, 9, 8, 6);
  drawArmVert(g, 2, 9, 5, P);
  drawArmVert(g, 11, 9, 5, P);
  g.fillStyle(P.SHIRT_D, 1);
  g.fillRect(4, 13, 8, 2);

  // Long hair runs down the back over the shirt; a bun is a knot at the crown.
  if (P.hairStyle === 'long') {
    g.fillStyle(P.HAIR, 1);
    g.fillRect(4, 9, 8, 4);
  } else if (P.hairStyle === 'bun') {
    g.fillStyle(P.HAIR, 1);
    g.fillCircle(8, 2, 2.4);
  }

  drawHandsVert(g, lead, P);
  drawBottomVert(g, lead, P);
}

// Facing right (side profile). Flipped for left.
// Side stride alternates which leg leads: frame 1 swings the near (front) leg
// forward, frame 3 swings the far (back) leg forward; arms swing opposite.
function drawSide(g, frame, P) {
  const lead = STRIDE[frame]; // -1 near leg fwd, +1 far leg fwd, 0 passing

  // Hair — back hangs left, slight front tuft. Long extends down the back; bun is a
  // knot bulging off the back of the head.
  const backH = P.hairStyle === 'long' ? 14 : 7;
  g.fillStyle(P.HAIR, 1);
  g.fillRect(5, 0, 7, 3);        // hair top
  g.fillRect(3, 2, 4, backH);    // hair back (left side of sprite)
  g.fillRect(11, 1, 2, 4);       // hair front tuft
  if (P.hairStyle === 'bun') g.fillCircle(4, 3, 2.4);

  // Face profile (right side of frame)
  g.fillStyle(P.SKIN, 1);
  g.fillRect(7, 2, 6, 7);        // face (overwrites front hair tuft at face level)

  // Eye (single eye in profile, toward front of face)
  g.fillStyle(P.EYE, 1);
  g.fillRect(10, 4, 1, 2);

  // Shirt body (slightly narrower in profile)
  g.fillStyle(P.SHIRT, 1);
  g.fillRect(5, 9, 7, 6);
  g.fillStyle(P.SHIRT_D, 1);
  g.fillRect(5, 13, 7, 2);

  // Arms — front arm swings forward when the near leg trails (lead +1) and back when
  // the near leg leads (lead -1). Sleeves cover the top of each arm; bare skin below.
  const armF = lead === -1 ? 11 : (lead === 1 ? 13 : 11);
  const armB = lead === -1 ? 3  : (lead === 1 ? 5  : 4);
  drawSideArm(g, armF, 9, 5, P); // front arm
  drawSideArm(g, armB, 10, 4, P); // back arm (shorter, partially occluded)

  // Hands
  g.fillStyle(P.SKIN, 1);
  g.fillRect(armF, 13, 2, 2);
  g.fillRect(armB, 13, 2, 2);

  drawSideBottom(g, lead, P);
}

// One side-view arm (2px wide). Sleeve length mirrors the front/back arms.
function drawSideArm(g, x, topY, len, P) {
  const sleeveLen = P.sleeves === 'long' ? len : P.sleeves === 'short' ? 2 : 0;
  if (sleeveLen > 0) { g.fillStyle(P.SHIRT, 1); g.fillRect(x, topY, 2, sleeveLen); }
  if (sleeveLen < len) { g.fillStyle(P.SKIN, 1); g.fillRect(x, topY + sleeveLen, 2, len - sleeveLen); }
}

// Side-view pants legs OR skirt + bare lower legs.
function drawSideBottom(g, lead, P) {
  if (P.bottom === 'skirt') {
    g.fillStyle(P.PANTS, 1);
    g.fillRect(5, 15, 7, 3);   // waist (y15–18)
    g.fillRect(4, 18, 9, 2);   // flare (y18–20)
    g.fillStyle(P.PANTS_D, 1);
    g.fillRect(4, 19, 9, 1);   // hem shadow
    drawSideLegs(g, lead, P, P.SKIN, 20);
  } else {
    g.fillStyle(P.PANTS, 1);
    g.fillRect(5, 15, 7, 2);   // waistband
    drawSideLegs(g, lead, P, P.PANTS, 16);
  }
}

// Side-view legs. Near leg under body center (x=7), far leg behind (x=6). On a step the
// leading leg reaches forward (+x) and plants lower; the trailing leg pulls back and lifts.
function drawSideLegs(g, lead, P, legColor, legTopY) {
  let nearX = 7, nearY = legTopY, nearShoeX = 7, nearShoeY = 21;
  let farX = 6,  farY = legTopY,  farShoeX = 6,  farShoeY = 21;
  if (lead === -1) {          // near leg forward
    nearX = 8; nearShoeX = 8; nearShoeY = 21;
    farX = 5;  farY = legTopY + 1; farShoeX = 5; farShoeY = 20; // back leg lifted
  } else if (lead === 1) {    // far leg forward, near leg pulled back/lifted
    nearX = 6; nearY = legTopY + 1; nearShoeX = 6; nearShoeY = 20;
    farX = 8;  farY = legTopY;      farShoeX = 8; farShoeY = 21;
  }

  g.fillStyle(legColor, 1);
  g.fillRect(farX, farY, 2, 24 - farY);    // far leg (drawn first, behind)
  g.fillRect(nearX, nearY, 2, 24 - nearY); // near leg
  if (legColor === P.PANTS) {
    g.fillStyle(P.PANTS_D, 1);
    g.fillRect(nearX + 1, nearY + 2, 1, 2);
  }

  g.fillStyle(P.SHOE, 1);
  g.fillRect(farShoeX, farShoeY, 2, 2);  // far shoe (behind)
  g.fillRect(nearShoeX, nearShoeY, 3, 3); // near shoe
}

export function buildPlayerTextures(scene, look) {
  const P = palette(look);
  for (let f = 0; f < 4; f++) {
    gen(scene, `player_down_${f}`, 16, 24, (g) => drawDown(g, f, P));
    gen(scene, `player_up_${f}`,   16, 24, (g) => drawUp(g, f, P));
    gen(scene, `player_side_${f}`, 16, 24, (g) => drawSide(g, f, P));
  }
}
