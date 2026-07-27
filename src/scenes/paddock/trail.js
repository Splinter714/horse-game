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
// 2026-07-06 playtest follow-up (both addressed here, #36):
//   1. "Make the trail bigger — a long loop rather than the current shorter
//      stretch." TRAIL_W/TRAIL_Y0/TRAIL_Y1 (constants.js) nearly doubled, and
//      the dirt path is now a closed LOOP (out along the top, curls around the
//      far west end, back along the bottom, closing back at the entrance)
//      instead of one dead-end line — you can walk the whole loop and end up
//      back at the farm.
//   2. "Smooth the ground tint transition into the trail — currently a hard
//      line." The cooler trail tint now fades in gradually over a blend zone
//      that straddles the farm/trail boundary (see the gradient overlay in
//      the ground block below) instead of snapping on at x=0.
// (The third playtest point — "minimap feels too abstract, no concrete
// alternative decided yet" — is a genuine open design question, not a
// concrete fix, so it's intentionally NOT touched here; see hotbar/minimap.js.)

import { S, TRAIL_X0, TRAIL_W, TRAIL_Y0, TRAIL_Y1 } from './constants.js';
import { bakeStaticGraphics } from './bakeGraphics.js';
import { playGather } from '../../audio/sounds.js';

const TRAIL_TINT = 0xbfe0c0;
// How far the tint blend zone extends on either side of the farm/trail
// boundary (x=0) — negative into the trail, positive back into the farm —
// so the color change reads as a gradual fade rather than a hard edge.
const BLEND_IN = 120;   // still farm side: blend starts here, alpha 0
const BLEND_OUT = -420; // trail side: blend finishes here, alpha at full

export const WithTrail = (Base) => class extends Base {
  buildTrail() {
    const top = TRAIL_Y0 - 40, bandH = (TRAIL_Y1 - TRAIL_Y0) + 80;

    // Trail ground — a slightly darker/cooler grass tint reads as "further from
    // the farm" without needing a new tileset; the stream/grass textures already
    // exist so this just reuses 'grass' tiled across the extension band. Plain
    // (untinted) base layer — the tint itself is applied by the gradient overlay
    // below so the transition can fade in instead of snapping on.
    this.add.tileSprite(TRAIL_X0, top, TRAIL_W, bandH, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    // Smooth tint blend (playtest fix #2): a horizontal gradient overlay that
    // fades the cooler trail tint in from 0 alpha at BLEND_IN (still on the
    // farm side) to full alpha at BLEND_OUT (well into the trail), then a flat
    // full-alpha fill covers the rest of the trail out to its far edge. Reads
    // as a gradual color shift instead of a hard line at x=0.
    const tintG = this.add.graphics().setDepth(-99);
    const FULL_ALPHA = 0.55;
    // Rect spans x ∈ [BLEND_OUT, BLEND_IN]: left edge (BLEND_OUT, deeper into
    // the trail) is full alpha, right edge (BLEND_IN, still on the farm side)
    // is zero alpha — i.e. fillGradientStyle's (topLeft/bottomLeft) corners are
    // the trail side, (topRight/bottomRight) the farm side.
    tintG.fillGradientStyle(TRAIL_TINT, TRAIL_TINT, TRAIL_TINT, TRAIL_TINT, FULL_ALPHA, 0, FULL_ALPHA, 0);
    tintG.fillRect(BLEND_OUT, top, BLEND_IN - BLEND_OUT, bandH);
    tintG.fillStyle(TRAIL_TINT, FULL_ALPHA);
    tintG.fillRect(TRAIL_X0, top, BLEND_OUT - TRAIL_X0, bandH);

    // A worn dirt path leading off the farm's west edge into the trail. Bigger
    // trail playtest fix #1: instead of one dead-end line, this is now a closed
    // LOOP — out along the top of the band, curling around the far-west end,
    // back along the bottom, and closing back at the entrance — so there's a
    // long circuit to explore rather than a short there-and-back stretch.
    const g = this.add.graphics().setDepth(-95);
    const midY = (TRAIL_Y0 + TRAIL_Y1) / 2;
    const topY = TRAIL_Y0 + 90, botY = TRAIL_Y1 - 90;
    const farX = TRAIL_X0 + 140;
    const loopWaypoints = [
      [20, midY],
      [-180, topY + 30], [-520, topY - 20], [-900, topY + 40], [-1280, topY + 20],
      [farX, midY],
      [-1280, botY - 20], [-900, botY - 40], [-520, botY + 20], [-180, botY - 30],
      [20, midY],
    ];
    const pts = [];
    for (let i = 0; i < loopWaypoints.length - 1; i++) {
      const [x0, y0] = loopWaypoints[i], [x1, y1] = loopWaypoints[i + 1];
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(dist / 30));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const wobble = 10 * Math.sin((x0 + (x1 - x0) * t) / 140);
        pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + wobble]);
      }
    }
    pts.push(loopWaypoints[loopWaypoints.length - 1]);
    const stamp = (radius, color, alpha) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          g.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
        }
      }
    };
    stamp(24, 0x977f52, 0.85);
    stamp(16, 0xc3a87b, 0.9);

    // Static once stamped — bake the loop into a texture (#325). It was the
    // single largest command buffer in the world (~13.5k fillCircles).
    bakeStaticGraphics(this, g, pts, 28, -95);

    // Scenery: trees and mossy rocks scattered through the (now much bigger)
    // trail band, plus a scattering of wildflowers (reusing the existing flower
    // textures) so it still feels like the same world's palette. Deterministic
    // layout (not random) so the smoke test / dissect tool see a stable scene.
    const trees = [
      [-140, 260], [-260, 460], [-420, 320], [-560, 560], [-700, 380],
      [-820, 620], [-120, 900], [-340, 1020], [-540, 980], [-700, 1080],
      [-860, 260], [-180, 480],
      [-960, 340], [-1100, 560], [-1240, 380], [-1080, 900], [-1220, 1040],
      [-1400, 500], [-1500, 760], [-1420, 260], [-1560, 950], [-980, 1080],
    ];
    for (const [x, y] of trees) {
      this.add.image(x, y, 'trailTree').setScale(S).setDepth(y).setOrigin(0.5, 1);
    }

    const rocks = [
      [-252, 309], [-300, 620], [-480, 240], [-620, 700], [-780, 480], [-200, 1000],
      [-1000, 460], [-1160, 700], [-1340, 460], [-1460, 900], [-1040, 1000],
    ];
    for (const [x, y] of rocks) {
      this.add.image(x, y, 'trailRock').setScale(S).setDepth(y).setOrigin(0.5, 1);
    }

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    const flowerSpots = [
      [-60, 340], [-160, 560], [-240, 700], [-380, 420], [-460, 640],
      [-560, 300], [-640, 500], [-740, 700], [-800, 380], [-880, 560],
      [-960, 700], [-1060, 340], [-1180, 560], [-1300, 700], [-1420, 420],
      [-1500, 640], [-1560, 300], [-1120, 950], [-1300, 980], [-980, 950],
    ];
    flowerSpots.forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
    });

    // One trailside collectible (#36 v1, made sellable per the 2026-07-26 playtest
    // follow-up): a lost trinket that disappears once picked up. Respawns are out
    // of scope for v1; this is just enough to prove the "something to find out
    // here" beat. Moved further out into the loop now that the trail is bigger.
    this.props.trailCollectible = {
      x: -1240, y: 780, found: false,
      sprite: this.add.image(-1240, 780, 'trailTrinket').setScale(S).setDepth(780),
    };

    // A simple marker at the trail's mouth (the farm side) so the entrance reads
    // clearly from the paddock, and so the minimap has a landmark to show.
    this.props.trailEntrance = { x: 20, y: midY };
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
