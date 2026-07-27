// The stream (#183/#163 read its centerline) — a flowing watercourse that enters
// off the world's top edge and exits off the right, cutting the top-right corner.
// Pure scenery drawn with Graphics (banks, water, ripples, stepping stones, reeds),
// backed by collision rects so creatures path around it, plus two sampled datasets
// other systems consume: `streamPath` (centerline + flow tangents, used by the
// darting fish and the cat's fishing spot) and the bank gather points.
//
// Split out of world.js (#325): world.js sat exactly at the 500-line concern
// budget, and this is a self-contained terrain builder in the same shape as
// trail.js / town.js — so it becomes its own concern mixin rather than growing
// the shared world file that parallel worktrees all touch. Pure move: no logic
// changed beyond the static-graphics bake noted inside.
//
// DEV SPLINE DRAG (#373, paddock/splineDrag.js): `ctrl` — the 6 control points the
// centerline spline is smoothed through — is kept on `this._streamCtrl` instead of
// a local const, so the dev tool can hand back a live, draggable array. Unlike the
// worn paths (buildPath, purely cosmetic), the stream's control points feed FOUR
// derived things that all have to be re-synced on every drag, not just the
// picture: `streamObstacles` (pushed into the shared `this.obstacles` list once at
// boot, so a rebuild has to pull the OLD entries back out before pushing new
// ones), `streamPath` (read fresh each use by the fish/cat, so simple reassignment
// is safe), and the bank gather points appended into `this.props.sources` (same
// pull-old/push-new problem as the obstacles, keyed on `label === 'Stream'`). See
// `_rebuildStream()` — it's the same "array of control points → re-bake" shape as
// `world.js`'s `_bakePathGraphics()`, but this extra bookkeeping is exactly the
// "extra downstream consumers" #373 called out, so it stays its own method rather
// than being forced through the paths' simpler helper.

import { bakeStaticGraphics } from './bakeGraphics.js';

// Fords (#377): how close a stream sample point has to sit to a worn path's
// line before its collision rect is skipped, opening a crossing. Matches the
// path's visual footprint — the widest stamp radius (27, world.js) plus the
// stamp-time wobble amplitude (10) plus a little slack so the gap reads as
// clearly walkable rather than a knife-edge.
const FORD_HALF_WIDTH = 42;

// Auto-densify (#379): the drag tool (#373) lets `_streamCtrl`'s points be
// pulled apart arbitrarily, but the bank/water geometry below is built PER
// control-point interval (the Catmull-Rom pass, the meander offset's `dist`
// accumulator, the bank-width layers) — so a sparse gap between two dragged-
// apart points stretches that geometry oddly. Mirrors the house fence's
// `respaceHouseFence` auto-fill-at-fixed-spacing pattern (houseFencePath.js),
// but derives extra points rather than fence posts, and — unlike the fence,
// which mutates its joint list in place — leaves `_streamCtrl` itself
// untouched so the dev drag tool keeps grabbing exactly the points the user
// placed; only the working copy handed to the spline/bank/collision build
// below is densified. Linear interpolation is enough: the Catmull-Rom pass
// right after smooths straight over the seams. Pure, so easy to sanity-check.
const CTRL_MAX_SPACING = 260; // world px — beyond this, insert interpolated points
export function densifyStreamCtrl(ctrl, maxSpacing = CTRL_MAX_SPACING) {
  if (!ctrl || ctrl.length < 2) return ctrl;
  const out = [ctrl[0]];
  for (let i = 1; i < ctrl.length; i++) {
    const [x0, y0] = ctrl[i - 1];
    const [x1, y1] = ctrl[i];
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(dist / maxSpacing));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  return out;
}

export const WithStream = (Base) => class extends Base {
  // Shortest distance from (x, y) to any segment of any worn-path route
  // currently in `this._pathRoutes` — generic over every route (not just
  // `toStream`), since bend points can now be dragged/inserted anywhere
  // (#373) and a route that never used to come near the stream could later
  // be dragged across it. Uses the routes' raw waypoints (not the wobbled
  // stamp subdivision `_bakePathGraphics` draws with) — cheap, and close
  // enough given the generous `FORD_HALF_WIDTH` slack above.
  _nearestPathDist(x, y) {
    let best = Infinity;
    for (const pts of Object.values(this._pathRoutes ?? {})) {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const dx = x1 - x0, dy = y1 - y0;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq < 1 ? 0 : ((x - x0) * dx + (y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
        if (d < best) best = d;
      }
    }
    return best;
  }

  // A flowing stream that enters off the top edge and exits off the right edge,
  // cutting the top-right corner — scenery, drawn straight into the world with
  // Graphics (banks, water, ripples, stones, reeds) and backed by collision
  // rects so creatures path around it. Water is gathered at the well instead.
  buildStream() {
    // control points that sweep a smooth arc through the corner; both ends run
    // past the world edge (off the top, off the right). Kept as a scene field
    // (not a local const) so the dev drag tool can mutate it in place (#373).
    this._streamCtrl = [[1430, -60], [1560, 150], [1680, 320], [1860, 380], [2020, 330], [2140, 230]];
    this._rebuildStream();
  }

  // Re-derive EVERYTHING from `this._streamCtrl`'s current points: the spline,
  // the baked visual, the collision rects, `streamPath`, and the bank gather
  // points. Called once from `buildStream()` and again on every dev spline-drag
  // move (#373).
  _rebuildStream() {
    // Densify a working copy every rebuild (#379) so it stays correct as
    // `_streamCtrl`'s points get dragged apart — the raw array itself is
    // left alone for the drag tool.
    const ctrl = densifyStreamCtrl(this._streamCtrl);
    const g = this.add.graphics().setDepth(-96);
    // smooth the control points with a Catmull-Rom spline
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
    };
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
    const mid = [];
    for (let i = 1; i < P.length - 2; i++) {
      for (let s = 0; s < 16; s++) mid.push(cr(P[i - 1], P[i], P[i + 1], P[i + 2], s / 16));
    }
    mid.push(P[P.length - 2]);
    // add a squiggly meander perpendicular to the flow (the wavy look from before)
    const path = [];
    let dist = 0;
    for (let i = 0; i < mid.length; i++) {
      const a = mid[Math.max(0, i - 1)], b = mid[Math.min(mid.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      if (i > 0) dist += Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]);
      const off = 13 * Math.sin(dist / 55) + 4 * Math.sin(dist / 19);
      path.push([mid[i][0] - ty * off, mid[i][1] + tx * off]);
    }

    // overlapping circles down the centerline build a smooth thick band
    const layer = (r, color, dy = 0, alpha = 1) => {
      g.fillStyle(color, alpha);
      for (const [x, y] of path) g.fillCircle(x, y + dy, r);
    };
    layer(60, 0x3e6630);     // damp earth rim / bank shadow
    layer(54, 0x4f8a3e);     // grassy bank
    layer(44, 0x356f9e);     // deep water edge
    layer(40, 0x3f7fb5);     // water
    layer(26, 0x5fa6d6, -6); // sunlit upper surface

    // current ripples along the flow
    g.fillStyle(0x9ae0f8, 0.8);
    for (let i = 6; i < path.length; i += 9) {
      const [x, y] = path[i];
      g.fillRect(x - 6, y - 4, 10, 2); g.fillRect(x - 2, y + 4, 8, 2);
    }
    g.fillStyle(0xc8f0ff, 0.7);
    for (let i = 10; i < path.length; i += 12) { const [x, y] = path[i]; g.fillRect(x - 3, y, 6, 2); }

    // stepping stones
    const rock = (x, y, r) => {
      g.fillStyle(0x000000, 0.12); g.fillEllipse(x, y + r, r * 2.2, r);
      g.fillStyle(0x747b80, 1); g.fillEllipse(x, y, r * 2, r * 1.5);
      g.fillStyle(0x9aa0a4, 1); g.fillEllipse(x - r * 0.5, y - r * 0.5, r, r * 0.7);
    };
    for (const i of [12, 30, 46]) { const [x, y] = path[i]; rock(x, y, 7); }

    // reed tufts along both banks (offset along the flow normal)
    for (let i = 4; i < path.length; i += 8) {
      const [x, y] = path[i];
      const [px, py] = path[Math.max(0, i - 1)];
      let nx = -(y - py), ny = (x - px);
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      for (const side of [-1, 1]) {
        const bx = x + nx * 50 * side, by = y + ny * 50 * side;
        g.fillStyle(0x3b8a26, 1); g.fillRect(bx - 1, by - 5, 1, 6); g.fillRect(bx + 1, by - 6, 1, 7);
        g.fillStyle(0x4fa838, 1); g.fillRect(bx, by - 5, 1, 6); g.fillRect(bx + 2, by - 4, 1, 5);
      }
    }

    // The water/banks/stones/reeds are all drawn now and never change — bake the
    // whole lot into one texture (#325). Pad covers the widest bank layer (r=60)
    // and the reed tufts, which sit 50px out along the flow normal. On a rebuild
    // the OLD bake is torn down first so drags don't pile up textures.
    this._streamBake?.destroy();
    this._streamBake = bakeStaticGraphics(this, g, path, 70, -96);

    // collision rects for the in-play portion (skip the off-screen top tail).
    // On a rebuild, pull the OLD entries back out of the shared `this.obstacles`
    // list first (they were pushed in once by `buildObstacles`, world.js) — the
    // list itself isn't rebuilt from scratch elsewhere, so stale rects would
    // otherwise sit behind at the pre-drag shape forever.
    if (this.obstacles) {
      this.obstacles = this.obstacles.filter((o) => !o.isStream);
    }
    this.streamObstacles = [];
    for (let i = 0; i < path.length; i += 6) {
      const [x, y] = path[i];
      if (y < 40) continue;
      // Fords (#377): where a worn path's line crosses the stream, skip this
      // obstacle rect so the path reads as walkable there instead of blocking
      // movement at a spot that visually looks crossable. Re-checked against
      // `this._pathRoutes`' CURRENT points every rebuild (not computed once),
      // so a path or stream drag re-derives the gap correctly either way — see
      // `_nearestPathDist` below.
      if (this._nearestPathDist(x, y) < FORD_HALF_WIDTH) continue;
      this.streamObstacles.push({ x: x - 42, y: y - 30, w: 84, h: 60, isStream: true });
    }
    if (this.obstacles) {
      for (const o of this.streamObstacles) this.obstacles.push(o);
    }
    // (On the very first build, `this.obstacles` doesn't exist yet — buildStream
    // runs from buildWorld, before buildObstacles — so `this.streamObstacles` is
    // just left for buildObstacles to fold in, same as before this refactor.)

    // Sampled centerline of the *visible* water (skip the off-screen top/right tails),
    // each point carrying the unit flow tangent. Ambient stream life reads this: fish
    // dart along it (#183) and the cat fishes at the nearest bank (#163). Read fresh
    // on every use (never cached across ticks), so plain reassignment is safe here.
    this.streamPath = [];
    for (let i = 0; i < path.length; i += 4) {
      const [x, y] = path[i];
      if (y < 80 || x > 1880) continue;
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      this.streamPath.push({ x, y, tx: tx / tl, ty: ty / tl });
    }

    // Bucket-fill points all along the stream's field-facing bank, so it can be
    // gathered from anywhere along its visible length (not just one spot). Each
    // is spriteless/obstacle-less — the river graphics is the visual and its
    // rects do the blocking; _nearestInteractable just picks the closest one.
    // Points sit ~12px past the bank rim on open grass so approaches stay clear.
    // On a rebuild, the OLD 'Stream' entries are pulled back out of the shared
    // `this.props.sources` list first, same reasoning as the obstacles above.
    if (this.props.sources) {
      this.props.sources = this.props.sources.filter((s) => s.label !== 'Stream');
    }
    for (let i = 0; i < path.length; i += 5) {
      const [x, y] = path[i];
      if (y < 40 || x > 1900) continue; // skip the off-screen top/right tails
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let nx = -ty, ny = tx;            // outward normal…
      if (ny < 0) { nx = -nx; ny = -ny; } // …pointing toward the field (downward)
      this.props.sources.push({
        x: x + nx * 72, y: y + ny * 72, content: 'water', label: 'Stream', reach: 90,
        // Drink anchor for horses (#99): the water centreline + field-ward normal,
        // so a thirsty horse can stand at the edge and face the water rather than
        // head-down over the grassy bank (cf. #76).
        bank: [x, y], nrm: [nx, ny],
      });
    }
  }
};
