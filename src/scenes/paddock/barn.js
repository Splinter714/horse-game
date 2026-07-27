// Barn interior + in-world cutaway (#35). The barn is a WALK-IN building: an interior
// floor/stalls texture drawn UNDER the world, and a front-façade texture drawn OVER it
// that fades to transparent when the player steps inside — the cutaway. Inside are a
// row of stalls the player assigns horses to (persisted) and a visual tack room.
//
// This is a PaddockScene concern mixin (functional-mixin pattern, like world.js). It
// owns: buildBarn (geometry + sprites + collision + loading assignments), the barn
// interactables (assign-a-stall, tack-room hint), the cutaway fade in update, and
// placing assigned horses in their stalls. Method names are unique across the paddock
// composition group (barn*/_barn* prefixes) so the modularity guard stays green.
//
// FIRST-PASS DRAFT for owner playtest — the art (worldArt `barnInterior`/`barnFront`)
// and interior layout are a clean first cut, not final; expect art-direction.

import Phaser from 'phaser';
import { S } from './constants.js';
import { NUM_STALLS, loadBarnState, saveBarnState, assignStall, nextStallOccupant, stallOfHorse } from '../../data/barn.js';
import { SADDLE_TYPES } from '../../data/items.js';

// Design-grid footprint of the barn textures (must match worldArt BARN_W/BARN_H).
const BARN_DW = 160, BARN_DH = 132;
// How fast the façade fades in/out for the cutaway (alpha per ms).
const CUTAWAY_FADE = 0.006;

export const WithBarn = (Base) => class extends Base {
  buildBarn() {
    // South-doorway anchor (origin 0.5,1). Sits on the open farm band between the
    // house and the pasture gate, same neighbourhood as the old placeholder.
    // Position (1585, 1172) - the owner's own placement (#330 drag tool, baked in by #342).
    const ax = 1585, ay = 1172;
    // Sprite → world helpers (origin 0.5,1, scale S). left/top corners in world px.
    const left = ax - (BARN_DW / 2) * S;   // 1425
    const top  = ay - BARN_DH * S;         // 908
    const dx = (d) => left + d * S;        // design-x → world-x
    const dy = (d) => top + d * S;         // design-y → world-y

    // Interior floor drawn under animals/player. Depth just above the ground path
    // layers (-95..-99) but below any creature (creatures use depth = y ≈ 500+).
    this.barnInteriorSprite = this.add.image(ax, ay, 'barnInterior').setScale(S).setDepth(-40).setOrigin(0.5, 1);
    // Front façade overlay drawn OVER occupants (high depth, anchored to its south
    // edge like a tall prop). This is the sprite the cutaway fades.
    this.barnFront = this.add.image(ax, ay, 'barnFront').setScale(S).setDepth(ay).setOrigin(0.5, 1);
    this.barnFrontAlpha = 1;

    // Interior walkable rect (inside the walls, clear of the back stalls). Used to
    // detect "player is inside" for the cutaway and to seat stalled horses.
    this.barnInterior = { x0: dx(14), y0: dy(60), x1: dx(146), y1: dy(126) };

    // Stall stand-spots: one per stall, in front of its hay mound along the back.
    // Divider centres in design space are 55,85,115,145 (see worldArt barnInterior).
    this.barnStalls = [];
    for (let i = 0; i < NUM_STALLS; i++) {
      const cx = 55 + i * 30;
      this.barnStalls.push({
        index: i,
        x: dx(cx), y: dy(74),        // where an assigned horse stands
        signX: dx(cx), signY: dy(39), // nameboard, for the assign prompt anchor
      });
    }

    // Tack room spot (left bay), for the discover-me hint prompt.
    this.barnTack = { x: dx(24), y: dy(70) };

    // Collision: perimeter walls with a south doorway gap. Registered here and spread
    // into this.obstacles by buildObstacles (world.js), which runs after buildWorld.
    const wall = (x0, y0, x1, y1, extra = {}) =>
      ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, isBarn: true, ...extra });
    const bx0 = dx(8), bx1 = dx(152), by0 = dy(52), by1 = dy(130);
    const doorL = dx(58), doorR = dx(102); // doorway gap in the south wall
    const T = 14; // wall thickness
    this.barnObstacles = [
      wall(bx0, by0, bx1, by0 + T),                  // back (north) wall — behind the stalls
      wall(bx0, by0, bx0 + T, by1),                  // left wall
      wall(bx1 - T, by0, bx1, by1),                  // right wall
      wall(bx0, by1 - T, doorL, by1),               // south wall, left of doorway
      wall(doorR, by1 - T, bx1, by1),               // south wall, right of doorway
    ];

    // Persisted stall assignments { stallIndex: horseKey }.
    this.barnState = loadBarnState();

    // props.barn — kept for the barn/house split guard + any consumers. Anchor point
    // is the doorway; `interior` gives the walkable rect. `sprite`/`floor` are the
    // façade + interior-floor images, kept here (not just on scene fields) so the
    // dev drag tool (#330) can move the whole visible barn, not just this record's
    // numbers. The collision walls follow a drag too (they're tagged `own` below);
    // the stalls and the interior rect still stay where the source put them.
    this.props.barn = {
      x: ax, y: ay, interior: this.barnInterior, stalls: this.barnStalls,
      sprite: this.barnFront, floor: this.barnInteriorSprite,
    };
    // Tag the wall rects with the prop record they belong to (#330) so the dev drag
    // tool moves the barn's collision along with its art. Done here rather than in
    // the wall() literals above because props.barn doesn't exist yet at that point.
    for (const w of this.barnObstacles) w.own = this.props.barn;
  }

  // ─── Cutaway ───────────────────────────────────────────────────────────────
  // Fade the front façade out when the player is inside the interior rect (or right
  // at the doorway), back in when they leave. Runs every frame from update().
  updateBarnCutaway(delta) {
    if (!this.barnFront) return;
    const p = this.player?.sprite;
    if (!p) return;
    const r = this.barnInterior;
    // Include a little apron below the doorway so the façade is already clearing as
    // you walk in, not popping once you're fully past the wall.
    const inside = p.x > r.x0 - 20 && p.x < r.x1 + 20 && p.y > r.y0 - 10 && p.y < r.y1 + 40;
    const target = inside ? 0.12 : 1; // keep a faint ghost so the barn's outline stays readable
    const step = CUTAWAY_FADE * delta;
    if (this.barnFrontAlpha < target) this.barnFrontAlpha = Math.min(target, this.barnFrontAlpha + step);
    else if (this.barnFrontAlpha > target) this.barnFrontAlpha = Math.max(target, this.barnFrontAlpha - step);
    this.barnFront.setAlpha(this.barnFrontAlpha);
  }

  // ─── Stall assignment ────────────────────────────────────────────────────────
  // Ordered horse keys currently in the world (roster order), for the assign cycle.
  _barnHorseKeys() {
    return this.horses.map((h) => h.key);
  }

  // Assign / cycle the occupant of a stall, persist, and reseat the horses.
  _barnCycleStall(index) {
    const keys = this._barnHorseKeys();
    const next = nextStallOccupant(this.barnState.stalls, index, keys);
    this.barnState.stalls = assignStall(this.barnState.stalls, index, next);
    saveBarnState(this.barnState);
    this._barnReseat();
    return next;
  }

  // Display name for a stall's occupant (for the prompt), or 'empty'.
  _barnStallLabel(index) {
    const key = this.barnState.stalls[index];
    if (!key) return 'empty';
    return this._animalName?.(key) ?? key;
  }

  // ─── Tack rack (#134 follow-up to #21) ──────────────────────────────────────
  // Fetch-a-saddle-type flow, first pass: the rack is a fixed rack of the three
  // types, permanently in stock (not a physical single item you carry off — the
  // saddle TOOL still lives in the hotbar and equip/remove is unchanged). What the
  // rack picks is WHICH type equipSaddle (riding.js) reaches for next: cycling the
  // rack sets HotbarScene's activeSaddleType, so the next Saddle use on a horse
  // equips (or re-equips, switching type) with that tack. Kept this shape rather
  // than a full pick-up-and-carry item because the existing saddle-as-permanent-
  // hotbar-tool model is load-bearing (mount gating, persistence, riding.js) and a
  // full rework was flagged as bigger/riskier in #134 — this is the additive,
  // clean-integration first pass the issue calls out as acceptable scope.
  _barnCycleSaddleType() {
    const hot = this.scene.get('HotbarScene');
    return hot?.cycleActiveSaddleType?.() ?? 'western';
  }

  _barnActiveSaddleType() {
    return this.scene.get('HotbarScene')?.getActiveSaddleType?.() ?? 'western';
  }

  // Move each assigned horse to stand in its stall; nudge others just out of the
  // doorway so a freshly-unassigned horse doesn't stay parked inside. Purely a
  // teleport of the sprite — the horse AI takes over from there on its next tick.
  _barnReseat() {
    for (const h of this.horses) {
      const idx = stallOfHorse(this.barnState.stalls, h.key);
      if (idx === null) continue;
      const stall = this.barnStalls[idx];
      if (!stall) continue;
      h.sprite.x = stall.x;
      h.sprite.y = stall.y;
      h.sprite.setDepth(stall.y);
      if (h.shadow) { h.shadow.x = stall.x; h.shadow.y = stall.y; }
    }
  }

  // Barn interactables: one "assign" instance per stall (bare-hand interact) plus a
  // passive tack-room hint. Returned by the descriptor wired into interactWorld.
  _barnInteractables() {
    const insts = [];
    for (const st of this.barnStalls) {
      const occ = this._barnStallLabel(st.index);
      insts.push({
        x: st.signX, y: st.signY, tapRadius: 46, reachDist: 70, promptOffsetY: 20,
        canAct: true,
        label: occ === 'empty' ? `Assign stall ${st.index + 1}` : `Stall ${st.index + 1}: ${occ}  •  reassign`,
        approach: () => ({ x: st.x, y: st.y + 40 }),
        activate: () => this._barnCycleStall(st.index),
      });
    }
    // Tack rack (#134 follow-up to #21): interact to cycle which saddle type is
    // active — western → english → bareback → western… The saddle tool itself
    // still equips/removes as before; this just picks which tack it reaches for.
    insts.push({
      x: this.barnTack.x, y: this.barnTack.y, tapRadius: 40, reachDist: 60, promptOffsetY: 20,
      canAct: true,
      label: `Tack Rack: ${SADDLE_TYPES[this._barnActiveSaddleType()].label}  •  switch`,
      approach: () => ({ x: this.barnTack.x, y: this.barnTack.y + 30 }),
      activate: () => this._barnCycleSaddleType(),
    });
    return insts;
  }
};
