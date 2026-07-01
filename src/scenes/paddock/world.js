// World building (ground, barn, coop, fence, gathering sources) and the obstacle/
// collision helpers. Applied as a functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { WORLD_W, WORLD_H, PASTURE_BOUNDS, GATE_GAP_X0, GATE_GAP_X1, S } from './constants.js';

export const WithWorld = (Base) => class extends Base {
  // ─── World ───────────────────────────────────────────────────────────────

  // Worn dirt paths (#85). Purely cosmetic (no collision): a ground layer just
  // above the grass and below props/animals, stamped as circles along each route —
  // a darker worn edge first, then a lighter trodden centre on top.
  //
  // Two separate networks:
  //  • the FARM path — barn → a central junction → the pasture gate, with a branch
  //    up to the stream where you fill buckets;
  //  • a DISCONNECTED path the customers take in from off the east edge to the
  //    farm stand (not joined to the farm's paths).
  buildPath() {
    const g = this.add.graphics().setDepth(-95);
    const fromBarn = [[235, 322], [470, 500], [700, 610], [900, 700]];   // barn → junction
    const toGate   = [[900, 700], [935, 800], [960, 895]];               // junction → pasture gate
    const toStream = [[900, 700], [1180, 560], [1420, 440], [1610, 372]]; // junction → stream bank
    const toStand  = [[1955, 742], [1800, 772], [1640, 794], [1560, 802]]; // off east edge → farm stand
    const routes = [fromBarn, toGate, toStream, toStand];
    const stamp = (radius, color, alpha) => {
      g.fillStyle(color, alpha);
      for (const pts of routes) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
          const dist = Math.hypot(x1 - x0, y1 - y0);
          const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            g.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
          }
        }
      }
    };
    stamp(27, 0x977f52, 0.9);   // worn earthy edge
    stamp(18, 0xc3a87b, 0.95);  // lighter trodden centre
  }

  buildWorld() {
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    this.buildPath(); // worn path linking barn ↔ farm stand ↔ gate (#85)

    [
      [160, 300], [480, 200], [800, 450], [1100, 300], [1400, 180],
      [1700, 400], [300, 700], [700, 900], [1000, 750], [1300, 1000],
      [1600, 850], [200, 1050], [500, 1150], [900, 1100], [1700, 1100],
    ].forEach(([x, y]) => {
      this.add.image(x, y, 'grass2').setScale(S).setDepth(-99).setAlpha(0.9);
    });

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    [
      [80, 400], [140, 600], [260, 360], [340, 620], [460, 410],
      [580, 580], [700, 370], [800, 610], [920, 450], [1000, 350],
      [60, 540], [420, 560], [640, 520], [190, 290], [860, 560],
      [1100, 450], [1200, 620], [1340, 390], [1460, 570], [1580, 430],
      [1700, 600], [1480, 720], [1860, 520], [1050, 800], [1180, 950],
      [1380, 850], [1520, 980], [1650, 780], [1780, 900], [280, 880],
      [420, 1020], [560, 900], [700, 1040], [850, 820], [980, 1020],
      [120, 750], [240, 1100], [360, 980], [500, 800], [630, 1100],
    ].forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length])
        .setScale(S).setDepth(y);
    });

    // Barn — interactive: walk up and sleep until morning
    this.add.image(240, 280, 'barn').setScale(S).setDepth(279).setOrigin(0.5, 1);
    this.props.barn = { x: 240, y: 250 };

    // Fence line near barn
    for (let i = 0; i < 6; i++) {
      this.add.image(300 + i * 96, 320, 'fence').setScale(S).setDepth(320).setOrigin(0, 0.5);
    }

    // Chicken coop — right of the fence line (fence ends ~x=876)
    const coopX = 930, coopY = 400;
    this.add.image(coopX, coopY, 'coop').setScale(S).setDepth(coopY).setOrigin(0.5, 1);

    // Roost geometry: the pop-door and the foot of its ramp, in world space.
    // (Coop sprite is 64×52, origin 0.5,1 at coopX,coopY, scale S; door ≈ local
    // (17,39), ramp foot ≈ local (10,52).) Chickens file in here at nightfall.
    this.props.coop = {
      x: coopX, y: coopY,
      doorX: coopX + (17 - 32) * S, doorY: coopY + (39 - 52) * S, // ≈ (900, 374)
      rampX: coopX + (10 - 32) * S, rampY: coopY,                 // ≈ (886, 400)
    };

    // Nests in front of (below) the coop
    const nestPositions = [[906, 410], [930, 416], [954, 410]];
    for (const [nx, ny] of nestPositions) {
      const sprite = this.add.image(nx, ny, 'nest').setScale(S).setDepth(ny + 1).setOrigin(0.5, 0.5);
      this.props.nests.push({ x: nx, y: ny, hasEgg: false, sprite, occupant: null });
    }

    // Egg-laying timer: every 45 seconds a random chicken may lay in a free nest
    this.time.addEvent({ delay: 45_000, loop: true, callback: this.eggLayTick, callbackScope: this });

    // Water trough (interactive) — just south of the fence, right of the gate, so
    // it sits below the well and the player can top it up by reaching over the
    // fence from the well side without entering the pasture, while horses drink
    // from the inside (#106). (Fence band ≈ y892–912; pasture starts at y910.)
    const tx = 1130, ty = 992;
    const troughSprite = this.add.image(tx, ty, 'trough')
      .setScale(S).setDepth(ty).setOrigin(0.5, 0.5);
    // level = numeric water (0..TROUGH_CAP); `filled` mirrors level>0 for the many
    // readers that just ask "is there water?" — kept in sync by _setTroughLevel (#103).
    this.props.trough = { x: tx, y: ty, sprite: troughSprite, level: 0, filled: false };

    // Gathering sources (issue #63) — static, infinite props the player fills
    // their carriers at. Each holds one content type. Placed across the open
    // farm band (north of the pasture) so the gather→carry→use loop has room.
    this.buildSources();

    // Scenery stream cutting across the top-right corner of the world.
    this.buildStream();

    // --- Pasture Fencing & Gate ---
    this.buildPastureFence();
  }

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

  // Static gathering props. Walk up + interact (or tap) with a compatible
  // carrier equipped to fill it. No depletion — infinite for now. Each carries
  // an `ob` solid footprint (centered on x, bottom at y) so you can't walk
  // through it — obstacles are registered in buildObstacles.
  buildSources() {
    const defs = [
      { x: 820,  y: 850, content: 'hay',    tex: 'haystack',     label: 'Hay Pile',      reach: 100, ob: { w: 84,  h: 36 } },
      { x: 760,  y: 560, content: 'carrot', tex: 'carrotGarden', label: 'Carrot Garden', reach: 100, ob: { w: 104, h: 42 } },
      { x: 1660, y: 560, content: 'apple',  tex: 'appleTree',    label: 'Apple Tree',    reach: 90,  ob: { w: 44,  h: 26 } },
      { x: 1120, y: 470, content: 'seed',   tex: 'grainBin',     label: 'Grain Bin',     reach: 95,  ob: { w: 66,  h: 40 } },
      { x: 1100, y: 850, content: 'water',  tex: 'well',         label: 'Well',          reach: 95,  ob: { w: 52,  h: 22 } },
      // Fishing barrel — a barrel of fish by the stream bank, the cat's food source
      // (#202). Placed near the path's stream branch (toStream ends ~1610,372) but
      // clear of the water itself, so it reads as "caught fish, ready to drop for
      // the cat" rather than a second stream-gather spot.
      { x: 1540, y: 430, content: 'fish',   tex: 'fishBarrel',   label: 'Fishing Barrel', reach: 95, ob: { w: 40, h: 34 } },
    ];
    for (const d of defs) {
      const sprite = this.add.image(d.x, d.y, d.tex)
        .setScale(S).setDepth(d.y).setOrigin(0.5, 1);
      this.props.sources.push({ ...d, sprite });
    }
  }

  buildPastureFence() {
    const PB = PASTURE_BOUNDS;
    const fenceH = 48, fenceW = 48;

    // Left fence (vertical)
    for (let y = PB.minY; y < PB.maxY; y += fenceH) {
      this.add.image(PB.minX - 8, y + fenceH / 2, 'fence')
        .setScale(S).setDepth(y + fenceH / 2).setOrigin(0.5, 0.5).setRotation(Math.PI / 2);
    }

    // Right fence (vertical)
    for (let y = PB.minY; y < PB.maxY; y += fenceH) {
      this.add.image(PB.maxX + 8, y + fenceH / 2, 'fence')
        .setScale(S).setDepth(y + fenceH / 2).setOrigin(0.5, 0.5).setRotation(Math.PI / 2);
    }

    // Bottom fence (horizontal)
    for (let x = PB.minX; x < PB.maxX; x += fenceW) {
      this.add.image(x + fenceW / 2, PB.maxY + 8, 'fence')
        .setScale(S).setDepth(PB.maxY + 8).setOrigin(0.5, 0.5);
    }

    // Top fence with gate opening - fence on left side of gate
    const gateX = 960, gateY = PB.minY - 8;
    for (let x = PB.minX; x < gateX - 60; x += fenceW) {
      this.add.image(x + fenceW / 2, gateY, 'fence')
        .setScale(S).setDepth(gateY).setOrigin(0.5, 0.5);
    }

    // Gate (interactive) — positioned at top center of pasture
    const gateSprite = this.add.image(gateX, gateY, 'gateClosed')
      .setScale(S).setDepth(gateY).setOrigin(0.5, 0.5);

    this.props.gate = { x: gateX, y: gateY, sprite: gateSprite, open: false };

    // Fence on right side of gate
    for (let x = gateX + 70; x < PB.maxX; x += fenceW) {
      this.add.image(x + fenceW / 2, gateY, 'fence')
        .setScale(S).setDepth(gateY).setOrigin(0.5, 0.5);
    }
  }

  // ─── Obstacles & collision ───────────────────────────────────────────────

  buildObstacles() {
    // Collision footprint for a centred prop (origin 0.5,0.5) from its live
    // position — so a movable prop's collision follows it instead of being pinned
    // to a hardcoded rect (#110). Inset to the solid body, not the full sprite.
    const centredBox = (p, w, h, extra = {}) =>
      p ? [{ x: p.x - w / 2, y: p.y - h / 2, w, h, ...extra }] : [];

    // Rects in world space {x, y, w, h} — top-left origin.
    // Sized to the solid/wall area of each prop (not full sprite bounds).
    this.obstacles = [
      // Barn walls (origin 0.5,1 at 240,280; sprite 84×66 at S=2 → 168×132; walls ~lower 90px)
      { x: 162, y: 192, w: 156, h: 88 },
      // Coop (origin 0.5,1 at 930,400; sprite 64×52 at S=2 → 128×104).
      // home:'chicken' → the coop is the chickens' home, so it's excluded from
      // their personal obstacle list (they're allowed to walk in). See _obstaclesFor.
      { x: 868, y: 300, w: 124, h: 100, home: 'chicken' },
      // Trough — tied to the live trough (origin 0.5,0.5; 200×52 sprite, inset to
      // its body) so the collision moves with it when repositioned (#110/#106).
      ...centredBox(this.props.trough, 176, 44, { isTrough: true }),
      // Fence line (6 segments at y=320, origin 0,0.5; 96×48 each → x=300..876)
      { x: 300, y: 300, w: 576, h: 40 },
    ];

    // ── Solid pasture fence ── (perimeter walls with a single gap at the gate)
    // The gate opening spans x ≈ [GATE_GAP_X0, GATE_GAP_X1] at the top edge.
    const PB = PASTURE_BOUNDS;
    const topY = PB.minY - 8, botY = PB.maxY + 8, lX = PB.minX - 8, rX = PB.maxX + 8;
    const T = 20; // wall thickness
    this.fenceObstacles = [
      { x: PB.minX, y: topY - T / 2, w: GATE_GAP_X0 - PB.minX, h: T, isFence: true }, // top-left of gate
      { x: GATE_GAP_X1, y: topY - T / 2, w: PB.maxX - GATE_GAP_X1, h: T, isFence: true }, // top-right of gate
      { x: PB.minX, y: botY - T / 2, w: PB.maxX - PB.minX, h: T, isFence: true },     // bottom
      { x: lX - T / 2, y: topY, w: T, h: botY - topY, isFence: true },                // left
      { x: rX - T / 2, y: topY, w: T, h: botY - topY, isFence: true },                // right
    ];
    for (const f of this.fenceObstacles) this.obstacles.push(f);

    // Gate obstacle — fills the fence gap. Blocks everyone when closed, passable
    // when open. Thin horizontal strip so movers block at the footing.
    this.gateObstacle = { x: 960 - 56, y: 902 - 18, w: 112, h: 36, isGate: true };
    if (this.props.gate && !this.props.gate.open) {
      this.obstacles.push(this.gateObstacle);
    }

    // Nest obstacles added after nests are built (in buildWorld nests are created before this)
    // Each nest: origin 0.5,0.5 at (nx,ny); 18×12 at S=2 → 36×24.
    // home:'chicken' → nests are part of the chickens' home (like the coop), so
    // they're excluded from the chickens' obstacle list and a hen can walk onto
    // a nest to lay. Other creatures still treat nests as solid.
    for (const n of this.props.nests) {
      this.obstacles.push({ x: n.x - 18, y: n.y - 12, w: 36, h: 24, isNest: true, home: 'chicken' });
    }

    // Gathering source obstacles — solid base centered on x, bottom at y.
    for (const s of this.props.sources) {
      if (!s.ob) continue;
      this.obstacles.push({ x: s.x - s.ob.w / 2, y: s.y - s.ob.h, w: s.ob.w, h: s.ob.h, isSource: true });
    }

    // Stream collision (built in buildStream) — keep everyone out of the water.
    for (const o of (this.streamObstacles || [])) this.obstacles.push(o);
  }

  // Point-vs-rect check with a character radius.
  _hits(x, y, r, obs) {
    return x + r > obs.x && x - r < obs.x + obs.w &&
           y + r > obs.y && y - r < obs.y + obs.h;
  }

  // Species key for a creature, stripping any trailing instance number
  // ('chicken3' → 'chicken', 'ebony' → 'ebony').
  _speciesOf(key) {
    return key.replace(/[0-9]+$/, '');
  }

  // The obstacle list a given creature should respect: the shared obstacles
  // minus any obstacle tagged as that species' home (e.g. the coop for chickens).
  // Computed on demand so it always reflects the live gate state.
  _obstaclesFor(key) {
    const species = this._speciesOf(key);
    return this.obstacles.filter(o => o.home !== species);
  }

  // Returns true if (x,y) with radius r overlaps any obstacle in the list.
  _collides(x, y, r = 14, list = this.obstacles) {
    for (const o of list) {
      if (this._hits(x, y, r, o)) return true;
    }
    return false;
  }

  // Pick a random point not inside any obstacle. Falls back to (fx, fy) after maxTries.
  _safeTarget(minX, maxX, minY, maxY, obsList, fallbackX, fallbackY, maxTries = 12) {
    for (let i = 0; i < maxTries; i++) {
      const tx = Phaser.Math.Between(minX, maxX);
      const ty = Phaser.Math.Between(minY, maxY);
      if (!this._collides(tx, ty, 18, obsList)) return { tx, ty };
    }
    return { tx: fallbackX, ty: fallbackY };
  }

};
