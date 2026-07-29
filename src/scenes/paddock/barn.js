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
import {
  NUM_STALLS, loadBarnState, saveBarnState, assignStall, nextStallOccupant, stallOfHorse, isInsideBarn,
  BARN_W as BARN_DW, BARN_H as BARN_DH, STALL_SIGN_Y, STALL_STAND_Y, stallCenterX,
  TACK_X, TACK_Y, WALL_X0, WALL_X1, WALL_Y0, WALL_Y1, DOOR_X0, DOOR_X1,
  BACK_WALL_H, BACK_ROOF_H, FRONT_EAVE, isBehindWall, wallTargetAlpha,
} from '../../data/barn.js';
import { SADDLE_TYPES } from '../../data/items.js';
// How fast the façade fades in/out for the cutaway (alpha per ms).
const CUTAWAY_FADE = 0.006;

export const WithBarn = (Base) => class extends Base {
  buildBarn() {
    // South-doorway anchor (origin 0.5,1).
    //
    // #349 RELOCATED the barn (it used to sit at (1585, 1172); at 680×460 world px
    // it no longer fit there). It briefly anchored at (550, 1360) as a "somewhere it
    // fits" placeholder, then the owner repositioned it to its own spot with the
    // #330 drag tool (baked in below) — the well/trough/Hay Pile were moved along
    // with it (see world.js).
    const ax = 1399, ay = 1306;
    // Sprite → world helpers (origin 0.5,1, scale S). left/top corners in world px.
    const left = ax - (BARN_DW / 2) * S;   // 210
    const top  = ay - BARN_DH * S;         // 900
    const dx = (d) => left + d * S;        // design-x → world-x
    const dy = (d) => top + d * S;         // design-y → world-y

    // Interior floor drawn under animals/player. Depth just above the ground path
    // layers (-95..-99) but below any creature (creatures use depth = y ≈ 500+).
    this.barnInteriorSprite = this.add.image(ax, ay, 'barnInterior').setScale(S).setDepth(-40).setOrigin(0.5, 1);
    // Front façade overlay drawn OVER occupants (high depth, anchored to its south
    // edge like a tall prop). This is the sprite the cutaway fades.
    this.barnFront = this.add.image(ax, ay, 'barnFront').setScale(S).setDepth(ay).setOrigin(0.5, 1);
    this.barnFrontAlpha = 1;

    // Back wall + roof (#362) — always-opaque backdrop for the north side, anchored
    // at the barn's own back (north) wall line rather than the front doorway, so it
    // depth-sorts as a north object per the same "depth = own base world-y"
    // convention front/creatures use: anyone standing south of this line (nearly
    // everyone in/around the barn) has a bigger y/depth and draws in front of it.
    const backY = dy(WALL_Y0);
    this.barnBack = this.add.image(ax, backY, 'barnBack').setScale(S).setDepth(backY).setOrigin(0.5, 1);
    this.barnBackAlpha = 1; // the light see-through dip for #362's behind-the-wall mechanic (not the cutaway fade)

    // Middle roof connector (#362) — a plain roof plane bridging the depth between
    // barnBack's own eave and barnFront's eave, so the silhouette reads as one
    // continuous covered building front-to-back from outside. Stretched vertically
    // (setDisplaySize, not just S) to exactly bridge that gap regardless of the two
    // footprints' exact proportions, rather than hardcoding a height that could
    // drift out of sync. Fades in lockstep with barnFront (updateBarnCutaway).
    const frontEaveY = ay - (BARN_DH - FRONT_EAVE) * S;
    // Reaches all the way up to the PEAK of the back roof's arc (BACK_WALL_H +
    // BACK_ROOF_H above the back wall line), not just its eave — otherwise the
    // connector stopped short of the back gable's tip and the two didn't read as
    // one continuous roof.
    const backPeakY = backY - (BACK_WALL_H + BACK_ROOF_H) * S;
    // Deliberate overlap at the FRONT seam only (2026-07-27 owner feedback: gap at
    // front wasn't hidden by an even 8px both ends; overlapping the BACK made it
    // worse, not better). The connector's own undulating ribbon shape is scaled to
    // fit the front-eave-to-back-peak span exactly, but that stretch can't
    // guarantee pixel-perfect alignment with the two independently-drawn facade
    // textures it bridges — overlapping a little hides the residual rounding
    // instead of chasing exact analytical alignment. barnRoofMid's depth used to
    // be pinned to frontEaveY (a fixed value, always HIGHER than barnBack's own
    // depth, backY) so it drew IN FRONT OF barnBack wherever the two overlap —
    // pushing past backPeakY at the top drew the connector's flat ribbon over
    // barnBack's own cap/cupola art, covering it up.
    //
    // #400: frontEaveY was too LOW a depth for a third relationship this connector
    // also has to satisfy — staying in front of every stalled horse. Horses in the
    // barn depth-sort by their own live y (rendering.js: h.sprite.setDepth(h.sprite.y)),
    // which ranges up to the interior's south edge, dy(WALL_Y1 - 4) — comfortably
    // past frontEaveY, so a horse standing anywhere near the front of the interior
    // sorted ABOVE the roof connector and visibly poked through it. barnFront
    // itself never had this problem: it's pinned to `ay`, which is dy(BARN_H) —
    // strictly greater than dy(WALL_Y1 - 4) since WALL_Y1 - 4 < BARN_H, so no
    // animal inside the barn's walls can ever out-depth it. Pinning barnRoofMid to
    // `ay - 1` borrows that same guarantee (still safely above every stalled/
    // interior horse) while staying just BELOW barnFront (ay), so barnFront still
    // wins their shared front seam — and it's still far above barnBack (backY), so
    // the back-peak relationship above is untouched (ay - 1 >> backY regardless).
    // So: generous overlap at the front (where barnFront's depth, ay, is always
    // higher than the connector's, so barnFront still correctly draws on top),
    // ZERO overlap at the back — it stops exactly at backPeakY, same as before.
    const FRONT_OVERLAP = 24;
    this.barnRoofMid = this.add.image(ax, frontEaveY + FRONT_OVERLAP, 'barnRoofMid')
      .setDisplaySize(BARN_DW * S, Math.max(4, (frontEaveY - backPeakY) + FRONT_OVERLAP))
      .setDepth(ay - 1).setOrigin(0.5, 1);

    // Interior walkable rect (inside the walls, clear of the back stalls). Used to
    // detect "player is inside" for the cutaway, to seat stalled horses, and (since
    // #349) as the rain-shelter area every grazer paths into.
    // y0's margin mirrors x0/x1's: exactly the back wall's own solid thickness
    // (T=16 world px = 8 design units), not an arbitrary bigger gap. #399: the
    // old +18 margin put the "inside" boundary FARTHER from the wall than the
    // player's own collision radius (14px) ever lets them get past the wall's
    // solid face (T=16) — a player standing legally at the very back of the
    // room (as close as collision allows, wallFace + T + playerRadius) was
    // still short of y0, so isInsideBarn falsely read as "outside" and the
    // cutaway faded the front/roof back in while the player was still inside.
    this.barnInterior = { x0: dx(WALL_X0 + 8), y0: dy(WALL_Y0 + 8), x1: dx(WALL_X1 - 8), y1: dy(WALL_Y1 - 4) };

    // Stall stand-spots: one per stall, in front of its hay mound along the back.
    // Geometry comes from data/barn.js, which the interior art draws from too.
    this.barnStalls = [];
    for (let i = 0; i < NUM_STALLS; i++) {
      const cx = stallCenterX(i);
      this.barnStalls.push({
        index: i,
        x: dx(cx), y: dy(STALL_STAND_Y),        // where an assigned horse stands
        signX: dx(cx), signY: dy(STALL_SIGN_Y), // nameboard, for the assign prompt anchor
      });
    }

    // Tack room spot (left bay), for the discover-me hint prompt.
    this.barnTack = { x: dx(TACK_X), y: dy(TACK_Y) };

    // Collision: perimeter walls with a south doorway gap. Registered here and spread
    // into this.obstacles by buildObstacles (world.js), which runs after buildWorld.
    const wall = (x0, y0, x1, y1, extra = {}) =>
      ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, isBarn: true, ...extra });
    const bx0 = dx(WALL_X0), bx1 = dx(WALL_X1), by0 = dy(WALL_Y0), by1 = dy(WALL_Y1);
    const doorL = dx(DOOR_X0), doorR = dx(DOOR_X1); // doorway gap in the south wall
    const T = 16; // wall thickness
    // Doorway column in world-x — the ONLY approach that counts as "entering" for
    // the cutaway (see updateBarnCutaway / isInsideBarn).
    this.barnDoorway = { x0: doorL, x1: doorR };
    // Baked anchor, so the cutaway can re-derive its bounds from the façade's LIVE
    // position if the barn is moved (dev drag tool #330) — same stale-geometry
    // class of bug as #344's fence collision.
    this.barnAnchor = { x: ax, y: ay };
    // (The trough + well sit close enough west of this wall that horses were
    // clustering in the narrow leftover strip between them — 2026-07-27 playtest.
    // That's now handled generically by _findPath's SLIVER_MARGIN in
    // playerMovement.js, which treats any too-tight-to-really-walk-through gap as
    // blocked for route planning; no barn-specific collision padding needed here.)
    //
    // #346: horses were still visibly poking their heads through the LEFT (west)
    // wall while heading for the trough, even after the reachability/arrival
    // fixes above. Root cause isn't a hole in the wall's perimeter — it's a
    // radius mismatch. Real-time collision only keeps a creature's CENTER a
    // body radius (R≈16px) away from a wall's solid face, but the rendered
    // horse sprite reaches much further than that from its own center (its
    // frame is 128px wide at this scale), while the wall's own solid collision
    // is only T=16px thick. So a horse legally hugging the wall at minimum
    // clearance — which happens right at the SW corner, the tightest turn on
    // the route to the west-side trough spots — can draw clean through that
    // thin wall and appear on the interior side. Padding the west wall (and the
    // south-wall segment left of the doorway, so the corner itself is sealed
    // with no diagonal gap) OUTWARD — away from the interior, never touching the
    // doorway or the walkable floor — pushes creatures' legal standoff from the
    // wall's true face out past their own visual reach, without moving the
    // trough, the barn, or its art at all.
    const WALL_VISUAL_PAD = 40;
    this.barnObstacles = [
      wall(bx0, by0, bx1, by0 + T),                                    // back (north) wall — behind the stalls
      wall(bx0 - WALL_VISUAL_PAD, by0, bx0 + T, by1),                  // left wall (padded west, see #346 above)
      wall(bx1 - T, by0, bx1, by1),                                    // right wall
      wall(bx0 - WALL_VISUAL_PAD, by1 - T, doorL, by1),               // south wall, left of doorway (padded west to seal the SW corner)
      wall(doorR, by1 - T, bx1, by1),                                 // south wall, right of doorway
    ];

    // Persisted stall assignments { stallIndex: horseKey }.
    this.barnState = loadBarnState();

    // props.barn — kept for the barn/house split guard + any consumers. Anchor point
    // is the doorway; `interior` gives the walkable rect. `sprite`/`floor`/`back`/
    // `roofMid` are the façade, interior-floor, back-wall, and mid-roof-connector
    // images, kept here (not just on scene fields) so the dev drag tool (#330) can
    // move the WHOLE visible barn as one unit, not just part of it — `_devDragShift`
    // only recurses into GameObjects it can reach one level down off this record, so
    // every sprite that's part of the barn's silhouette has to be listed here or it's
    // left behind (2026-07-27: barnBack/barnRoofMid were added for #362 but never
    // added here, so a drag split the barn into a moved front half and a stationary
    // back half — the general lesson: any multi-sprite world object must register
    // ALL its constituent sprites on its props record, not just one). The collision
    // walls follow a drag too (they're tagged `own` below); the stalls and the
    // interior rect still stay where the source put them. `door` is the middle of
    // the south doorway gap — the way in, and (since #349) what the rain-shelter AI
    // aims for before stepping inside.
    this.props.barn = {
      x: ax, y: ay, interior: this.barnInterior, doorway: this.barnDoorway, stalls: this.barnStalls,
      door: { x: dx((DOOR_X0 + DOOR_X1) / 2), y: dy(WALL_Y1) },
      sprite: this.barnFront, floor: this.barnInteriorSprite,
      back: this.barnBack, roofMid: this.barnRoofMid,
    };
    // Tag the wall rects with the prop record they belong to (#330) so the dev drag
    // tool moves the barn's collision along with its art. Done here rather than in
    // the wall() literals above because props.barn doesn't exist yet at that point.
    for (const w of this.barnObstacles) w.own = this.props.barn;
  }

  // ─── Cutaway ───────────────────────────────────────────────────────────────
  // Re-derive the barn's LIVE interior/doorway rects from the façade sprite's
  // current position vs. its baked anchor, so a dev-drag-tool (#330) move of the
  // barn is reflected everywhere that needs to know "is X inside the barn" —
  // the cutaway fade (updateBarnCutaway) and the generic indoors check
  // (isAgentIndoors, #350) both call this instead of duplicating the offset math.
  _barnLiveRects() {
    const ox = this.barnFront.x - (this.barnAnchor?.x ?? this.barnFront.x);
    const oy = this.barnFront.y - (this.barnAnchor?.y ?? this.barnFront.y);
    const r = this.barnInterior, d = this.barnDoorway;
    const rect = (ox || oy) ? { x0: r.x0 + ox, x1: r.x1 + ox, y0: r.y0 + oy, y1: r.y1 + oy } : r;
    const door = ox ? { x0: d.x0 + ox, x1: d.x1 + ox } : d;
    return { rect, door };
  }

  // Fade the front façade out when the player is actually INSIDE the barn (or in its
  // doorway walking in), back in when they leave. Runs every frame from update().
  // The trigger bounds are re-derived from the façade sprite's LIVE position so a
  // moved barn (dev drag tool) doesn't leave the cutaway triggering at the old spot.
  //
  // barnRoofMid fades in LOCKSTEP with barnFront (#362, same trigger/alpha every
  // frame) — it's the connecting roof piece between the front and the ALWAYS-opaque
  // back wall (barnBack, which this does NOT touch — see updateBarnBackWall below).
  updateBarnCutaway(delta) {
    if (!this.barnFront) return;
    const p = this.player?.sprite;
    if (!p) return;
    const { rect, door } = this._barnLiveRects();
    const inside = isInsideBarn(rect, door, p.x, p.y);
    const target = inside ? 0 : 1; // fully invisible while inside — the barn now has a real back wall/roof, so there's no longer a need for a ghost outline
    const step = CUTAWAY_FADE * delta;
    if (this.barnFrontAlpha < target) this.barnFrontAlpha = Math.min(target, this.barnFrontAlpha + step);
    else if (this.barnFrontAlpha > target) this.barnFrontAlpha = Math.max(target, this.barnFrontAlpha - step);
    this.barnFront.setAlpha(this.barnFrontAlpha);
    this.barnRoofMid?.setAlpha(this.barnFrontAlpha);
  }

  // ─── Generic back-wall see-through (#362) ───────────────────────────────────
  // A back wall is normally fully opaque (unlike the front, it never does the
  // interior cutaway) — but if the player walks around BEHIND it (north of its
  // own face), it gets a light, non-fading-to-nothing transparency instead of
  // fully hiding them, same spirit as _barnLiveRects()/isInsideBarn() but for a
  // different question ("is the player on the far side of THIS wall").
  //
  // Deliberately parameterized by wall sprite + footprint (not hardcoded to
  // `this.barnBack`) so a future second walled building can opt into the same
  // mechanic by calling this with its own back-wall sprite/rect instead of a
  // barn-only one-off. `wall` is `{ x0, x1, y }` in LIVE world coordinates (see
  // isBehindWall in data/barn.js). `alphaKey` names the scene field that tracks
  // this sprite's current fade state (so multiple walls can each keep their own).
  updateWallSeeThrough(sprite, wall, alphaKey, delta) {
    if (!sprite || !wall) return;
    const p = this.player?.sprite;
    const behind = p ? isBehindWall(wall, p.x, p.y) : false;
    const target = wallTargetAlpha(behind);
    const step = CUTAWAY_FADE * delta;
    let a = this[alphaKey] ?? 1;
    if (a < target) a = Math.min(target, a + step);
    else if (a > target) a = Math.max(target, a - step);
    this[alphaKey] = a;
    sprite.setAlpha(a);
  }

  // Barn-specific wiring for the generic mechanic above: the back wall's own
  // face is the barn's back (north) wall line, re-derived from its LIVE position
  // the same way _barnLiveRects() re-derives the interior/doorway (#330 drag-tool
  // safe).
  updateBarnBackWall(delta) {
    if (!this.barnBack) return;
    const r = this._barnLiveRects().rect;
    const wall = { x0: r.x0, x1: r.x1, y: this.barnBack.y };
    this.updateWallSeeThrough(this.barnBack, wall, 'barnBackAlpha', delta);
  }

  // ─── Indoors check (#350) ───────────────────────────────────────────────────
  // Generic "is this animal currently indoors" check, so outdoor-only AMBIENT
  // behaviors (graze, wallow, herd-clustering — anything with no location sense
  // of its own, assuming "the ground under me is grass/mud") can decline to fire
  // while an animal is sheltering inside a building. Named generically (not
  // isAgentInBarn) because the barn is the only building today, but this is meant
  // to generalize to a second building later by extending this one check rather
  // than hand-patching each ambient behavior.
  isAgentIndoors(agent) {
    if (!this.barnInterior) return false;
    const p = agent?.sprite;
    if (!p) return false;
    const { rect, door } = this._barnLiveRects();
    return isInsideBarn(rect, door, p.x, p.y);
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
