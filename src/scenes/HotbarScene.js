import Phaser from 'phaser';
import { ITEMS } from '../data/items.js';

const W = 960;
const H = 640;
const SLOT_SIZE = 52;
const SLOT_GAP  = 6;
const NUM_SLOTS = 8;
const TOTAL_W   = NUM_SLOTS * SLOT_SIZE + (NUM_SLOTS - 1) * SLOT_GAP;
const START_X   = Math.round((W - TOTAL_W) / 2);
const SLOT_Y    = H - SLOT_SIZE - 12;

export default class HotbarScene extends Phaser.Scene {
  constructor() {
    super('HotbarScene');
  }

  create() {
    this.activeSlot = 0;
    this.slots = [];

    // Background strip.
    const strip = this.add.graphics();
    strip.fillStyle(0x111622, 0.72);
    strip.fillRoundedRect(START_X - 10, SLOT_Y - 10, TOTAL_W + 20, SLOT_SIZE + 20, 10);

    for (let i = 0; i < NUM_SLOTS; i++) {
      const x = START_X + i * (SLOT_SIZE + SLOT_GAP);
      const g = this.add.graphics();
      this.drawSlot(g, x, SLOT_Y, i === 0);

      // Slot number label.
      const num = this.add.text(x + 4, SLOT_Y + 2, String(i + 1), {
        fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: '#6a7090',
      });

      // Item icon (centered in slot).
      const item = ITEMS[i];
      let icon = null;
      if (item) {
        icon = this.add.image(x + SLOT_SIZE / 2, SLOT_Y + 20, item.icon)
          .setDisplaySize(26, 26);
      }

      // Item label (small text at bottom of slot).
      let label = null;
      if (item) {
        label = this.add.text(x + SLOT_SIZE / 2, SLOT_Y + SLOT_SIZE - 10, item.label, {
          fontFamily: 'system-ui, sans-serif', fontSize: '8px', color: '#c8cce0',
        }).setOrigin(0.5, 0.5);
      }

      this.slots.push({ g, x, num, icon, label });
    }

    // Number keys 1–8.
    for (let i = 1; i <= NUM_SLOTS; i++) {
      this.input.keyboard.on(`keydown-${i}`, () => this.setActive(i - 1));
    }

    // Gamepad LB/RB (buttons 4/5) cycle slots.
    this.input.gamepad.on('down', (_pad, button) => {
      if (button.index === 4) this.setActive((this.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
      if (button.index === 5) this.setActive((this.activeSlot + 1) % NUM_SLOTS);
    });
  }

  drawSlot(g, x, y, active) {
    g.clear();
    g.fillStyle(active ? 0x2a3050 : 0x1a1e30, active ? 0.95 : 0.85);
    g.fillRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 7);
    g.lineStyle(2, active ? 0xe8c84a : 0x3a4060, 1);
    g.strokeRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 7);
  }

  setActive(index) {
    const prev = this.slots[this.activeSlot];
    if (prev) this.drawSlot(prev.g, prev.x, SLOT_Y, false);
    this.activeSlot = index;
    const curr = this.slots[this.activeSlot];
    if (curr) this.drawSlot(curr.g, curr.x, SLOT_Y, true);
  }

  // Returns the item in the currently active slot, or null if empty.
  getActiveItem() {
    return ITEMS[this.activeSlot] ?? null;
  }
}
