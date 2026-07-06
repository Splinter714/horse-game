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

import { S, TRAIL_X0, TRAIL_W, TRAIL_Y0, TRAIL_Y1 } from './constants.js';
import { EVENTS } from '../../data/events.js';

export const WithTrail = (Base) => class extends Base {
  buildTrail() {
    // Trail ground — a slightly darker/cooler grass tint reads as "further from
    // the farm" without needing a new tileset; the stream/grass textures already
    // exist so this just reuses 'grass' tiled across the extension band.
    this.add.tileSprite(TRAIL_X0, TRAIL_Y0 - 40, TRAIL_W, (TRAIL_Y1 - TRAIL_Y0) + 80, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100).setTint(0xbfe0c0);

    // A worn dirt path leading off the farm's west edge into the trail, so the
    // transition reads as "the trail continues from here" rather than an
    // abrupt terrain change.
    const g = this.add.graphics().setDepth(-95);
    const midY = (TRAIL_Y0 + TRAIL_Y1) / 2;
    const pts = [];
    for (let x = TRAIL_X0 + 40; x <= 60; x += 40) {
      const wobble = 22 * Math.sin(x / 140);
      pts.push([x, midY + wobble]);
    }
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

    // Scenery: trees and mossy rocks scattered through the trail band, plus a
    // scattering of wildflowers (reusing the existing flower textures) so it
    // still feels like the same world's palette. Deterministic layout (not
    // random) so the smoke test / dissect tool see a stable scene.
    const trees = [
      [-140, 260], [-260, 460], [-420, 320], [-560, 560], [-700, 380],
      [-820, 620], [-120, 780], [-340, 860], [-540, 820], [-700, 900],
      [-860, 260], [-180, 480],
    ];
    for (const [x, y] of trees) {
      this.add.image(x, y, 'trailTree').setScale(S).setDepth(y).setOrigin(0.5, 1);
    }

    const rocks = [
      [-90, 420], [-300, 620], [-480, 240], [-620, 700], [-780, 480], [-200, 900],
    ];
    for (const [x, y] of rocks) {
      this.add.image(x, y, 'trailRock').setScale(S).setDepth(y).setOrigin(0.5, 1);
    }

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    const flowerSpots = [
      [-60, 340], [-160, 560], [-240, 700], [-380, 420], [-460, 640],
      [-560, 300], [-640, 500], [-740, 700], [-800, 380], [-880, 560],
    ];
    flowerSpots.forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
    });

    // One trailside collectible (#36 v1 — first-pass, flagged for playtest): a
    // lost trinket that disappears once picked up. Respawns are out of scope for
    // v1; this is just enough to prove the "something to find out here" beat.
    this.props.trailCollectible = {
      x: -640, y: 760, found: false,
      sprite: this.add.image(-640, 760, 'trailTrinket').setScale(S).setDepth(760),
    };

    // A simple marker at the trail's mouth (the farm side) so the entrance reads
    // clearly from the paddock, and so the minimap has a landmark to show.
    this.props.trailEntrance = { x: 20, y: midY };
  }

  // Interactable descriptor for the trailside collectible — bare-hand pickup,
  // mirroring the gate/house pattern (no carried item needed).
  _trailInteractables() {
    const collectible = () => {
      const c = this.props.trailCollectible;
      if (!c || c.found) return [];
      return [{
        x: c.x, y: c.y, tapRadius: 90, reachDist: 90, promptOffsetY: 40,
        canAct: true, label: 'Pick Up Trinket',
        approach: () => ({ x: c.x, y: c.y + 40 }),
        activate: () => this._collectTrailTrinket(),
      }];
    };
    return { collectible };
  }

  _collectTrailTrinket() {
    const c = this.props.trailCollectible;
    if (!c || c.found) return;
    c.found = true;
    c.sprite.destroy();
    this.showIcon?.('trailTrinket', this.player.sprite);
    // A little pocket-change reward — a first-pass "something to find" beat
    // (#36 v1), not a balance lever; tune at playtest.
    this.money = (this.money ?? 0) + 10;
    this.game.events.emit(EVENTS.MONEY_CHANGED, this.money);
  }
};
