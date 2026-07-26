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

import { bakeStaticGraphics } from './bakeGraphics.js';

export const WithStream = (Base) => class extends Base {
  // A flowing stream that enters off the top edge and exits off the right edge,
  // cutting the top-right corner — scenery, drawn straight into the world with
  // Graphics (banks, water, ripples, stones, reeds) and backed by collision
  // rects so creatures path around it. Water is gathered at the well instead.
  buildStream() {
    const g = this.add.graphics().setDepth(-96);
    // control points that sweep a smooth arc through the corner; both ends run
    // past the world edge (off the top, off the right).
    const ctrl = [[1430, -60], [1560, 150], [1680, 320], [1860, 380], [2020, 330], [2140, 230]];
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
    // and the reed tufts, which sit 50px out along the flow normal.
    bakeStaticGraphics(this, g, path, 70, -96);

    // collision rects for the in-play portion (skip the off-screen top tail)
    this.streamObstacles = [];
    for (let i = 0; i < path.length; i += 6) {
      const [x, y] = path[i];
      if (y < 40) continue;
      this.streamObstacles.push({ x: x - 42, y: y - 30, w: 84, h: 60, isStream: true });
    }

    // Sampled centerline of the *visible* water (skip the off-screen top/right tails),
    // each point carrying the unit flow tangent. Ambient stream life reads this: fish
    // dart along it (#183) and the cat fishes at the nearest bank (#163).
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
