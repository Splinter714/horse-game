// Shared UI helpers.
//
// growHitArea pads an already-interactive GameObject's hit area out to a
// comfortable minimum tap size (#100) WITHOUT changing its visual size. The
// hit rectangle is expanded symmetrically around the object's centre in its
// local (untransformed) texture space, so Phaser's transform still maps taps
// correctly regardless of the object's origin. Use it for small text buttons
// (✕ close, ⏸ pause) where the glyph is tiny but the touch zone should be big.
//
// For zone-based controls (hotbar slots, the Use button) size the zone directly
// instead — there's no glyph to keep small.

export const MIN_TAP = 44;

// ── HiDPI helpers ────────────────────────────────────────────────────────────
// The game renders its buffer at the device's PHYSICAL pixels (so art + text are
// crisp on Retina screens like the iPad), but ALL game/world/UI coordinates stay
// LOGICAL (CSS px). Each scene's camera zoom = DPR absorbs the difference, so
// layout code is unchanged except for reading the *logical* viewport size and
// converting raw pointer coords (which Phaser reports in physical/buffer px).
//
// `dpr` is computed once in main.js and stashed on the registry, so every scene
// reads the same value. At DPR 1 (standard monitors, headless smoke) everything
// here is a no-op and behaviour is identical to before.

export const dprOf = (scene) => scene.registry.get('dpr') || 1;

// Zoom this scene's main camera by the device pixel ratio. Call in create().
// The camera origin is moved to the top-left (0,0) so the zoom is anchored there
// rather than at the viewport centre — otherwise screen-fixed UI laid out from the
// top-left in logical coords would be pushed off-screen (Phaser zooms about the
// camera origin). The world camera follows the player, which works the same with a
// top-left origin (only the scroll value differs).
export function applyDpr(scene) {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(dprOf(scene));
  return scene;
}

// Viewport size in LOGICAL px (scale.width/height are physical buffer px).
export const logicalW = (scene) => scene.scale.width / dprOf(scene);
export const logicalH = (scene) => scene.scale.height / dprOf(scene);

export function growHitArea(obj, min = MIN_TAP) {
  const hit = obj?.input?.hitArea;
  if (!hit || typeof hit.setTo !== 'function') return obj;
  const w = Math.max(min, obj.width);
  const h = Math.max(min, obj.height);
  const cx = obj.width / 2;
  const cy = obj.height / 2;
  hit.setTo(cx - w / 2, cy - h / 2, w, h);
  return obj;
}
