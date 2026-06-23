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
