import Phaser from 'phaser';

// Inventory is a small always-visible counter strip in the top-right corner.
// It listens for 'inventory-changed' events and redraws.

export default class InventoryScene extends Phaser.Scene {
  constructor() { super('InventoryScene'); }

  create() {
    this._counts = {};
    this._nodes  = [];

    this._draw();
    this.scale.on('resize', this._draw, this);
    this.game.events.on('inventory-changed', (inv) => {
      this._counts = { ...inv };
      this._draw();
    });
  }

  _draw() {
    for (const o of this._nodes) o.destroy();
    this._nodes = [];

    const items = Object.entries(this._counts).filter(([, v]) => v > 0);
    if (!items.length) return;

    const sw  = this.scale.width;
    const iconSize = 22;
    const slotW = 52, slotH = 34, gap = 6;
    const totalW = items.length * slotW + (items.length - 1) * gap + 16;
    const x0 = sw - totalW - 12;
    const y0 = 12;

    const bg = this.add.graphics().setDepth(800);
    bg.fillStyle(0x111622, 0.82);
    bg.fillRoundedRect(x0, y0, totalW, slotH, 10);
    bg.lineStyle(1, 0x3a4060, 1);
    bg.strokeRoundedRect(x0, y0, totalW, slotH, 10);
    this._nodes.push(bg);

    items.forEach(([key, count], i) => {
      const cx = x0 + 8 + i * (slotW + gap) + slotW / 2;
      const cy = y0 + slotH / 2;

      const iconKey = `icon${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      const ico = this.add.image(cx - 10, cy, iconKey).setDisplaySize(iconSize, iconSize).setDepth(801);
      const lbl = this.add.text(cx + 10, cy, `×${count}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#fffde0',
      }).setOrigin(0, 0.5).setDepth(801);
      this._nodes.push(ico, lbl);
    });
  }
}
