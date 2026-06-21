import Phaser from 'phaser';
import { saveHorse } from '../data/save.js';

const W = 960;
const H = 640;

const BOUNDS = { minX: 100, maxX: 860, minY: 340, maxY: 570 };
const S = 2;

export default class PaddockScene extends Phaser.Scene {
  constructor() {
    super('PaddockScene');
  }

  create() {
    this.horse = this.registry.get('horse');
    this.decayAccum = 0;
    this.saveAccum = 0;
    this.horses = []; // all wandering horses { sprite, shadow }

    this.buildWorld();
    this.buildHorses();

    // action events now come from PortraitScene with { type, horseKey }
    this.game.events.on('horse-action', this.doAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('horse-action', this.doAction, this);
    });
  }

  buildWorld() {
    this.add.tileSprite(0, 0, W, H, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    [[160, 240], [600, 400], [360, 520], [800, 300]].forEach(([x, y]) => {
      this.add.image(x, y, 'grass2').setScale(S).setDepth(-99).setAlpha(0.9);
    });

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    [
      [80,  400], [140, 580], [240, 340], [320, 600], [440, 390],
      [560, 570], [680, 350], [780, 590], [880, 430], [920, 340],
      [60,  520], [400, 540], [620, 500], [180, 280], [840, 540]
    ].forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
    });
  }

  buildHorses() {
    const player = this.spawnHorse(480, 460, 'horse', 1500);
    this.sprite = player.sprite;
    this.shadow = player.shadow;

    this.spawnHorse(200, 400, 'horse2', 800);
    this.spawnHorse(720, 510, 'horse3', 2200);
  }

  spawnHorse(startX, startY, key, wanderDelay) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` }
        ],
        frameRate: 6, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.openPortrait(key));

    const h = { sprite, shadow, key };
    this.horses.push(h);
    this.scheduleWander(h, wanderDelay);
    return h;
  }

  scheduleWander(h, delay) {
    this.time.delayedCall(delay, () => this.wander(h));
  }

  wander(h) {
    if (!h.sprite.active) return;
    const tx = Phaser.Math.Between(BOUNDS.minX, BOUNDS.maxX);
    const ty = Phaser.Math.Between(BOUNDS.minY, BOUNDS.maxY);
    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);

    h.sprite.setFlipX(tx < h.sprite.x);
    h.sprite.play(`walk_${h.key}`, true);

    this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(600, dist * 11),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!h.sprite.active) return;
        h.sprite.play(`idle_${h.key}`, true);
        this.scheduleWander(h, Phaser.Math.Between(2000, 5000));
      }
    });
  }

  openPortrait(key) {
    const allHorses = this.registry.get('allHorses');
    this.registry.set('viewingHorse', { horse: allHorses[key], portraitKey: `portrait_${key}`, horseKey: key });
    if (this.scene.isActive('PortraitScene')) {
      // Already open — just refresh it with the new horse.
      this.scene.get('PortraitScene').refresh();
      return;
    }
    this.scene.launch('PortraitScene');
    this.scene.bringToTop('PortraitScene');
  }

  doAction({ type, horseKey }) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[horseKey];
    if (!horseData) return;

    switch (type) {
      case 'feed':  horseData.feed();  break;
      case 'water': horseData.water(); break;
      case 'brush': horseData.brush(); break;
      case 'pet':   horseData.pet();   break;
    }

    // Save only the player's horse.
    if (horseKey === 'horse') saveHorse(horseData);

    // Visual effect on the correct sprite.
    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet') {
        this.showHeart(h.sprite);
        this.hop(h.sprite);
      } else {
        const icons = { feed: 'iconFeed', water: 'iconWater', brush: 'iconBrush' };
        this.showIcon(icons[type], h.sprite);
      }
    }
  }

  showHeart(sprite) {
    const heart = this.add.image(sprite.x, sprite.y - 100, 'heart')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: heart,
      y: heart.y - 56, alpha: 0, scale: S * 1.4,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => heart.destroy()
    });
  }

  showIcon(key, sprite) {
    const icon = this.add.image(sprite.x, sprite.y - 112, key)
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon,
      y: icon.y - 44, alpha: 0,
      duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy()
    });
  }

  hop(sprite) {
    this.tweens.add({
      targets: sprite,
      y: sprite.y - 12, duration: 120,
      yoyo: true, ease: 'Quad.easeOut'
    });
  }

  update(time, delta) {
    for (const h of this.horses) {
      h.shadow.x = h.sprite.x;
      h.shadow.y = h.sprite.y;
      h.shadow.setDepth(h.sprite.y - 1);
      h.sprite.setDepth(h.sprite.y);
    }

    this.decayAccum += delta;
    if (this.decayAccum >= 1000) {
      this.horse.applyDecay(this.decayAccum / 1000, false);
      this.decayAccum = 0;
      this.game.events.emit('stats-changed');
    }

    this.saveAccum += delta;
    if (this.saveAccum >= 15000) {
      this.saveAccum = 0;
      saveHorse(this.horse);
    }
  }
}
