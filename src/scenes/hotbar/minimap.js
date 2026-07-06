// Corner minimap (#36) — a small always-visible HUD inset: a schematic overhead
// rectangle of the world's rough shape (farm + the riding trail extension to the
// west), a live dot for the player's position, and a few static landmark dots
// (house, barn, coop, farm stand, trail entrance). Orientation only — no
// tap-to-fast-travel (explicitly out of scope per the scoped issue). Extracted
// as its own concern mixin (mirroring HotbarScene's other hotbar/* files).

import { WORLD_W, WORLD_H, TRAIL_X0 } from '../paddock/constants.js';

const MAP_W = 132;
const MAP_H = 96;
const MAP_X = 14; // top-left corner, below the pause/preview buttons
const MAP_Y = 90;

// Static landmark world positions, mirroring the props placed in world.js/trail.js.
// Kept here (not read live off the scene) since these are fixed set-dressing, not
// moving props — avoids a cross-scene read every frame for values that never change.
const LANDMARKS = [
  { key: 'house', x: 240,  y: 280,  color: 0xc98a4a },
  { key: 'barn',  x: 520,  y: 800,  color: 0x8a5a2e },
  { key: 'coop',  x: 930,  y: 400,  color: 0xd9b94a },
  { key: 'stand', x: 1600, y: 780,  color: 0x5aa0e0 },
  { key: 'trail', x: 20,   y: 500,  color: 0x4fa838 },
];

export const WithMinimap = (Base) => class extends Base {
  _buildMinimap() {
    this._minimapNodes?.forEach((n) => n.destroy());
    this._minimapNodes = [];

    const bg = this.add.graphics().setDepth(950);
    bg.fillStyle(0x111622, 0.72);
    bg.fillRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 8);
    bg.lineStyle(1.5, 0xdfe4f5, 0.6);
    bg.strokeRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 8);
    this._minimapNodes.push(bg);

    // World-space → minimap-space mapping. The full span includes the trail
    // extension (negative x), so the minimap widens to the west accordingly —
    // it's schematic, not to scale with the farm's own proportions.
    const worldX0 = TRAIL_X0, worldX1 = WORLD_W;
    const worldY0 = 0, worldY1 = WORLD_H;
    const pad = 6;
    this._minimapMap = (wx, wy) => {
      const nx = (wx - worldX0) / (worldX1 - worldX0);
      const ny = (wy - worldY0) / (worldY1 - worldY0);
      return {
        x: MAP_X + pad + nx * (MAP_W - pad * 2),
        y: MAP_Y + pad + ny * (MAP_H - pad * 2),
      };
    };

    // Landmark dots (static).
    const landmarks = this.add.graphics().setDepth(951);
    for (const lm of LANDMARKS) {
      const p = this._minimapMap(lm.x, lm.y);
      landmarks.fillStyle(lm.color, 1);
      landmarks.fillCircle(p.x, p.y, 2.2);
    }
    this._minimapNodes.push(landmarks);

    // Live player-position dot, updated every frame in _updateMinimap.
    this._minimapPlayerDot = this.add.circle(MAP_X + pad, MAP_Y + pad, 3, 0xff5a5a)
      .setDepth(952).setStrokeStyle(1, 0xffffff, 0.9);
    this._minimapNodes.push(this._minimapPlayerDot);
  }

  // Called each frame from update() — reads the live player position off
  // PaddockScene (the world scene) and moves the dot. Orientation only: no
  // interactivity, no tap-to-teleport.
  _updateMinimap() {
    if (!this._minimapPlayerDot || !this._minimapMap) return;
    const paddock = this.scene.get('PaddockScene');
    const sprite = paddock?.player?.sprite;
    if (!sprite) return;
    const p = this._minimapMap(sprite.x, sprite.y);
    this._minimapPlayerDot.setPosition(p.x, p.y);
  }
};
