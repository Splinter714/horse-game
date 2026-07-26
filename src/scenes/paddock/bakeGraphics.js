// Bake a finished, never-again-modified Graphics object into a static texture (#325).
//
// WHY THIS EXISTS — the single biggest frame cost found while profiling #325.
// Phaser's Graphics is IMMEDIATE MODE: it stores a command buffer (fillStyle,
// fillCircle, fillRect…) and re-walks + re-tessellates that entire buffer into
// triangles ON THE CPU every single frame it's visible. Nothing is cached.
//
// The four ground layers (farm path, stream, trail loop, town street) are each
// drawn by stamping hundreds of overlapping circles along a route, so between
// them they held ~26,000 commands — all of it re-tessellated 60×/second forever,
// even though not one pixel of it ever changes after create(). That is pure
// waste, and it grew every time the world got bigger.
//
// Baking replays those commands ONCE into a RenderTexture and then draws a
// single quad per layer instead. Identical pixels, ~26,000 → 0 per-frame
// commands. The trade is VRAM (roughly 4 bytes per covered pixel), so the
// bounds are fitted to what was actually drawn rather than the whole world, and
// anything implausibly large is left un-baked rather than blowing up memory.
//
// ONLY use this for graphics that are complete and never touched again. Anything
// that gets .clear()ed or redrawn (the lead rope, the brush-game bar, rain) must
// stay a live Graphics.

// Safety valve: skip baking (and just keep the Graphics) above this pixel count,
// so a future world expansion can't silently allocate a gigantic texture.
// 12M px ≈ 48 MB — well above any single layer here (the biggest is ~1.7M px).
const MAX_BAKE_PX = 12_000_000;

/**
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Graphics} g  finished graphics, positioned at (0,0)
 *   with world coordinates baked into its commands
 * @param {Array<[number, number]>} points  the coordinates the drawing was built
 *   from — the bounds are derived from these, so they track future edits to the
 *   route data instead of going stale like a hardcoded rect would
 * @param {number} pad  outset to cover stroke/fill radius beyond those points
 * @param {number} depth  render depth for the resulting texture
 * @returns {Phaser.GameObjects.GameObject} the RenderTexture, or the original
 *   Graphics if baking was skipped
 */
export function bakeStaticGraphics(scene, g, points, pad, depth) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    const px = p[0], py = p[1];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  if (!Number.isFinite(minX)) return g; // nothing to bake — leave it alone

  const x = Math.floor(minX - pad);
  const y = Math.floor(minY - pad);
  const w = Math.ceil(maxX + pad) - x;
  const h = Math.ceil(maxY + pad) - y;
  if (w <= 0 || h <= 0 || w * h > MAX_BAKE_PX) return g;

  const rt = scene.add.renderTexture(x, y, w, h).setOrigin(0, 0).setDepth(depth);
  rt.draw(g, -x, -y); // shift world coords into the texture's local space
  g.destroy();
  return rt;
}
