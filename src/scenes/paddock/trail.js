// Riding trail (#36) — a CONTINUOUS westward extension of the same world/scene
// (no loading screen, no scene swap, unlike the house interior). Walking off the
// paddock's west edge just keeps going: the camera bounds and PLAYER_BOUNDS were
// already widened in constants.js/player.js, so this mixin only needs to build
// the trail's terrain/scenery and its one bare-hand collectible interactable.
// Open to explore on foot OR horseback — the saddle isn't a hard gate (the
// original pre-session issue idea), per the scoped #36 decision.
//
// Kept a separate concern file (not grown into world.js, which is already near
// the 500-line budget) so this doesn't collide with other agents editing the
// farm's world.js in parallel.
//
// 2026-07-06 playtest follow-up (#36):
//   "Make the trail bigger — a long loop rather than the current shorter
//   stretch." TRAIL_W/TRAIL_Y0/TRAIL_Y1 (constants.js) nearly doubled, and
//   the dirt path is now a closed LOOP (out along the top, curls around the
//   far west end, back along the bottom, closing back at the entrance)
//   instead of one dead-end line — you can walk the whole loop and end up
//   back at the farm.
// (A second playtest point — "minimap feels too abstract, no concrete
// alternative decided yet" — is a genuine open design question, not a
// concrete fix, so it's intentionally NOT touched here; see hotbar/minimap.js.)
//
// #381: the trail used to carry its own cooler ground tint, softened at the
// farm/trail boundary and (after #371) at the band's top/bottom edges by a
// gradient-overlay + RenderTexture alpha-mask. After several rounds chasing
// that seam, the owner's call was to drop per-region ground tinting
// entirely — the trail's ground is now plain grass, same as the farm.

import { S, TRAIL_X0, TRAIL_W, TRAIL_Y0, TRAIL_Y1, PLAYER_BOUNDS } from './constants.js';
import { playGather } from '../../audio/sounds.js';

export const WithTrail = (Base) => class extends Base {
  buildTrail() {
    // Trail ground — plain grass, same texture/tiling as the farm (no tint
    // layer; see file header). Reuses the existing grass texture tiled
    // across the extension band. Spans the full PLAYER_BOUNDS Y-range (not
    // just TRAIL_Y0/Y1, which only bound where the trail's CONTENT sits) so
    // there's no textureless gap north/south of the trail where the player
    // can still walk.
    const top = PLAYER_BOUNDS.minY, bandH = PLAYER_BOUNDS.maxY - PLAYER_BOUNDS.minY;
    this.add.tileSprite(TRAIL_X0, top, TRAIL_W, bandH, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    // A worn dirt path leading off the farm's west edge into the trail. Bigger
    // trail playtest fix #1: instead of one dead-end line, this is now a closed
    // LOOP — out along the top of the band, curling around the far-west end,
    // back along the bottom, and closing back at the entrance — so there's a
    // long circuit to explore rather than a short there-and-back stretch.
    const midY = (TRAIL_Y0 + TRAIL_Y1) / 2;
    const topY = TRAIL_Y0 + 90, botY = TRAIL_Y1 - 90;
    const farX = TRAIL_X0 + 140;
    // Added as one more named entry in `this._pathRoutes` (#373 follow-up),
    // NOT a separate system — it goes through world.js's `buildPath`-owned
    // `_pathRoutes` / `_bakePathGraphics()`, the exact same code the farm
    // paths use, so the dev spline-drag tool (splineDrag.js) treats it as
    // just another draggable route with no special-casing. The loop is
    // CLOSED — the first and last waypoints are the literal SAME array
    // reference (not just equal values), so dragging that shared point moves
    // both ends together automatically (it's one logical point, not two).
    const start = [20, midY];
    this._pathRoutes.forestLoop = [
      start,
      [-180, topY + 30], [-520, topY - 20], [-900, topY + 40], [-1280, topY + 20],
      [farX, midY],
      [-1280, botY - 20], [-900, botY - 40], [-520, botY + 20], [-180, botY - 30],
      start,
    ];
    // A simple marker at the trail's mouth (the farm side) so the entrance
    // reads clearly from the paddock, and so the minimap has a landmark to
    // show. Set before the rebake so `_bakePathGraphics()` can keep it in
    // sync with `forestLoop`'s shared start/end point on future reshapes.
    this.props.trailEntrance = { x: start[0], y: start[1] };
    this._bakePathGraphics();

    // Scenery: trees and mossy rocks scattered through the (now much bigger)
    // trail band so it still feels like the same world's palette. Deterministic
    // layout (not random) so the smoke test / dissect tool see a stable scene.
    const trees = [
      // Several entries are the owner's own placements (#330 drag tool, baked in
      // by #335/#338) rather than the original deterministic scatter.
      [-322, 243], [-260, 460], [-420, 320], [-560, 560], [-700, 380],
      [-820, 620], [-293, 799], [-352, 1029], [-545, 941], [-700, 1072],
      [-860, 260], [-180, 480],
      [-960, 340], [-1100, 560], [-1240, 380], [-1080, 900], [-1220, 1040],
      [-1400, 500], [-1409, 753], [-1420, 260], [-862, 824], [-960, 1060],
    ];
    // Tracked in props (#329 follow-up) so the dev object-label/drag tools
    // (#329/#330) can see and reposition each tree/rock — previously these were
    // untracked loose `this.add.image` calls invisible to `_devLabelTargets()`.
    (this.props.trees ??= []);
    for (const [i, [x, y]] of trees.entries()) {
      const sprite = this.add.image(x, y, 'trailTree').setScale(S).setDepth(y).setOrigin(0.5, 1);
      this.props.trees.push({ x, y, sprite, label: `Trail Tree ${i + 1}` });
    }

    const rocks = [
      [-252, 309], [-300, 620], [-480, 240], [-616, 751], [-780, 480], [-205, 914],
      [-1000, 460], [-1160, 700], [-1340, 460], [-1320, 879], [-1040, 1000],
    ];
    (this.props.rocks ??= []);
    for (const [i, [x, y]] of rocks.entries()) {
      const sprite = this.add.image(x, y, 'trailRock').setScale(S).setDepth(y).setOrigin(0.5, 1);
      this.props.rocks.push({ x, y, sprite, label: `Rock ${i + 1}` });
    }

    // One trailside collectible (#36 v1, made sellable per the 2026-07-26 playtest
    // follow-up): a lost trinket that disappears once picked up. Respawns are out
    // of scope for v1; this is just enough to prove the "something to find out
    // here" beat. Moved further out into the loop now that the trail is bigger.
    this.props.trailCollectible = {
      // Position (-1174, 673) — the owner's own placement (#330 drag tool, baked in by #338).
      x: -1174, y: 673, found: false,
      sprite: this.add.image(-1174, 673, 'trailTrinket').setScale(S).setDepth(673),
    };

  }

  // Interactable descriptor for the trailside collectible. Sellable-goods follow-up
  // (#36, 2026-07-26 playtest): picking it up now requires an equipped basket, like
  // the other gathered goods (eggs, honey) — it's carried home and sold at the farm
  // stand instead of handing over a flat cash reward on the spot.
  _trailInteractables() {
    const collectible = (item) => {
      const c = this.props.trailCollectible;
      if (!c || c.found) return [];
      const hasBasket = item?.carrier === 'basket';
      return [{
        x: c.x, y: c.y, tapRadius: 90, reachDist: 90, promptOffsetY: 40,
        canAct: hasBasket,
        label: hasBasket ? 'Pick Up Trinket' : 'A trinket  •  equip a Basket to collect',
        approach: () => ({ x: c.x, y: c.y + 40 }),
        activate: () => this._collectTrailTrinket(),
      }];
    };
    return { collectible };
  }

  _collectTrailTrinket() {
    const c = this.props.trailCollectible;
    if (!c || c.found) return;
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier('trinket', 1) ?? 0;
    if (added <= 0) return;
    c.found = true;
    c.sprite.destroy();
    this.showIcon?.('trailTrinket', this.player.sprite);
    playGather('egg'); // a soft glinting clink, mirroring the egg pickup
  }
};
