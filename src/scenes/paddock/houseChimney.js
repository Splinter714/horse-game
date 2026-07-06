// Chimney smoke (#230) — purely decorative/ambient. A soft wisp drifts up from the
// house's chimney every few seconds, matching the fireplace burning inside
// (HouseInteriorScene / houseInteriorDecor.js's _buildFireplace). No temperature or
// other gameplay mechanic — split into its own concern mixin (matching the
// PaddockScene functional-mixin pattern, #167) purely to keep world.js under the
// per-file line budget.

import Phaser from 'phaser';
import { S } from './constants.js';

export const WithHouseChimney = (Base) => class extends Base {
  // The house texture is 84×66 (origin 0.5,1, placed at 240,280, scale S) with its
  // chimney drawn at design coords x=57..68, y=3..19 (worldArt.js `house`, layer
  // 'chimney') — this converts that rect to world px. Called once from buildWorld().
  _buildChimneySmoke() {
    const houseTopLeftX = 240 - (84 * S) / 2;
    const houseTopLeftY = 280 - 66 * S;
    this._chimneyTop = { x: houseTopLeftX + 62.5 * S, y: houseTopLeftY + 3 * S };
    this._scheduleChimneySmoke(Phaser.Math.Between(1000, 3000));
  }

  _scheduleChimneySmoke(delay) {
    this.time.delayedCall(delay, () => {
      if (!this._sleeping) this._spawnChimneySmoke();
      this._scheduleChimneySmoke(Phaser.Math.Between(2500, 5000));
    });
  }

  _spawnChimneySmoke() {
    const { x, y } = this._chimneyTop;
    const puff = this.add.image(x + Phaser.Math.Between(-2, 2), y, 'smokeWisp')
      .setScale(S * 0.7).setDepth(600).setAlpha(0.6);
    this.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-14, 14),
      y: puff.y - Phaser.Math.Between(46, 64),
      scaleX: S * 1.6, scaleY: S * 1.6,
      alpha: 0,
      duration: Phaser.Math.Between(3200, 4400),
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
};
