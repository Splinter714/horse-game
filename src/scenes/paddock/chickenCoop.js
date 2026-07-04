// Chicken coop interior + in-world cutaway (#53), mirroring the barn's walk-in
// pattern (#35): an interior texture (floor/nestboxes/roost bar) drawn UNDER the
// world, and a front-façade texture drawn OVER it that fades to transparent when
// the player is near/inside — the cutaway. Unlike the barn (a large walkable
// structure), the coop footprint is small and the flock roosts autonomously (no
// player-assigned stalls) — so this mixin's job is purely VISUAL: give the
// existing roost/leave-coop flow (paddock/dayNight.js chickenRoost/chickenLeaveCoop)
// fixed, visible "inside" spots to tuck a roosting bird into, instead of the old
// setVisible(false) that made them vanish.
//
// This is a PaddockScene concern mixin (functional-mixin pattern, like barn.js).
// Method names are unique across the paddock composition group (coop*/_coop*
// prefixes) so the modularity guard stays green.

import { S } from './constants.js';

// Design-grid footprint of the coop textures (must match worldArt COOP_W/COOP_H).
const COOP_DW = 64, COOP_DH = 52;
// How fast the façade fades in/out for the cutaway (alpha per ms) — same feel as
// the barn's cutaway.
const CUTAWAY_FADE = 0.006;
// Faint ghost alpha kept while inside, so the coop's silhouette stays readable
// (mirrors the barn's 0.12 floor).
const CUTAWAY_MIN_ALPHA = 0.12;

export const WithChickenCoop = (Base) => class extends Base {
  // `ax`/`ay` — the south-anchor (origin 0.5,1) the old bare `coop` sprite used.
  buildChickenCoop(ax, ay) {
    const dx = (d) => ax + (d - COOP_DW / 2) * S; // design-x → world-x
    const dy = (d) => ay + (d - COOP_DH) * S;      // design-y → world-y

    // Interior floor/nestboxes/roost drawn under the flock (low depth, like the
    // barn interior) — anything standing "inside" occludes it correctly.
    this.add.image(ax, ay, 'coopInterior').setScale(S).setDepth(-40).setOrigin(0.5, 1);
    // Front façade overlay (walls/roof/pop-door/ramp) drawn over occupants; this
    // is the sprite the cutaway fades.
    this.coopFront = this.add.image(ax, ay, 'coopFront').setScale(S).setDepth(ay).setOrigin(0.5, 1);
    this.coopFrontAlpha = 1;

    // Interior walkable-ish rect (inside the walls), used to detect "player is
    // near/inside" for the cutaway fade — mirrors barnInterior's role.
    this.coopInteriorRect = { x0: dx(8), y0: dy(18), x1: dx(56), y1: dy(52) };

    // Roost spots — fixed "inside" positions a roosting bird is tucked into so it
    // stays VISIBLE (behind the fading façade) instead of vanishing. One row along
    // the back roost bar, one per nesting box; birds beyond that share the bar with
    // a little jitter so more than a handful can still be seen roosting together.
    this.coopRoostSpots = [
      { x: dx(21), y: dy(27) }, { x: dx(32), y: dy(27) }, { x: dx(43), y: dy(27) },
      { x: dx(15), y: dy(38) }, { x: dx(50), y: dy(38) },
    ];

    // Roost geometry: the pop-door and the foot of its ramp, in world space
    // (unchanged from the old bare-sprite coop so dayNight.js's roost/leave-coop
    // tween paths need no edits). door ≈ local (17,39), ramp foot ≈ local (10,52).
    this.props.coop = {
      x: ax, y: ay,
      doorX: dx(17), doorY: dy(39),
      rampX: dx(10), rampY: ay,
    };
  }

  // A stable per-bird roost spot (so the same hen doesn't jump between spots
  // across nights): keys off the trailing digit of its sprite key, wrapping
  // through the fixed spot list.
  _coopRoostSpotFor(a) {
    const idx = a.key.charCodeAt(a.key.length - 1) || 0;
    return this.coopRoostSpots[idx % this.coopRoostSpots.length];
  }

  // ─── Cutaway ───────────────────────────────────────────────────────────────
  // Fade the front façade out when the player is near/inside the coop footprint
  // (or it's night and the flock is roosting, so you can always glimpse them
  // tucked in even from a short distance), back in otherwise. Runs every frame
  // from update(), mirroring updateBarnCutaway.
  updateCoopCutaway(delta) {
    if (!this.coopFront) return;
    const p = this.player?.sprite;
    if (!p) return;
    const r = this.coopInteriorRect;
    const nearOrInside = p.x > r.x0 - 30 && p.x < r.x1 + 30 && p.y > r.y0 - 20 && p.y < r.y1 + 40;
    const target = nearOrInside ? CUTAWAY_MIN_ALPHA : 1;
    const step = CUTAWAY_FADE * delta;
    if (this.coopFrontAlpha < target) this.coopFrontAlpha = Math.min(target, this.coopFrontAlpha + step);
    else if (this.coopFrontAlpha > target) this.coopFrontAlpha = Math.max(target, this.coopFrontAlpha - step);
    this.coopFront.setAlpha(this.coopFrontAlpha);
  }
};
