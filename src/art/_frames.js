// Shared procedural-art helpers. Every animal sprite is drawn the same way: make an
// off-screen Graphics, draw into it, snapshot to a texture, discard. Quadrupeds also
// share a standard 6-frame idle/walk sheet and a simple two-rect (shin + hoof) leg.
// Species-specific art (horseArt.js, chickenArt.js, cowArt.js, …) builds on these.

// Snapshot one draw fn into a texture under `key`. Safe to call again on an existing
// key to RE-SKIN in place (e.g. the customization panel): generateTexture redraws
// into the existing texture's canvas without clearing it first, so we clear it
// ourselves — otherwise old pixels (a removed marking) would ghost through. Redrawing
// in place keeps the Texture object (and any animations referencing it) valid, so
// running animations just show the new art with no rebuild.
export function gen(scene, key, w, h, drawFn) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(g);
  if (scene.textures.exists(key)) {
    const src = scene.textures.get(key).getSourceImage();
    src.getContext?.('2d')?.clearRect(0, 0, src.width, src.height);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

// Standard 4-frame walk leg-lift cycle: [hindFar, hindNear, foreFar, foreNear].
// `lift` is how many pixels a stepping leg pulls up (bigger animals step higher).
export const walkCycle = (lift) => [ [0, 0, 0, 0], [lift, 0, 0, lift], [0, 0, 0, 0], [0, lift, lift, 0] ];

// The 6 legSets buildFrames expects: two planted idle stances + the walk cycle.
export const idleWalkLegs = (lift) => [ [0, 0, 0, 0], [0, 0, 0, 0], ...walkCycle(lift) ];

// Build the standard idle_0/1 + walk_0..3 sheet from a draw fn taking (g, bob, legs).
export function buildFrames(scene, baseKey, w, h, drawFn, legSets) {
  const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  legSets.forEach((legs, i) => {
    gen(scene, `${baseKey}_${names[i]}`, w, h, g => drawFn(g, bobs[i], legs));
  });
}

// A simple two-rect leg (shin + hoof) shared by the barnyard quadrupeds (and the
// foal). Returns a draw fn bound to one species' geometry; call it per leg with
// (g, x, lift, tone, bob, hoof?) — `hoof` overrides the bound hoof colour when a
// species draws hooves in its own coat tone (the foal).
export function makeLeg({ topY, w, h, hoofColor, hoofY, hoofW = w, hoofDX = 0, hoofH = 2 }) {
  return (g, x, lift, tone, bob = 0, hoof = hoofColor) => {
    g.fillStyle(tone, 1);  g.fillRect(x, topY + bob, w, h - lift);
    g.fillStyle(hoof, 1);  g.fillRect(x + hoofDX, hoofY + bob - lift, hoofW, hoofH);
  };
}
