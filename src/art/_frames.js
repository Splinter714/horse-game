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
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    src.getContext?.('2d')?.clearRect(0, 0, src.width, src.height);
    delete tex.__blurOrig; // the sprite's being redrawn (e.g. a customizer re-skin) — drop the
                           // stale pre-blur stash so the next blurEdgesSplit re-captures the new pixels
  }
  g.generateTexture(key, w, h);
  g.destroy();
  if (import.meta.env.DEV) captureLayers(key, w, h, drawFn);
}

// Dev-only art dissection (`npm run dissect`): re-run the SAME draw fn into a recording
// graphics that captures every fill as a tagged op instead of drawing pixels, so the
// dissect tool can show each part of a sprite separately. Parts are named by the
// `g.layer('name')` calls sprinkled through the art (a no-op in the real build). Stored
// on a global keyed by texture key. Best-effort — never let it break a texture build.
function captureLayers(key, w, h, drawFn) {
  try {
    const cap = makeCaptureGraphics();
    drawFn(cap);
    (globalThis.__artLayers ||= {})[key] = { w, h, ops: cap.ops };
    globalThis.dispatchEvent(new CustomEvent('artLayersUpdated', { detail: { key } }));
  } catch { /* capture is best-effort; ignore */ }
}

// A graphics-shaped recorder. Mirrors the methods scaledGraphics forwards (so it can be
// wrapped exactly like a real Phaser Graphics) plus the few path/shape calls some art
// uses directly, turning each into a serializable op tagged with the current layer.
export function makeCaptureGraphics() {
  const ops = [];
  let cur = 'base', color = 0, alpha = 1, path = [];
  const rec = (o) => ops.push({ ...o, color, alpha, layer: cur });
  return {
    __capture: true,
    ops,
    layer(name) { cur = name; },
    fillStyle(c, a = 1) { color = c; alpha = a; },
    lineStyle() {},
    fillRect(x, y, w, h) { rec({ t: 'rect', x, y, w, h }); },
    fillRoundedRect(x, y, w, h) { rec({ t: 'rect', x, y, w, h }); },
    fillCircle(x, y, r) { rec({ t: 'circle', x, y, r }); },
    fillEllipse(x, y, w, h) { rec({ t: 'ellipse', x, y, w, h }); },
    fillTriangle(a, b, c, d, e, f) { rec({ t: 'tri', pts: [a, b, c, d, e, f] }); },
    fillPoints(points) { rec({ t: 'poly', points: points.map((p) => ({ x: p.x, y: p.y })) }); },
    beginPath() { path = []; },
    moveTo(x, y) { path.push({ x, y }); },
    lineTo(x, y) { path.push({ x, y }); },
    closePath() {},
    fillPath() { if (path.length) rec({ t: 'poly', points: path.slice() }); },
    strokePath() {},
  };
}

// Super-sampling factor for a creature's procedural art (#2 follow-up). The game
// renders at HiDPI (the canvas buffer is the device's physical pixels — see main.js),
// so a sprite drawn on a small grid and scaled up is sharp but coarse. Drawing the
// art on an R× grid and displaying the sprite at 1/R the scale keeps the on-screen
// size identical while giving R× the detail. On an iPad (devicePixelRatio 2) a horse
// occupies ~256 device px, so R=4 maps ~1 art-pixel per device-pixel.
export const ART_SCALE = 4;

// Wrap a Phaser Graphics so existing draw code written in the small "design grid"
// renders onto the R× texture transparently: geometry args are multiplied by R,
// colours/alpha pass through. Draw fns can keep using design-grid coords (decimals
// allowed — e.g. an x of 0.25 lands on the R=4 sub-pixel grid). `.raw` exposes the
// underlying Graphics for any detail that prefers native R× coordinates.
export function scaledGraphics(g, r = ART_SCALE) {
  const s = (n) => n * r;
  return {
    raw: g,
    // Tag the following draws as a named part for the dissect tool. No-op in the real
    // build (Phaser Graphics has no `.layer`); only the capture recorder consumes it.
    layer: (name) => { if (g.__capture) g.layer(name); },
    fillStyle: (c, a) => g.fillStyle(c, a),
    lineStyle: (w, c, a) => g.lineStyle(w * r, c, a),
    fillRect: (x, y, w, h) => g.fillRect(s(x), s(y), s(w), s(h)),
    fillCircle: (x, y, rad) => g.fillCircle(s(x), s(y), s(rad)),
    fillEllipse: (x, y, w, h) => g.fillEllipse(s(x), s(y), s(w), s(h)),
    fillTriangle: (a, b, c, d, e, f) => g.fillTriangle(s(a), s(b), s(c), s(d), s(e), s(f)),
  };
}

// Standard 4-frame walk leg-lift cycle: [hindFar, hindNear, foreFar, foreNear].
// `lift` is how many pixels a stepping leg pulls up (bigger animals step higher).
export const walkCycle = (lift) => [ [0, 0, 0, 0], [lift, 0, 0, lift], [0, 0, 0, 0], [0, lift, lift, 0] ];

// The 6 legSets buildFrames expects: two planted idle stances + the walk cycle.
export const idleWalkLegs = (lift) => [ [0, 0, 0, 0], [0, 0, 0, 0], ...walkCycle(lift) ];

// Build the standard idle_0/1 + walk_0..3 sheet from a draw fn taking (g, bob, legs).
// Frames are super-sampled on the ART_SCALE grid (like the horse/sheep) for HiDPI
// crispness: the canvas is R× larger and the draw fn receives a scaledGraphics wrapper,
// so its design-grid coords are unchanged. The sprite displays at S/ART_SCALE (the
// spawn's `superSampled` flag), keeping on-screen size identical. Pass blurOpts to
// post-process each frame with blurEdgesSplit after it's drawn.
export function buildFrames(scene, baseKey, w, h, drawFn, legSets, blurOpts) {
  const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  legSets.forEach((legs, i) => {
    gen(scene, `${baseKey}_${names[i]}`, w * ART_SCALE, h * ART_SCALE,
      g0 => drawFn(scaledGraphics(g0), bobs[i], legs));
    if (blurOpts) blurEdgesSplit(scene, `${baseKey}_${names[i]}`, blurOpts);
  });
}

// The single shared animal-sprite blur (issue #193). ONE global value so every
// creature reads with the same soft silhouette — uniform super-sampling (ART_SCALE)
// makes a single setting look the same on a big horse or a tiny bird, so there's no
// per-animal or size-based blur. Every art builder imports this; nothing keeps its
// own copy (the per-file copies used to drift). Owner-tuned via the dev Art-Preview
// blur panel, whose 'Bake' button copies the chosen numbers back into this const.
export const ANIMAL_BLUR = { radius: 0.7, strength: 0.5, feather: 1, internalBlur: 0.7, internalStrength: 0.5, colorThresh: 80 };

// Selective edge + inner-seam blur for a sprite's silhouette.
//   radius / strength / feather — silhouette edge blur (Gaussian px, blend 0–1, inward depth)
//   internalBlur / internalStrength / colorThresh — soften interior colour seams
// Ends with CanvasTexture.refresh() to re-upload the modified canvas to the WebGL GPU.
export function blurEdgesSplit(scene, key, {
  radius = 1.5, strength = 1.0, feather = 1,
  internalBlur = 0, internalStrength,
  alphaThresh = 30, colorThresh = 20,
} = {}) {
  const iStr = internalStrength ?? strength;
  const tex = scene.textures.get(key);
  const src = tex?.getSourceImage();
  if (!src?.getContext) return;
  const w = src.width, h = src.height;
  const origCtx = src.getContext('2d');

  // DEV: stash the pristine (pre-blur) pixels the first time this key is blurred, then
  // always blur FROM that stash. Lets the global Art-Preview blur panel re-apply new
  // params live without compounding — each re-tune blurs the original, not the already-
  // blurred canvas (which `makeBlur` below reads via `src`), so we restore it first.
  let origData;
  if (import.meta.env.DEV) {
    origData = (tex.__blurOrig ||= new Uint8ClampedArray(origCtx.getImageData(0, 0, w, h).data));
    const pristine = origCtx.createImageData(w, h);
    pristine.data.set(origData);
    origCtx.putImageData(pristine, 0, 0);
  } else {
    origData = new Uint8ClampedArray(origCtx.getImageData(0, 0, w, h).data);
  }

  const makeBlur = (px) => {
    // Draw with padding so the CSS blur has room to resolve at all four edges,
    // then crop back to the original size to keep array dimensions consistent.
    const pad = Math.ceil(px * 3);
    const tmp = document.createElement('canvas');
    tmp.width = w + pad * 2; tmp.height = h + pad * 2;
    const c = tmp.getContext('2d');
    c.filter = `blur(${px}px)`; c.drawImage(src, pad, pad);
    return c.getImageData(pad, pad, w, h).data;
  };
  const blurSil = makeBlur(radius);
  const blurInt = internalBlur > 0 ? makeBlur(internalBlur) : null;

  // BFS distance-to-transparency map, capped at feather+1
  const dist = new Int32Array(w * h).fill(feather + 1);
  const queue = [];
  for (let i = 0; i < w * h; i++) {
    if (origData[i * 4 + 3] < alphaThresh) { dist[i] = 0; queue.push(i); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    if (dist[i] >= feather) continue;
    const px = i % w, py = Math.floor(i / w);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; queue.push(ni); }
      }
    }
  }

  const out = origCtx.createImageData(w, h);
  const o = out.data;
  const lerp = (ci, s, t) => {
    o[ci]   = origData[ci]   * (1 - t) + s[ci]   * t;
    o[ci+1] = origData[ci+1] * (1 - t) + s[ci+1] * t;
    o[ci+2] = origData[ci+2] * (1 - t) + s[ci+2] * t;
    o[ci+3] = origData[ci+3] * (1 - t) + s[ci+3] * t;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ci = (y * w + x) * 4, d = dist[y * w + x];
      if (d === 0) {
        o[ci]=blurSil[ci]; o[ci+1]=blurSil[ci+1]; o[ci+2]=blurSil[ci+2]; o[ci+3]=blurSil[ci+3];
      } else if (d <= feather) {
        lerp(ci, blurSil, strength * (feather - d + 1) / feather);
      } else if (blurInt) {
        let col = false;
        for (let dy = -1; dy <= 1 && !col; dy++)
          for (let dx = -1; dx <= 1 && !col; dx++) {
            if (!dx && !dy) continue;
            const ni = ((y+dy)*w + (x+dx))*4;
            if (origData[ni+3] >= alphaThresh &&
                Math.abs(origData[ci]-origData[ni]) + Math.abs(origData[ci+1]-origData[ni+1])
              + Math.abs(origData[ci+2]-origData[ni+2]) > colorThresh) col = true;
          }
        if (col) lerp(ci, blurInt, iStr);
        else { o[ci]=origData[ci]; o[ci+1]=origData[ci+1]; o[ci+2]=origData[ci+2]; o[ci+3]=origData[ci+3]; }
      } else {
        o[ci]=origData[ci]; o[ci+1]=origData[ci+1]; o[ci+2]=origData[ci+2]; o[ci+3]=origData[ci+3];
      }
    }
  }
  origCtx.putImageData(out, 0, 0);
  tex.refresh?.();
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
