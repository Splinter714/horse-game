import Phaser from 'phaser';
import { ITEMS } from '../data/items.js';
import { toggleMute, isMuted } from '../audio/sounds.js';

const SLOT_SIZE = 52;
const SLOT_GAP  = 6;
const NUM_SLOTS = 10;

export default class HotbarScene extends Phaser.Scene {
  constructor() {
    super('HotbarScene');
  }

  create() {
    this.activeSlot = 0;
    this.slots = [];

    this.buildHotbar();

    const KEY_NAMES = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','ZERO'];
    KEY_NAMES.forEach((name, i) => {
      this.input.keyboard.on(`keydown-${name}`, () => this.setActive(i));
    });

    this.input.gamepad.on('down', (_pad, button) => {
      if (button.index === 4) this.setActive((this.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
      if (button.index === 5) this.setActive((this.activeSlot + 1) % NUM_SLOTS);
    });

    this.scale.on('resize', this.buildHotbar, this);

    // M key toggles mute
    this.input.keyboard.on('keydown-M', () => {
      const nowMuted = toggleMute();
      this._muteBtn?.setText(nowMuted ? '🔇' : '🔊');
    });
  }

  buildHotbar() {
    this.children.removeAll(true);
    this.slots = [];

    const sw = this.scale.width;
    const sh = this.scale.height;

    // Scale slots down to fit available width (16px total side margin)
    const naturalW = NUM_SLOTS * SLOT_SIZE + (NUM_SLOTS - 1) * SLOT_GAP;
    const fit = Math.min(1, (sw - 16) / naturalW);
    const ss  = Math.max(28, Math.floor(SLOT_SIZE * fit)); // scaled slot size, min 28
    const sg  = Math.max(2,  Math.floor(SLOT_GAP  * fit)); // scaled gap, min 2

    const totalW  = NUM_SLOTS * ss + (NUM_SLOTS - 1) * sg;
    const startX  = Math.round((sw - totalW) / 2);
    const slotY   = sh - ss - 10;
    const radius  = Math.max(4, Math.floor(7 * fit));

    const strip = this.add.graphics();
    strip.fillStyle(0x111622, 0.72);
    strip.fillRoundedRect(startX - 8, slotY - 8, totalW + 16, ss + 16, radius + 2);

    // Mute button top-right corner
    this._muteBtn = this.add.text(sw - 12, slotY + ss / 2, isMuted() ? '🔇' : '🔊', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(14, Math.floor(20 * fit))}px`,
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this._muteBtn.on('pointerdown', () => {
      const nowMuted = toggleMute();
      this._muteBtn.setText(nowMuted ? '🔇' : '🔊');
    });

    for (let i = 0; i < NUM_SLOTS; i++) {
      const x = startX + i * (ss + sg);
      const g = this.add.graphics();
      this.drawSlot(g, x, slotY, ss, radius, i === this.activeSlot);

      this.add.text(x + 3, slotY + 2, String((i + 1) % 10), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.max(7, Math.floor(9 * fit))}px`,
        color: '#6a7090',
      });

      const item = ITEMS[i];
      if (item) {
        const iconSize = Math.max(14, Math.floor(26 * fit));
        this.add.image(x + ss / 2, slotY + ss * 0.38, item.icon)
          .setDisplaySize(iconSize, iconSize);
        this.add.text(x + ss / 2, slotY + ss - 8, item.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Math.max(6, Math.floor(8 * fit))}px`,
          color: '#c8cce0',
        }).setOrigin(0.5, 0.5);
      }

      const zone = this.add.zone(x, slotY, ss, ss).setOrigin(0, 0).setInteractive();
      zone.on('pointerdown', () => this.setActive(i));

      this.slots.push({ g, x, slotY, ss, radius });
    }
  }

  drawSlot(g, x, y, ss, radius, active) {
    g.clear();
    g.fillStyle(active ? 0x2a3050 : 0x1a1e30, active ? 0.95 : 0.85);
    g.fillRoundedRect(x, y, ss, ss, radius);
    g.lineStyle(2, active ? 0xe8c84a : 0x3a4060, 1);
    g.strokeRoundedRect(x, y, ss, ss, radius);
  }

  setActive(index) {
    const prev = this.slots[this.activeSlot];
    if (prev) this.drawSlot(prev.g, prev.x, prev.slotY, prev.ss, prev.radius, false);
    this.activeSlot = index;
    const curr = this.slots[this.activeSlot];
    if (curr) this.drawSlot(curr.g, curr.x, curr.slotY, curr.ss, curr.radius, true);
  }

  getActiveItem() {
    return ITEMS[this.activeSlot] ?? null;
  }
}
