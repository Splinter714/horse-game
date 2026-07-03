// Procedural pixel-art for the AMBIENT NOCTURNAL OWL (issue #271). Like the other
// ambient wildlife (fish/birds/raccoon in wildlifeArt.js), the owl is scenery, not a
// cared-for animal — no roster, no needs, no info panel — so its art lives here in its
// OWN file (kept separate from wildlifeArt.js so the parallel foxes work and this owl
// work don't collide) and builds alongside the world/player textures (BootScene), not
// via the species art registry.
//
// The owl faces RIGHT and uses origin (0.5, 1) like the other small critters. It's
// drawn from rounded primitives (ellipses/circles/triangles), which the canvas
// anti-aliases — so we SUPER-SAMPLE it on the ART_SCALE grid (like the horse/sheep) and
// display at S/ART_SCALE. That keeps the soft AA rim sub-pixel at game size, so the
// curves stay smooth but the sprite reads crisp (and sharp on HiDPI) rather than fuzzy.
// First-pass draft look — the owner art-directs the polish in the preview.
//
// Two poses, each a two-frame flap:
//   • perched  — plump upright body, big forward eyes, ear tufts. Blinks (frame swap).
//   • gliding  — wings spread wide either side, a stretched flight silhouette.
// Dissect tags (`g.layer('name')`) mark each logical part (body, wings, head, ears,
// eyes, beak, talons) so the dev dissect tool can break the sprite apart.

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

// A tawny/grey nocturnal owl palette. Muted so it reads well against the night tint.
export const OWL_W = 20, OWL_H = 20;
const O_BODY   = 0x7a6a53, // warm greyish-brown body
  O_BELLY      = 0xb7a684, // paler streaked chest
  O_WING       = 0x5c4f3d, // darker folded wing / flight feathers
  O_WING_EDGE  = 0x483d2f, // wing tip shading
  O_FACE       = 0xcabd9f, // pale facial disc
  O_TUFT       = 0x4a3f30, // ear-tuft tips
  O_BEAK       = 0x3a3128, // small hooked beak
  O_EYE        = 0xf2c33a, // big yellow eye ring
  O_PUPIL      = 0x161009, // dark pupil
  O_TALON      = 0xc9b98a; // pale talons/feet

// ── Perched pose ───────────────────────────────────────────────────────────────
// A plump, upright owl clutching a perch, seen from the front-ish. `blink` closes the
// eyes to a slit for the second frame so the perched loop reads as a slow blink.
function drawOwlPerched(g, blink) {
  // Talons gripping the perch.
  g.layer('talons');
  g.fillStyle(O_TALON, 1);
  g.fillRect(8, 18, 2, 2); g.fillRect(11, 18, 2, 2);
  g.fillStyle(O_BEAK, 1);
  g.fillRect(8, 19, 1, 1); g.fillRect(12, 19, 1, 1);

  // Folded wings hugging the body sides.
  g.layer('wings');
  g.fillStyle(O_WING, 1);
  g.fillEllipse(6, 12, 5, 11);  // left wing
  g.fillEllipse(14, 12, 5, 11); // right wing
  g.fillStyle(O_WING_EDGE, 1);
  g.fillEllipse(6, 15, 4, 5); g.fillEllipse(14, 15, 4, 5); // darker wing tips

  // Body — a plump upright egg with a paler streaked belly.
  g.layer('body');
  g.fillStyle(O_BODY, 1);  g.fillEllipse(10, 12, 12, 13);
  g.fillStyle(O_BELLY, 1); g.fillEllipse(10, 13, 8, 10);
  // Streaks down the chest.
  g.fillStyle(O_WING, 0.5);
  g.fillRect(8, 10, 1, 6); g.fillRect(10, 9, 1, 7); g.fillRect(12, 10, 1, 6);

  // Ear tufts poking up from the head corners.
  g.layer('ears');
  g.fillStyle(O_TUFT, 1);
  g.fillTriangle(5, 4, 7, 0, 8, 5);
  g.fillTriangle(15, 4, 13, 0, 12, 5);

  // Head + pale facial disc.
  g.layer('head');
  g.fillStyle(O_BODY, 1); g.fillCircle(10, 5, 6);
  g.fillStyle(O_FACE, 1); g.fillEllipse(10, 6, 10, 9);

  // The two big forward-facing eyes (owl's signature). Blink = closed slit.
  g.layer('eyes');
  if (blink) {
    g.fillStyle(O_PUPIL, 1);
    g.fillRect(6, 6, 3, 1); g.fillRect(11, 6, 3, 1);
  } else {
    g.fillStyle(O_EYE, 1);   g.fillCircle(7, 6, 2.4); g.fillCircle(13, 6, 2.4);
    g.fillStyle(O_PUPIL, 1); g.fillCircle(7, 6, 1.3); g.fillCircle(13, 6, 1.3);
    g.fillStyle(0xffffff, 0.9); g.fillRect(7, 5, 1, 1); g.fillRect(13, 5, 1, 1); // catch-lights
  }

  // Small hooked beak between the eyes.
  g.layer('beak');
  g.fillStyle(O_BEAK, 1);
  g.fillTriangle(9, 8, 11, 8, 10, 11);
}

// ── Gliding pose ─────────────────────────────────────────────────────────────��─
// Wings spread wide either side for the silent night glide. `wingsUp` swaps the wing
// angle between the two frames so alternating them reads as a slow flap.
function drawOwlGlide(g, wingsUp) {
  // Body — a horizontally stretched flight silhouette.
  g.layer('body');
  g.fillStyle(O_BODY, 1);  g.fillEllipse(10, 11, 11, 9);
  g.fillStyle(O_BELLY, 1); g.fillEllipse(10, 12, 7, 6);

  // Wings — big triangles fanning out from the shoulders; up on one frame, down on
  // the other. Drawn after the body so the leading edge overlaps the shoulders.
  g.layer('wings');
  g.fillStyle(O_WING, 1);
  if (wingsUp) {
    g.fillTriangle(6, 9, 0, 2, 8, 8);    // left wing raised
    g.fillTriangle(14, 9, 20, 2, 12, 8); // right wing raised
  } else {
    g.fillTriangle(6, 11, 0, 16, 8, 10);   // left wing lowered
    g.fillTriangle(14, 11, 20, 16, 12, 10); // right wing lowered
  }
  g.fillStyle(O_WING_EDGE, 1);
  if (wingsUp) { g.fillTriangle(1, 3, 3, 2, 3, 5); g.fillTriangle(19, 3, 17, 2, 17, 5); }
  else         { g.fillTriangle(1, 15, 3, 16, 3, 13); g.fillTriangle(19, 15, 17, 16, 17, 13); }

  // Tucked talons under the body in flight.
  g.layer('talons');
  g.fillStyle(O_TALON, 1);
  g.fillRect(9, 15, 1, 2); g.fillRect(11, 15, 1, 2);

  // Ear tufts.
  g.layer('ears');
  g.fillStyle(O_TUFT, 1);
  g.fillTriangle(7, 5, 8, 2, 9, 6);
  g.fillTriangle(13, 5, 12, 2, 11, 6);

  // Head + facial disc, a touch smaller than the perched pose.
  g.layer('head');
  g.fillStyle(O_BODY, 1); g.fillCircle(10, 6, 4.5);
  g.fillStyle(O_FACE, 1); g.fillEllipse(10, 7, 8, 7);

  // Eyes forward, wide open in flight.
  g.layer('eyes');
  g.fillStyle(O_EYE, 1);   g.fillCircle(8, 7, 2); g.fillCircle(12, 7, 2);
  g.fillStyle(O_PUPIL, 1); g.fillCircle(8, 7, 1.1); g.fillCircle(12, 7, 1.1);

  // Beak.
  g.layer('beak');
  g.fillStyle(O_BEAK, 1);
  g.fillTriangle(9, 8, 11, 8, 10, 10);
}

// Texture/animation key helpers so the spawner (paddock/owls.js) and this builder agree.
export const owlTexKey  = (pose, frame) => `owl_${pose}_${frame}`;
export const owlAnimKey = (pose) => `owl_${pose}`;

export function buildOwlTextures(scene) {
  const W = OWL_W * ART_SCALE, H = OWL_H * ART_SCALE;
  gen(scene, owlTexKey('perched', 0), W, H, (g) => drawOwlPerched(scaledGraphics(g), false));
  gen(scene, owlTexKey('perched', 1), W, H, (g) => drawOwlPerched(scaledGraphics(g), true));  // blink
  gen(scene, owlTexKey('glide', 0),   W, H, (g) => drawOwlGlide(scaledGraphics(g), true));    // wings up
  gen(scene, owlTexKey('glide', 1),   W, H, (g) => drawOwlGlide(scaledGraphics(g), false));   // wings down
}
