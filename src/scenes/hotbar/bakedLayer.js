// Re-bakeable static texture for HUD chrome (#326) — the mutable sibling of
// paddock/bakeGraphics.js.
//
// WHY THIS EXISTS — same root cause as #325. Phaser's Graphics is IMMEDIATE MODE:
// it keeps a command buffer (fillStyle, fillRoundedRect, strokeRoundedRect…) and
// re-walks + re-tessellates that whole buffer on the CPU every frame it's visible.
// Nothing is cached. The hotbar HUD held 12 such Graphics objects totalling ~1,374
// commands — the strip background, seven slot boxes, two "stacked carrier" cards
// and the minimap frame — all re-tessellated 60×/second even though the pixels only
// change when you pick a different slot, cycle a carrier, or resize the window.
// That made the HUD the single most expensive thing left on screen after #325.
//
// paddock/bakeGraphics.js solves the easy half of this: draw ONCE, never again.
// The HUD can't use it, because the HUD genuinely changes — so this module keeps a
// RenderTexture that can be RE-baked in place whenever the state behind it moves.
// The callers pair it with a cheap signature check, so a re-bake only happens when
// the drawing would actually differ; every other frame costs one textured quad.
//
// HiDPI: every HUD scene zooms its camera by the device pixel ratio (uiUtils.js
// applyDpr), so a texture baked at logical size would be upscaled and look soft on
// a Retina iPad. The texture is therefore allocated at rect × DPR physical pixels,
// the source Graphics is scaled to match, and the quad is displayed back at the
// logical size — identical layout, full device resolution.

import { dprOf } from '../uiUtils.js';

// Safety valve, mirroring bakeGraphics.js: refuse implausibly large textures rather
// than silently allocating them. 4M px ≈ 16 MB — far above any HUD strip
// (the widest, a full-width action-button row at DPR 3, is well under 1M).
const MAX_BAKE_PX = 4_000_000;

/**
 * Draw `drawFn` into a cached RenderTexture covering `rect`, reusing/resizing the
 * existing one when possible.
 *
 * @param {Phaser.Scene} scene
 * @param {object|null} layer  the value returned by a previous call (or null/undefined)
 * @param {{x:number,y:number,w:number,h:number}} rect  region in LOGICAL screen px
 * @param {number} depth  render depth for the resulting quad
 * @param {(g: Phaser.GameObjects.Graphics) => void} drawFn  draws in LOGICAL screen
 *   coords (the same numbers the live Graphics used) — the scaling/offset into
 *   texture space is handled here
 * @returns {object|null} the layer handle to pass back in next time
 */
export function renderBakedLayer(scene, layer, rect, depth, drawFn) {
  const dpr = dprOf(scene);
  const pw = Math.max(1, Math.ceil(rect.w * dpr));
  const ph = Math.max(1, Math.ceil(rect.h * dpr));
  if (rect.w <= 0 || rect.h <= 0 || pw * ph > MAX_BAKE_PX) {
    destroyBakedLayer(layer);
    return null;
  }

  // Reuse the texture unless the physical size actually changed (resize / DPR change).
  if (layer && (layer.pw !== pw || layer.ph !== ph)) {
    destroyBakedLayer(layer);
    layer = null;
  }
  if (!layer) {
    const rt = scene.add.renderTexture(rect.x, rect.y, pw, ph).setOrigin(0, 0);
    layer = { rt, pw, ph };
  }

  layer.rt.setPosition(rect.x, rect.y).setDisplaySize(rect.w, rect.h).setDepth(depth);

  // Off-list scratch Graphics: never added to the display list, so it is never part
  // of the per-frame render — it exists only long enough to be stamped into the
  // texture. Scaled + shifted so logical draw coords land in texture space.
  const g = scene.make.graphics({}, false);
  drawFn(g);
  g.setScale(dpr).setPosition(-rect.x * dpr, -rect.y * dpr);
  layer.rt.clear();
  layer.rt.draw(g);
  g.destroy();

  return layer;
}

/** Destroy a layer handle (no-op for null/undefined). Returns null, for reassignment. */
export function destroyBakedLayer(layer) {
  layer?.rt?.destroy();
  return null;
}
