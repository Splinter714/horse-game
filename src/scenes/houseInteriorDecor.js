// Purely decorative house-interior props: the fish tank (#221) and the fireplace
// (#230). Split out of HouseInteriorScene.js as its own concern mixin (matching the
// PaddockScene functional-mixin pattern, #167) — both add ambient, non-interactive
// animation with no gameplay hooks, so they're a clean, self-contained seam.
//
// `this` is HouseInteriorScene; both build methods are called once from create().

import Phaser from 'phaser';
import { HOUSE_INTERIOR } from './paddock/constants.js';

export const WithHouseInteriorDecor = (Base) => class extends Base {
  // ── Fish tank (#221) ─────────────────────────────────────────────────────
  // Purely decorative: a couple of ambient fish doing a gentle back-and-forth swim
  // inside the tank glass (worldArt's `fishtank` layer, part of the houseInterior
  // texture). Reuses the stream fish art/animation (#183 — art/wildlifeArt.js,
  // fish_0/fish_1) at a smaller scale so it reads as tank-sized, not stream-sized.
  // No feed/catch mechanic, no interaction — the fish just swim.
  _buildFishTank() {
    if (!this.anims.exists('fish_swim')) {
      this.anims.create({
        key: 'fish_swim',
        frames: [{ key: 'fish_0' }, { key: 'fish_1' }],
        frameRate: 3, repeat: -1,
      });
    }
    const { bounds } = HOUSE_INTERIOR.decor.fishTank;
    const x0 = this._d(bounds.x0), x1 = this._d(bounds.x1);
    const y0 = this._d(bounds.y0), y1 = this._d(bounds.y1);
    const TANK_SCALE = 0.85; // small tank — a touch smaller than the stream fish
    this._tankFish = [0.35, 0.65].map((frac, i) => {
      const y = Phaser.Math.Linear(y0, y1, frac);
      const sprite = this.add.sprite(x1 - 6, y, 'fish_0')
        .setOrigin(0.5, 0.5).setScale(TANK_SCALE).setDepth(50 + i)
        .play('fish_swim');
      sprite.setFlipX(true); // starts swimming left (toward x0)
      return { sprite, x0, x1, y };
    });
    this._swimTankFish(this._tankFish[0], true);
    this.time.delayedCall(700, () => this._swimTankFish(this._tankFish[1], false));

    this._buildTankShimmer(x0, x1, y0, y1);
  }

  // Water-movement shimmer (2026-07-06 playtest): a couple of translucent glints
  // drifting side to side with a slow alpha pulse, so the glass reads as moving
  // water instead of a static painted rectangle. Purely cosmetic, no gameplay hook.
  _buildTankShimmer(x0, x1, y0, y1) {
    this._tankShimmer = [0, 1].map((i) => {
      const bar = this.add.rectangle(
        Phaser.Math.Linear(x0, x1, 0.3 + i * 0.35),
        Phaser.Math.Linear(y0, y1, 0.25 + i * 0.3),
        8, 3, 0xffffff, 0.3,
      ).setDepth(49);
      this.tweens.add({
        targets: bar,
        x: { from: x0 + 4, to: x1 - 4 },
        alpha: { from: 0.05, to: 0.35 },
        duration: 2600 + i * 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 700,
      });
      return bar;
    });
  }

  // One fish glides to the opposite tank wall, pauses briefly, turns, and repeats —
  // forever, independent of player state (ambient scenery, not gated on proximity).
  _swimTankFish(fish, startGoingLeft) {
    if (!fish?.sprite?.active) return;
    const goingLeft = startGoingLeft;
    const targetX = goingLeft ? fish.x0 + 4 : fish.x1 - 6;
    fish.sprite.setFlipX(goingLeft);
    const dist = Math.abs(targetX - fish.sprite.x);
    const duration = Phaser.Math.Clamp(dist * 55, 900, 3200);
    this.tweens.add({
      targets: fish.sprite,
      x: targetX,
      y: fish.y + Phaser.Math.Between(-3, 3),
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.time.delayedCall(Phaser.Math.Between(300, 900), () => {
          this._swimTankFish(fish, !goingLeft);
        });
      },
    });
  }

  // ── Fireplace (#230) ─────────────────────────────────────────────────────
  // Purely decorative/ambient: a flickering flame sprite over the stone hearth
  // (worldArt's `fireplace` layer, part of the houseInterior texture). A simple
  // 2-frame flicker (fireplaceFlame_0/1) — no temperature/gameplay mechanic, no
  // interaction, the fire just burns cozily forever.
  _buildFireplace() {
    if (!this.anims.exists('fireplace_flicker')) {
      this.anims.create({
        key: 'fireplace_flicker',
        frames: [{ key: 'fireplaceFlame_0' }, { key: 'fireplaceFlame_1' }],
        frameRate: 5, repeat: -1,
      });
    }
    const { fireplace } = HOUSE_INTERIOR.decor;
    this._fireplaceFlame = this.add.sprite(
      this._d(fireplace.x), this._d(fireplace.y), 'fireplaceFlame_0',
    ).setOrigin(0.5, 1).setScale(HOUSE_INTERIOR.scale).setDepth(60).play('fireplace_flicker');
  }
};
