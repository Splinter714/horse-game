import Phaser from 'phaser';

const PANEL_W = 280;

export default class ChickenInfoScene extends Phaser.Scene {
  constructor() {
    super('ChickenInfoScene');
    this.panel = null;
    this.closing = false;
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
    this.panel = null;
    this.build();
    this.input.keyboard.on('keydown-ESC', () => this.close());
  }

  build() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const panelX = sw - PANEL_W;
    this._sw = sw;

    const viewing = this.registry.get('viewingChicken');
    const chicken = viewing?.chicken;
    const chickenKey = viewing?.chickenKey ?? 'chicken0';
    if (!chicken) { this.scene.stop(); return; }

    // Dim backdrop over the play area — clicking it closes the panel.
    const backdrop = this.add.rectangle(0, 0, panelX, sh, 0x000000, 0.28)
      .setOrigin(0, 0).setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // Panel container slides in from off-screen right.
    this.panel = this.add.container(sw, 0);

    // Panel background.
    const bg = this.add.graphics();
    bg.fillStyle(0xf4f1ec, 1);
    bg.fillRect(0, 0, PANEL_W, sh);
    bg.lineStyle(2, 0xd4cec4, 1);
    bg.lineBetween(0, 0, 0, sh);
    this.panel.add(bg);

    // ── Chicken portrait ──────────────────────────────────────────────
    const portraitKey = `portrait_${chickenKey}`;
    const portrait = this.add.image(PANEL_W / 2, 100, portraitKey)
      .setDisplaySize(100, 100).setOrigin(0.5, 0.5);
    this.panel.add(portrait);

    // ── Name / info ───────────────────────────────────────────────────
    this.panel.add(this.add.text(PANEL_W / 2, 180, chicken.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: '#2c2c2a', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    this.panel.add(this.add.text(PANEL_W / 2, 210, `${chicken.breed}  ·  ${chicken.age} ${chicken.age === 1 ? 'yr' : 'yrs'}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6a6860',
    }).setOrigin(0.5, 0));

    this.panel.add(this.add.text(PANEL_W / 2, 228, `${chicken.personality}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#a47a4a',
      fontStyle: 'italic',
    }).setOrigin(0.5, 0));

    this.addDivider(250);

    // ── Close button ──────────────────────────────────────────────
    const closeBtn = this.add.text(PANEL_W - 12, 14, '✕', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9a9790',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.panel.add(closeBtn);

    // Slide in from the right.
    this.tweens.add({ targets: this.panel, x: panelX, duration: 220, ease: 'Quad.easeOut' });
  }

  addDivider(y) {
    const g = this.add.graphics();
    g.lineStyle(1, 0xd4cec4, 1);
    g.lineBetween(14, y, PANEL_W - 14, y);
    this.panel.add(g);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.panel,
      x: this._sw ?? this.scale.width,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }
}
