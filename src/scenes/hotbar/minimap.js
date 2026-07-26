// Corner minimap (#36) — a small always-visible HUD inset: a schematic overhead
// rectangle of the world's rough shape (farm + the riding trail extension to the
// west), a live dot for the player's position, and a few static landmark dots
// (house, barn, coop, farm stand, trail entrance). Orientation only — no
// tap-to-fast-travel (explicitly out of scope per the scoped issue). Extracted
// as its own concern mixin (mirroring HotbarScene's other hotbar/* files).

import { WORLD_W, WORLD_H, TRAIL_X0 } from '../paddock/constants.js';
import { renderBakedLayer } from './bakedLayer.js';

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

    // Frame + landmark dots are 100% static once built, so they're baked into a
    // single texture instead of two live Graphics re-tessellated every frame
    // (#326 — they were ~196 of the HUD's ~1,374 per-frame commands). Only the
    // player dot below stays a live object, because only it moves.
    this._minimapLayer = renderBakedLayer(this, this._minimapLayer,
      { x: MAP_X - 2, y: MAP_Y - 2, w: MAP_W + 4, h: MAP_H + 4 }, 950, (g) => {
        g.fillStyle(0x111622, 0.72);
        g.fillRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 8);
        g.lineStyle(1.5, 0xdfe4f5, 0.6);
        g.strokeRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 8);
        for (const lm of LANDMARKS) {
          const p = this._minimapMap(lm.x, lm.y);
          g.fillStyle(lm.color, 1);
          g.fillCircle(p.x, p.y, 2.2);
        }
      });

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
