import Phaser from 'phaser';

// UI runs at the full canvas resolution (960x640) so text is crisp.
const W = 960;
const H = 640;

const STATS = [
  { key: 'hunger', label: 'Food', color: 0x63a31d },
  { key: 'thirst', label: 'Water', color: 0x378add },
  { key: 'grooming', label: 'Brush', color: 0xba7517 },
  { key: 'happiness', label: 'Happy', color: 0x1d9e75 }
];

const BAR_W = 180;
const BAR_H = 14;

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.horse = this.registry.get('horse');
    this.bars = {};

    this.buildStatPanel();
    this.buildTitle();
    this.buildButtons();
    this.refresh();

    this.game.events.on('stats-changed', this.refresh, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('stats-changed', this.refresh, this);
    });
  }

  buildStatPanel() {
    const px = 18;
    const py = 18;
    const panelW = 280;
    const panelH = 18 + STATS.length * 34;

    const panel = this.add.graphics();
    panel.fillStyle(0x1c2330, 0.55);
    panel.fillRoundedRect(px, py, panelW, panelH, 12);

    STATS.forEach((s, i) => {
      const y = py + 26 + i * 34;
      const labelX = px + 18;
      const barX = px + 90;

      this.add.text(labelX, y, s.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);

      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.4);
      bg.fillRoundedRect(barX, y - BAR_H / 2, BAR_W, BAR_H, 6);

      const fill = this.add.rectangle(barX + 1, y, BAR_W - 2, BAR_H - 2, s.color)
        .setOrigin(0, 0.5);
      this.bars[s.key] = fill;
    });
  }

  buildTitle() {
    // Title removed — horse names appear in their portrait cards instead.
    this.title = null;
  }

  buildButtons() {
    const defs = [
      { label: 'Feed', icon: 'iconFeed', action: () => this.game.events.emit('action', 'feed') },
      { label: 'Water', icon: 'iconWater', action: () => this.game.events.emit('action', 'water') },
      { label: 'Brush', icon: 'iconBrush', action: () => this.game.events.emit('action', 'brush') },
      { label: 'Love', icon: 'iconHeart', action: () => this.game.events.emit('action', 'pet') }
    ];

    const btnW = 170;
    const btnH = 52;
    const gap = 16;
    const totalW = defs.length * btnW + (defs.length - 1) * gap;
    let x = (W - totalW) / 2;
    const y = H - 44;

    defs.forEach((d) => {
      this.makeButton(x, y, btnW, btnH, d.label, d.icon, d.action);
      x += btnW + gap;
    });
  }

  makeButton(x, y, w, h, label, iconKey, onClick) {
    const g = this.add.graphics();
    const draw = (bg) => {
      g.clear();
      g.fillStyle(bg, 0.92);
      g.fillRoundedRect(x, y - h / 2, w, h, 12);
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeRoundedRect(x, y - h / 2, w, h, 12);
    };
    draw(0x3b4a63);

    this.add.image(x + 28, y, iconKey).setDisplaySize(26, 26);
    this.add.text(x + 50, y, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    const zone = this.add.zone(x, y - h / 2, w, h).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(0x4a5d7d));
    zone.on('pointerout', () => draw(0x3b4a63));
    zone.on('pointerdown', () => { draw(0x2c384c); });
    zone.on('pointerup', () => { draw(0x4a5d7d); onClick(); });
  }

  refresh() {
    for (const s of STATS) {
      const v = Phaser.Math.Clamp(this.horse.stats[s.key], 0, 100);
      this.bars[s.key].width = (BAR_W - 2) * (v / 100);
    }
  }
}
