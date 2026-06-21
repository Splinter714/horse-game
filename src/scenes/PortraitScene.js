import Phaser from 'phaser';

const W = 960;
const H = 640;
const PANEL_W = 300;
const PANEL_X = W - PANEL_W; // 660 — panel left edge in screen coords

const STATS = [
  { key: 'hunger',    label: 'Food',  color: 0x63a31d },
  { key: 'thirst',    label: 'Water', color: 0x378add },
  { key: 'grooming',  label: 'Brush', color: 0xba7517 },
  { key: 'happiness', label: 'Happy', color: 0x1d9e75 },
];

const ACTIONS = [
  { label: 'Feed',  icon: 'iconFeed',  type: 'feed'  },
  { label: 'Water', icon: 'iconWater', type: 'water' },
  { label: 'Brush', icon: 'iconBrush', type: 'brush' },
  { label: 'Love',  icon: 'iconHeart', type: 'pet'   },
];

export default class PortraitScene extends Phaser.Scene {
  constructor() {
    super('PortraitScene');
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.closing   = false;
  }

  create() {
    this.closing = false;
    this.build();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  refresh() {
    this.closing = false;
    this.children.removeAll(true);
    this.input.keyboard.removeAllListeners();
    this.statFills = {};
    this.moodText  = null;
    this.panel     = null;
    this.build();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  build() {
    const viewing = this.registry.get('viewingHorse');
    const horse   = viewing?.horse;
    const horseKey = viewing?.horseKey ?? 'horse';
    if (!horse) { this.scene.stop(); return; }

    // Dim backdrop over the play area — clicking it closes the panel.
    const backdrop = this.add.rectangle(0, 0, PANEL_X, H, 0x000000, 0.28)
      .setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Panel container slides in from off-screen right.
    this.panel = this.add.container(W, 0);

    // Panel background.
    const bg = this.add.graphics();
    bg.fillStyle(0xf4f1ec, 1);
    bg.fillRect(0, 0, PANEL_W, H);
    bg.lineStyle(2, 0xd4ceC4, 1);
    bg.lineBetween(0, 0, 0, H);
    this.panel.add(bg);

    // ── Horse sprite ──────────────────────────────────────────────
    const animKey = `panel_idle_${horseKey}`;
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: [{ key: `${horseKey}_idle_0` }, { key: `${horseKey}_idle_1` }],
        frameRate: 2, repeat: -1,
      });
    }
    const horseSprite = this.add.sprite(PANEL_W / 2, 100, `${horseKey}_idle_0`)
      .setScale(3).setOrigin(0.5, 0.5).setFlipX(false);
    horseSprite.play(animKey);
    this.panel.add(horseSprite);

    // ── Name / info ───────────────────────────────────────────────
    this.panel.add(this.add.text(PANEL_W / 2, 192, horse.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: '#2c2c2a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    this.panel.add(this.add.text(PANEL_W / 2, 222, `${horse.breed}  ·  ${horse.age} yrs`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6a6860',
    }).setOrigin(0.5, 0));

    this.moodText = this.add.text(PANEL_W / 2, 240, `Feeling ${horse.mood()}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#1d9e75',
    }).setOrigin(0.5, 0);
    this.panel.add(this.moodText);

    this.addDivider(262);

    // ── Stat bars ─────────────────────────────────────────────────
    let barY = 276;
    for (const s of STATS) {
      this.panel.add(this.add.text(14, barY, s.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6a6860',
      }).setOrigin(0, 0.5));

      const trackX = 62;
      const trackW = PANEL_W - 76;
      const trackY  = barY - 6;

      const trackBg = this.add.graphics();
      trackBg.fillStyle(0xe3ded3, 1);
      trackBg.fillRoundedRect(trackX, trackY, trackW, 12, 6);
      this.panel.add(trackBg);

      const v    = Phaser.Math.Clamp(horse.stats[s.key], 0, 100) / 100;
      const fill = this.add.graphics();
      fill.fillStyle(s.color, 1);
      fill.fillRoundedRect(trackX, trackY, Math.max(5, trackW * v), 12, 6);
      this.panel.add(fill);
      this.statFills[s.key] = { fill, trackX, trackW, color: s.color, trackY };

      barY += 26;
    }

    this.addDivider(barY + 6);

    // ── Action buttons (2 × 2 grid) ───────────────────────────────
    const btnW = 124, btnH = 44, btnGap = 8;
    const btnY0 = barY + 20;
    ACTIONS.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx  = 14 + col * (btnW + btnGap);
      const by  = btnY0 + row * (btnH + btnGap);
      this.makeButton(bx, by, btnW, btnH, a.label, a.icon, () => this.act(a.type, horse));
    });

    // ── Close button ──────────────────────────────────────────────
    const closeBtn = this.add.text(PANEL_W - 12, 14, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9a9790',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.panel.add(closeBtn);

    // Slide in from the right.
    this.tweens.add({ targets: this.panel, x: PANEL_X, duration: 220, ease: 'Quad.easeOut' });
  }

  addDivider(y) {
    const g = this.add.graphics();
    g.lineStyle(1, 0xd4cec4, 1);
    g.lineBetween(14, y, PANEL_W - 14, y);
    this.panel.add(g);
  }

  makeButton(bx, by, bw, bh, label, iconKey, onClick) {
    const g = this.add.graphics();
    const draw = (fill) => {
      g.clear();
      g.fillStyle(fill, 0.95);
      g.fillRoundedRect(bx, by, bw, bh, 8);
      g.lineStyle(1, 0xffffff, 0.12);
      g.strokeRoundedRect(bx, by, bw, bh, 8);
    };
    draw(0x3b4a63);
    this.panel.add(g);

    const icon = this.add.image(bx + 18, by + bh / 2, iconKey).setDisplaySize(18, 18);
    this.panel.add(icon);

    const txt = this.add.text(bx + 34, by + bh / 2, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0, 0.5);
    this.panel.add(txt);

    const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => draw(0x4a5d7d));
    zone.on('pointerout',   () => draw(0x3b4a63));
    zone.on('pointerdown',  () => draw(0x2c384c));
    zone.on('pointerup',    () => { draw(0x4a5d7d); onClick(); });
    this.panel.add(zone);
  }

  act(type, horse) {
    const viewing  = this.registry.get('viewingHorse');
    const horseKey = viewing?.horseKey ?? 'horse';

    switch (type) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': horse.brush(); break;
      case 'pet':   horse.pet();   break;
    }

    this.game.events.emit('horse-action', { type, horseKey });
    this.refreshStats(horse);
  }

  refreshStats(horse) {
    for (const s of STATS) {
      const entry = this.statFills[s.key];
      if (!entry) continue;
      const { fill, trackX, trackW, color, trackY } = entry;
      const v = Phaser.Math.Clamp(horse.stats[s.key], 0, 100) / 100;
      fill.clear();
      fill.fillStyle(color, 1);
      fill.fillRoundedRect(trackX, trackY, Math.max(5, trackW * v), 12, 6);
    }
    if (this.moodText) this.moodText.setText(`Feeling ${horse.mood()}`);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.panel,
      x: W,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
