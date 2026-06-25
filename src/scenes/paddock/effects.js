// Floating feedback FX — the little hearts, care icons, dust puffs and the hop a
// sprite does when something nice happens to it. Pure presentation: each is a
// self-contained tween over a throwaway display object, with no game-state, save
// or audio dependency, so any concern (care actions, petting, …) can call them for
// visual feedback. Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { S } from './constants.js';

export const WithEffects = (Base) => class extends Base {
  showHeart(sprite) {
    const heart = this.add.image(sprite.x, sprite.y - 100, 'heart')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: heart, y: heart.y - 56, alpha: 0, scale: S * 1.4,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  showIcon(key, sprite) {
    const icon = this.add.image(sprite.x, sprite.y - 112, key)
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 44, alpha: 0,
      duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // Brushing feedback (#95): little puffs of dust/dirt coming off the coat,
  // instead of a brush icon — reads as actually grooming the dirt out. Dirtier
  // coats (lower grooming) kick up more, bigger puffs. `dirtiness` is 0..1.
  showDustPuff(sprite, dirtiness = 0.6) {
    const d = Phaser.Math.Clamp(dirtiness, 0, 1);
    const n = 4 + Math.round(d * 6); // 4..10 puffs
    const baseY = sprite.y - 44;     // around the horse's body/back
    for (let i = 0; i < n; i++) {
      // Dusty tan-to-brown, slightly varied per puff.
      const tint = Phaser.Display.Color.GetColor(
        150 + Math.floor(Math.random() * 45),
        120 + Math.floor(Math.random() * 35),
        80  + Math.floor(Math.random() * 35));
      const r = 2.5 + Math.random() * (3 + d * 3);
      const puff = this.add.circle(
        sprite.x + (Math.random() - 0.5) * 80,
        baseY    + (Math.random() - 0.5) * 46,
        r, tint, 0.5).setDepth(10000);
      this.tweens.add({
        targets: puff,
        x: puff.x + (Math.random() - 0.5) * 56,
        y: puff.y - 18 - Math.random() * 40, // drift up as it disperses
        alpha: 0,
        scale: 1.7 + Math.random(),
        duration: 600 + Math.random() * 400,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }

  hop(sprite) {
    this.tweens.add({
      targets: sprite, y: sprite.y - 12, duration: 120,
      yoyo: true, ease: 'Quad.easeOut',
    });
  }
};
