import Phaser from 'phaser';

const W = 960;
const H = 640;

const STATS = [
  { key: 'hunger',    label: 'Food',  color: 0x63a31d },
  { key: 'thirst',    label: 'Water', color: 0x378add },
  { key: 'grooming',  label: 'Brush', color: 0xba7517 },
  { key: 'happiness', label: 'Happy', color: 0x1d9e75 }
];

const ACTIONS = [
  { label: 'Feed',  icon: 'iconFeed',  type: 'feed' },
  { label: 'Water', icon: 'iconWater', type: 'water' },
  { label: 'Brush', icon: 'iconBrush', type: 'brush' },
  { label: 'Love',  icon: 'iconHeart', type: 'pet' }
];

const cardW = 540;
const cardH = 500;

export default class PortraitScene extends Phaser.Scene {
  constructor() {
    super('PortraitScene');
    this.statFills = {};
    this.moodText = null;
    this.currentKey = null;
  }

  create() {
    this.rebuild();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  refresh() {
    this.children.removeAll(true);
    this.input.keyboard.removeAllListeners();
    this.statFills = {};
    this.moodText = null;
    this.rebuild();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  rebuild() {
    const viewing = this.registry.get('viewingHorse');
    const horse = viewing?.horse;
    const portraitKey = viewing?.portraitKey ?? 'portrait_horse';
    this.currentKey = viewing?.horseKey ?? 'horse';
    if (!horse) { this.close(); return; }

    const cx = W / 2;
    const cy = H / 2;

    // Dimmed backdrop.
    const backdrop = this.add.rectangle(0, 0, W, H, 0x101622, 0.55)
      .setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Card.
    const card = this.add.graphics();
    card.fillStyle(0xf7f4ee, 1);
    card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    card.lineStyle(2, 0xd8d2c4, 1);
    card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);

    // Block clicks from passing through the card to the backdrop.
    const cardZone = this.add.zone(cx - cardW / 2, cy - cardH / 2, cardW, cardH)
      .setOrigin(0, 0).setInteractive();
    cardZone.on('pointerdown', (_p, _x, _y, evt) => evt.stopPropagation());

    // Portrait frame (left).
    const frameX = cx - cardW / 2 + 24;
    const frameY = cy - cardH / 2 + 24;
    const frameSize = 220;

    const frame = this.add.graphics();
    frame.fillStyle(0xcfe6f2, 1);
    frame.fillRoundedRect(frameX, frameY, frameSize, frameSize, 12);
    frame.lineStyle(2, 0xb8d2de, 1);
    frame.strokeRoundedRect(frameX, frameY, frameSize, frameSize, 12);

    this.add.image(frameX + frameSize / 2, frameY + frameSize / 2 + 8, portraitKey)
      .setDisplaySize(frameSize, frameSize);

    // Name / breed / age / mood (right of portrait).
    const textX = frameX + frameSize + 22;
    const textY = frameY;
    this.add.text(textX, textY, horse.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#2c2c2a'
    });
    this.add.text(textX, textY + 44, `${horse.breed} mare`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#5f5e5a'
    });
    this.add.text(textX, textY + 68, `${horse.age} years old`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#5f5e5a'
    });
    this.moodText = this.add.text(textX, textY + 100, horse.mood(), {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#1d9e75'
    });

    // Stat bars (below the top row).
    const barStartY = frameY + frameSize + 20;
    const barX = frameX;
    const barW = cardW - 48;
    let barY = barStartY;

    STATS.forEach((s) => {
      this.add.text(barX, barY, s.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#5f5e5a'
      }).setOrigin(0, 0.5);

      const trackX = barX + 60;
      const trackW = barW - 60;

      const bg = this.add.graphics();
      bg.fillStyle(0xe3ded3, 1);
      bg.fillRoundedRect(trackX, barY - 5, trackW, 10, 5);

      const v = Phaser.Math.Clamp(horse.stats[s.key], 0, 100) / 100;
      const fill = this.add.graphics();
      fill.fillStyle(s.color, 1);
      fill.fillRoundedRect(trackX, barY - 5, Math.max(5, trackW * v), 10, 5);
      this.statFills[s.key] = { fill, trackX, trackW, color: s.color, barY };

      barY += 24;
    });

    // Action buttons.
    const btnW = 112;
    const btnH = 44;
    const btnGap = 12;
    const totalBtnW = ACTIONS.length * btnW + (ACTIONS.length - 1) * btnGap;
    let bx = cx - totalBtnW / 2;
    const by = cy + cardH / 2 - 36;

    ACTIONS.forEach((a) => {
      this.makeButton(bx, by, btnW, btnH, a.label, a.icon, () => this.act(a.type, horse));
      bx += btnW + btnGap;
    });

    // Close button.
    const close = this.add.text(cx + cardW / 2 - 28, cy - cardH / 2 + 28, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#888780'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());
  }

  makeButton(x, y, w, h, label, iconKey, onClick) {
    const g = this.add.graphics();
    const draw = (bg) => {
      g.clear();
      g.fillStyle(bg, 0.92);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
      g.lineStyle(1, 0xffffff, 0.2);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    };
    draw(0x3b4a63);
    this.add.image(x - w / 2 + 22, y, iconKey).setDisplaySize(20, 20);
    this.add.text(x - w / 2 + 40, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff'
    }).setOrigin(0, 0.5);

    const zone = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => draw(0x4a5d7d));
    zone.on('pointerout',   () => draw(0x3b4a63));
    zone.on('pointerdown',  () => draw(0x2c384c));
    zone.on('pointerup',    () => { draw(0x4a5d7d); onClick(); });
  }

  act(type, horse) {
    const viewing = this.registry.get('viewingHorse');
    const horseKey = viewing?.horseKey ?? 'horse';

    // Apply to the horse data object directly.
    switch (type) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': horse.brush(); break;
      case 'pet':   horse.pet();   break;
    }

    // Tell PaddockScene to play the effect on the right sprite.
    this.game.events.emit('horse-action', { type, horseKey });

    // Refresh stat bars and mood in place.
    this.refreshStats(horse);
  }

  refreshStats(horse) {
    STATS.forEach((s) => {
      const entry = this.statFills[s.key];
      if (!entry) return;
      const { fill, trackX, trackW, color, barY } = entry;
      const v = Phaser.Math.Clamp(horse.stats[s.key], 0, 100) / 100;
      fill.clear();
      fill.fillStyle(color, 1);
      fill.fillRoundedRect(trackX, barY - 5, Math.max(5, trackW * v), 10, 5);
    });
    if (this.moodText) this.moodText.setText(horse.mood());
  }

  close() {
    this.scene.stop();
  }
}
