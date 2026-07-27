// World building (ground, house, barn, coop, fence, gathering sources) and the obstacle/
// collision helpers. Applied as a functional mixin so `this` is the scene.

import Phaser from 'phaser';
import {
  WORLD_W, WORLD_H, PASTURE_BOUNDS, GATE_GAP_X0, GATE_GAP_X1, S,
  FENCE_TEX_H, FENCE_POST_CROP_W,
  FENCE_RAIL_TOP_OFFSET, FENCE_RAIL_BOTTOM_OFFSET, FENCE_RAIL_THICKNESS,
  FENCE_RAIL_TOP_COLOR, FENCE_RAIL_BOTTOM_COLOR,
} from './constants.js';
import { SPECIES } from '../../data/species/index.js';
import { bakeStaticGraphics } from './bakeGraphics.js';
import { houseFenceSegmentRects } from './houseFence.js';
import { respaceHouseFence } from './houseFencePath.js';

// Collision band thickness for the house fence line (#344) — the solid slice of the
// 48px-tall rail sprite, matching the height the old hardcoded rect used.
const HOUSE_FENCE_BAND = 40;

export const WithWorld = (Base) => class extends Base {
  // ─── World ───────────────────────────────────────────────────────────────

  // Worn dirt paths (#85). Purely cosmetic (no collision): a ground layer just
  // above the grass and below props/animals, stamped as circles along each route —
  // a darker worn edge first, then a lighter trodden centre on top.
  //
  // Two separate networks:
  //  • the FARM path — house → a central junction → the pasture gate, with a branch
  //    up to the stream where you fill buckets;
  //  • a DISCONNECTED path the customers take in from off the east edge to the
  //    farm stand (not joined to the farm's paths).
  buildPath() {
    // Route waypoints, kept on `this` (not local consts) so the dev spline-drag
    // tool (#373, paddock/splineDrag.js) can hand back a live, mutable array per
    // route — dragging a waypoint mutates these IN PLACE and calls
    // `_bakePathGraphics()` to re-stamp + re-bake. Each route is independent: the
    // `fromHouse`/`toGate`/`toStream` routes happen to share a literal junction
    // coordinate (900, 700) but are NOT the same array reference, so dragging one
    // route's end doesn't drag the others' matching point — see splineDrag.js.
    this._pathRoutes = {
      fromHouse: [[235, 322], [470, 500], [700, 610], [900, 700]],   // house → junction
      toGate:    [[900, 700], [935, 800], [960, 895]],               // junction → pasture gate
      toStream:  [[900, 700], [1180, 560], [1420, 440], [1610, 372]], // junction → stream bank
      toStand:   [[1955, 742], [1800, 772], [1640, 794], [1560, 802]], // off east edge → farm stand
    };
    this._bakePathGraphics();
  }

  // Re-stamp + re-bake the worn-path ground layer from `this._pathRoutes`'
  // CURRENT points. Called once from `buildPath()` and again on every dev
  // spline-drag move (#373) — purely cosmetic (no collision), so a rebuild here
  // is just "throw away the old texture, draw a new one".
  //
  // The ONE shared implementation for every worn path in the game (#373
  // follow-up) — including the forest/trail loop (`trail.js`'s `buildTrail()`
  // adds it as `this._pathRoutes.forestLoop`, a closed route whose first and
  // last waypoints are the same array reference). It used to be a separate,
  // hand-rolled system (its own stamp loop, its own `bakeStaticGraphics` call)
  // that merely behaved like this one; the owner was explicit that it needed
  // to actually BE this one, not a look-alike, so it was folded in here
  // instead of kept parallel. That's also why the wobble-subdivision step
  // below exists: the loop's waypoints are far apart (hundreds of px), so
  // stamping straight between them (as this function used to do) would draw
  // hard-cornered sticks instead of a winding trail — subdividing every
  // route's waypoints with a gentle sinusoidal wobble before stamping keeps
  // the loop looking natural, and is cheap enough to be a no-op-looking
  // improvement on the short farm-path segments too.
  _bakePathGraphics() {
    this._pathBake?.destroy();
    const g = this.add.graphics().setDepth(-95);
    const routes = Object.values(this._pathRoutes);
    const subdivided = routes.map((wp) => {
      const pts = [];
      for (let i = 0; i < wp.length - 1; i++) {
        const [x0, y0] = wp[i], [x1, y1] = wp[i + 1];
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / 30));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const wobble = 10 * Math.sin((x0 + (x1 - x0) * t) / 140);
          pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + wobble]);
        }
      }
      pts.push(wp[wp.length - 1]);
      return pts;
    });
    const stamp = (radius, color, alpha) => {
      g.fillStyle(color, alpha);
      for (const pts of subdivided) {
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

    // Static from here on — bake it so those hundreds (thousands, with the
    // forest loop folded in) of fillCircles aren't re-tessellated every frame
    // (#325). Pad = the largest stamp radius.
    this._pathBake = bakeStaticGraphics(this, g, subdivided.flat(), 30, -95);

    // The forest loop's shared start/end waypoint doubles as the trail's
    // entrance marker (trail.js) — keep it in sync if the loop gets reshaped.
    const loop = this._pathRoutes.forestLoop;
    if (loop && this.props.trailEntrance) {
      this.props.trailEntrance.x = loop[0][0];
      this.props.trailEntrance.y = loop[0][1];
    }
  }

  buildWorld() {
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    this.buildPath(); // worn path linking house ↔ farm stand ↔ gate (#85)

    [
      [160, 300], [480, 200], [800, 450], [1100, 300], [1400, 180],
      [1700, 400], [300, 700], [700, 900], [1000, 750], [1300, 1000],
      [1600, 850], [200, 1050], [500, 1150], [900, 1100], [1700, 1100],
    ].forEach(([x, y]) => {
      this.add.image(x, y, 'grass2').setScale(S).setDepth(-99).setAlpha(0.9);
    });

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    [
      // Indices 0-8, 10-19, 21, 23, 25, 27, 29, 33, 34, 35, 38 are the owner's
      // own placements (#330 drag tool, baked in by #338, #341, #342, #343, #348).
      // The #343 + #348 batches are the tight flower cluster the owner arranged
      // around the bird bath (roughly x 370-540, y 225-295).
      // #349: the seven flowers that landed inside the enlarged barn footprint
      // (indices 26, 30-32, 36, 37, 39 — barn now covers x 210-890, y 900-1360, and
      // a flower drawn inside it would render on the barn floor / hummingbirds would
      // hover into the roof) were moved clear of it. Indices 30 and 37 were then
      // moved again by the owner's own placement once the barn relocated further
      // (#330 drag tool).
      [464, 251], [443, 256], [506, 280], [436, 274], [402, 247],
      [479, 260], [425, 229], [421, 288], [489, 226], [1000, 350],
      [496, 266], [415, 271], [490, 246], [460, 272], [422, 248],
      [516, 264], [509, 241], [378, 255], [372, 278], [491, 294],
      [1700, 600], [395, 264], [1860, 520], [527, 253], [517, 1091],
      [538, 267], [980, 1400], [525, 283], [1780, 900], [452, 289],
      [669, 1254], [560, 860], [1120, 1430], [480, 282], [954, 1157],
      [395, 283], [960, 1240], [887, 1409], [404, 225], [1700, 1320],
    ].forEach(([x, y], i) => {
      const sprite = this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
      // `sprite` kept so the dev drag tool (#330) can move the actual flower, not
      // just this record's numbers (hummingbirds #226 hover near flowers by x/y).
      (this.props.flowers ??= []).push({ x, y, sprite });
    });

    // House (#241) — the player's home base, NW corner. Interactive: walk up and
    // sleep until morning. This is the old "barn" object rebranded (#241 split);
    // home-base semantics (cat home, night huddle, sleep, player spawn) all anchor
    // here. Its interior is built in #56.
    // Position (219, 253) — the owner's own placement (#330 drag tool, baked in by #335).
    // The sprite sits 30px below the prop anchor; the whole cluster moved by (-21, +3).
    const houseSprite = this.add.image(219, 283, 'house').setScale(S).setDepth(282).setOrigin(0.5, 1);
    // `sprite` kept alongside the anchor so the dev drag tool (#330) can move the
    // visible building, not just this record's numbers.
    this.props.house = { x: 219, y: 253, sprite: houseSprite };
    this._buildChimneySmoke(); // matches the indoor fireplace (#230) — a wisp above the chimney
    this.buildSlopMaker(); // slop-maker (#225) — house-exterior leftovers sink; paddock/farmStand.js

    // Barn (#241 + #35) — the horses' building, a WALK-IN structure with an in-world
    // cutaway interior (stalls + tack room). Built in the barn concern mixin
    // (paddock/barn.js): interior floor/stalls, front-façade fade, collision walls
    // with a south doorway, persisted stall assignments. NO home-base semantics live
    // here (those anchor on the HOUSE). `this.props.barn` is set there.
    this.buildBarn(); // origin at the south doorway; places props.barn

    // Fence line near the house. Tracked in props (#329 follow-up) so the dev
    // object-label/drag tools (#329/#330) can see and reposition each post —
    // distinct from the pasture fence's perimeter, which is built (and could be
    // tracked) separately in buildPastureFence below.
    // Anchor (-136, 57) — the owner grouped all 6 posts with the #337 multi-select
    // tool and dragged the whole run up-left in one go (#330 export, baked in by
    // #343). Spacing is unchanged at 96px, so only the base x/y move.
    // #372 rework: built from start/end + `respaceHouseFence` (same maths the
    // #370 drag tool uses) rather than a flat i*96 loop, so a future bake-in of a
    // diagonal run (dragging an endpoint, then exporting via the dev drag tool)
    // can just replace `fenceStart`/`fenceEnd` here and everything below keeps
    // working — it isn't hardcoded to a horizontal run. Construction: post
    // sprites (cropped to just the post column, drawn un-rotated — a vertical
    // post bar reads fine at any run angle) at each spaced position, plus two
    // continuous rail LINES spanning the whole run start-to-end
    // (`_buildHouseFenceRails`, below) instead of a rail baked into every post
    // tile. Supersedes the earlier per-tile `setRotation` + last-post-crop
    // approach (see git history) — that one needed a special-cased end-cap crop
    // to avoid a dangling rail past the last post; a single line per rail can't
    // dangle since it's drawn exactly post-to-post.
    const fenceStart = { x: -136, y: 57 };
    const fenceEnd   = { x: -136 + 5 * 96, y: 57 }; // 6 posts, 96px spacing
    const fenceSpecs = respaceHouseFence(fenceStart, fenceEnd, 96);
    this.props.houseFence = [];
    fenceSpecs.forEach(({ x, y }, i) => {
      const sprite = this.add.image(x, y, 'fence').setScale(S).setDepth(y).setOrigin(0, 0.5)
        .setCrop(0, 0, FENCE_POST_CROP_W, FENCE_TEX_H);
      this.props.houseFence.push({ x, y, sprite, label: `Fence Post ${i + 1}` });
    });
    this._buildHouseFenceRails(fenceStart, fenceEnd);

    // Chicken coop, right of the fence line (fence ends ~x=876). Roost geometry
    // (pop-door + ramp foot; coop is 64×52, origin 0.5,1) is what chickens file
    // in/out of at nightfall (dayNight.js chickenRoost/chickenLeaveCoop).
    const coopX = 930, coopY = 400;
    const coopSprite = this.add.image(coopX, coopY, 'coop').setScale(S).setDepth(coopY).setOrigin(0.5, 1);
    this.props.coop = {
      x: coopX, y: coopY, sprite: coopSprite, // sprite kept for the dev drag tool (#330)
      doorX: coopX + (17 - 32) * S, doorY: coopY + (39 - 52) * S, // ≈ (900, 374)
      rampX: coopX + (10 - 32) * S, rampY: coopY,                 // ≈ (886, 400)
    };

    const nestPositions = [[906, 410], [930, 416], [954, 410]]; // in front of (below) the coop
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
    // Position (1049, 1204) — the owner's own placement (#330 drag tool, baked in by #349-followup).
    const tx = 1049, ty = 1204;
    const troughSprite = this.add.image(tx, ty, 'trough')
      .setScale(S).setDepth(ty).setOrigin(0.5, 0.5);
    // level = numeric water (0..TROUGH_CAP); `filled` mirrors level>0 (kept in sync by _setTroughLevel, #103).
    this.props.trough = { x: tx, y: ty, sprite: troughSprite, level: 0, filled: false };
    // (The standalone covered shelter that used to be built here was removed in
    // #349 — the barn is the rain shelter now, for every pasture grazer.)

    // Trash can (#191) — a dented metal bin the ambient raccoon rummages in at night.
    // Purely a charming prop (no stock/gathering/economy), in the farm band near the
    // stand so the nocturnal mischief happens somewhere the player passes.
    // Position (687, 847) — the owner's own placement (#330 drag tool, baked in by #341).
    const trashX = 687, trashY = 847;
    const trashSprite = this.add.image(trashX, trashY, 'trashCan')
      .setScale(S).setDepth(trashY).setOrigin(0.5, 1);
    this.props.trashCan = { x: trashX, y: trashY, sprite: trashSprite, spill: null, open: false };

    // Spinning wheel (#233) — the crafting station that spins a basket of raw wool into
    // yarn (worth more at the stand). In a crafting nook east of the BARN. `craft` names
    // the conversion the useDispatch spin action reads (wool → yarn), so it's data-driven.
    // Position (541, 848) — the owner's own placement (#330 drag tool, baked in by #341).
    const swx = 541, swy = 848;
    const spinSprite = this.add.image(swx, swy, 'spinningWheel')
      .setScale(S).setDepth(swy).setOrigin(0.5, 1);
    // Spoked-disc overlay centred on the wheel hub, spun during a craft (#233). The
    // base sprite's hub sits at texture (10,15) with origin (0.5,1) on a 32×40 grid,
    // so the hub is (10-16)*S left and (15-40)*S up of the prop anchor. Hidden until
    // spinWool() runs, then rotated for a beat as feedback that the wheel is turning.
    const spokes = this.add.image(swx + (10 - 16) * S, swy + (15 - 40) * S, 'spinningWheelSpokes')
      .setScale(S).setDepth(swy + 0.1).setOrigin(0.5, 0.5).setVisible(false);
    this.props.spinningWheel = {
      x: swx, y: swy, sprite: spinSprite, spokes, craft: { from: 'wool', to: 'yarn' },
    };
    // (Its solid footprint is added to this.obstacles below, once that array exists.)
    this.buildKitchenCounter(); // crop processing (#40); paddock/farmStand.js
    // Compost bin (#232) — dump spot. Position (615, 850) — the owner's own placement (#330 drag tool, baked in by #341).
    this.props.compostBin = { x: 615, y: 850, sprite: this.add.image(615, 850, 'compostBin').setScale(S).setDepth(850).setOrigin(0.5, 1) };

    // Market stall (#29, narrowed by #312) — TOOL UPGRADES only (#295) now; feed +
    // the shopkeeper NPC moved to the unified store in town (paddock/town.js's
    // buildTown → buildGeneralStore), so this stall is unstaffed. West of the farm
    // stand (SELL station, 1628,753) so the two economy halves read as distinct.
    // Position (2156, 523) — the owner's own placement (#330 drag tool, baked in by #335).
    const shopX = 2156, shopY = 523;
    const shopSprite = this.add.image(shopX, shopY, 'shopStall')
      .setScale(S).setDepth(shopY).setOrigin(0.5, 1);
    this.props.shop = { x: shopX, y: shopY, sprite: shopSprite };
    // Solid counter footprint, added to this.obstacles below.

    // Gathering sources (#63) — static, infinite props the player fills carriers at.
    this.buildSources();

    // Pet food + water bowl (#202/#283/#311/#347, unified into ONE shared bowl by
    // #361) — a fillable dish cat, dog and bunny all eat/drink from directly (not a
    // gather source). The player keeps it stocked.
    this.buildDoghouse(); // #237 decorative yard prop; sets this.doghouseObstacles
    this.buildPetBowl();  // #361 — the one shared bowl, placed by the doghouse/house
    this.buildBirdEcosystem(); // #219/#240/#226/#239 bird-ecosystem props; paddock/birdEcosystem.js
    // Scenery stream cutting across the top-right corner of the world.
    this.buildStream();

    // --- Pasture Fencing & Gate ---
    this.buildPastureFence();
  }

  // Static gathering props. Walk up + interact (or tap) with a compatible carrier equipped
  // to fill it. No depletion — infinite for now. Each carries an `ob` solid footprint
  // (centered on x, bottom at y) so you can't walk through it — registered in buildObstacles.
  buildSources() {
    const defs = [
      // Hay Pile / Well positions are the owner's own placements (#330 drag tool, baked in by #342, moved again after #349's barn relocation).
      { x: 1127, y: 1350, content: 'hay',    tex: 'haystack',     label: 'Hay Pile',      reach: 100, ob: { w: 84,  h: 36 } },
      { x: 1234, y: 425, content: 'carrot', tex: 'carrotGarden', label: 'Carrot Garden', reach: 100, ob: { w: 104, h: 42 } },
      { x: 1660, y: 512, content: 'apple',  tex: 'appleTree',    label: 'Apple Tree',    reach: 90,  ob: { w: 44,  h: 26 } },
      { x: 1802, y: 497, content: 'orange', tex: 'orangeTree', label: 'Orange Tree', reach: 90, ob: { w: 44, h: 26 } }, // #228 tree, mirrors apple
      { x: 1736, y: 546, content: 'berry',  tex: 'berryBush',  label: 'Berry Bush',  reach: 85, ob: { w: 40, h: 18 } }, // #228 bush, same mechanic, no trunk
      { x: 818,  y: 402, content: 'seed',   tex: 'grainBin',     label: 'Grain Bin',     reach: 95,  ob: { w: 66,  h: 40 } },
      { x: 1046, y: 1085, content: 'water',  tex: 'well',         label: 'Well',          reach: 95,  ob: { w: 52,  h: 22 } },
      // Kibble sack (#202 rework) — the cat-food SOURCE, by the house. The player
      // scoops cat food into a basket here (like the grain bin for seed), then pours
      // it into the shared pet bowl. The bowl itself is no longer a gather source —
      // it's a fillable dish the cat/dog/bunny all eat/drink from directly (#361
      // buildPetBowl).
      // Position (815, 142) — the owner's own placement (#330 drag tool, baked in by #341).
      { x: 815,  y: 142, content: 'catFood',  tex: 'kibbleSack',   label: 'Kibble Sack',   reach: 90, ob: { w: 22, h: 20 } },
      // Bunny hutch (#224, reworked #283) — gather SOURCE for bunny food, scooped into a
      // basket then poured into the shared pet FOOD BOWL (#361 buildPetBowl), which
      // bunnies eat from directly; stocking it also lures a wild bunny in (capped at 4).
      // No ground pile (items.js `stocks`). Water side fills from a plain bucket.
      { x: 1293, y: 107, content: 'bunnyFood',  tex: 'bunnyHutch',    label: 'Bunny Hutch', reach: 100, ob: { w: 44, h: 30 } },
      // Nectar station (#226) — sugar-water jug by the house; fill a bucket, pour into the hummingbird feeder (its OWN resource vs seed #240).
      // Position (691, 236) — the owner's own placement (#330 drag tool, baked in by #341).
      { x: 691,  y: 236, content: 'nectar',   tex: 'nectarStation', label: 'Nectar Jug',  reach: 90,  ob: { w: 24, h: 24 } },
      // Fox den (#266) / duck feeder (#275) — SOURCEs for their food; fill a basket, DROP piles to befriend each.
      // Fox den moved off (300,320) — that was the exact spot of the first house-fence
      // post (the fence loop below places posts at 300 + i*96, 320, so i=0 stacked
      // directly on the den, #333). Relocated clear of the house/fence/coop cluster,
      // then further repositioned by the owner via the #330 drag tool and baked in (#335).
      { x: 1141, y: 150, content: 'foxFood',  tex: 'foxDen',        label: 'Fox Den',     reach: 100, ob: { w: 40, h: 26 } },
      // Position (1234, 143) — the owner's own placement (#330 drag tool, baked in by #335).
      { x: 1234, y: 143, content: 'duckFood', tex: 'duckFeeder',    label: 'Duck Feeder', reach: 100, ob: { w: 30, h: 24 } },
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

  // House-fence rail lines (#372 rework, then #372 playtest fix). Draws the two
  // rails as continuous line segments from `start` to `end`, each offset by a
  // FIXED vertical amount from the post's own y — matching the post sprites,
  // which are always drawn un-rotated (plain vertical post art) regardless of
  // the run's angle. An earlier version offset the rails perpendicular to the
  // run's ANGLE instead, which lined up with the post art only when the run was
  // horizontal — at any other angle the perpendicular offset visibly drifted off
  // the (un-rotated) post sprites, worse the steeper the angle (2026-07-27
  // playtest). Since `respaceHouseFence` places every post exactly on the
  // straight line between `start` and `end`, a pure vertical translation of that
  // line still passes through every intermediate post's own (x, y+offset) point
  // — collinearity is preserved under a (0, dy) translation — so one line per
  // rail still reaches every post correctly, just anchored to the post art
  // instead of rotated to the run. Destroys/recreates its own single Graphics
  // object each call (stashed on `this._houseFenceRailGfx`) so the #370 drag
  // tool's `_respaceHouseFenceTo` (houseFencePath.js) can just call this again
  // after every respace, same as the initial build here.
  _buildHouseFenceRails(start, end) {
    this._houseFenceRailGfx?.destroy();
    const g = this.add.graphics().setDepth((start.y + end.y) / 2);
    const drawRail = (offset, color) => {
      g.lineStyle(FENCE_RAIL_THICKNESS, color, 1);
      g.lineBetween(start.x, start.y + offset, end.x, end.y + offset);
    };
    drawRail(FENCE_RAIL_TOP_OFFSET, FENCE_RAIL_TOP_COLOR);
    drawRail(FENCE_RAIL_BOTTOM_OFFSET, FENCE_RAIL_BOTTOM_COLOR);
    this._houseFenceRailGfx = g;
    return g;
  }

  // ─── Obstacles & collision ───────────────────────────────────────────────

  // Collision for the house fence line (#344, reworked #372). This used to be a
  // literal `{ x: 300, y: 300, w: 576, h: 40 }` typed to match the posts' ORIGINAL
  // spot, so once the run was dragged elsewhere (#330/#337, baked in by #343) you
  // still bumped into an invisible fence back at the old position; later it became
  // a single bounding box over `this.props.houseFence`'s live post coordinates.
  //
  // #372 playtest follow-up: that single box over-covered near the ends/corners of
  // a diagonal run (its corners stick out past the actual thin, angled line). This
  // returns one tight rect per POST-TO-POST SPAN instead — a "thick line" hugging
  // each segment rather than one box over the whole run (see houseFence.js for the
  // full reasoning re: AABB segments vs. a true rotated rect).
  //
  // Unlike most rects, these belong to the whole post-record array rather than one
  // prop, so the #330 `own:` delta-shift can't describe them (dragging a single
  // post only needs ITS OWN two adjacent segments to move, and the #370 path tool
  // can change the array's LENGTH, not just positions). Each carries `ownGroup` +
  // `refit()` (`_fitHouseFenceSegment`, capturing its post-pair index) for the
  // ordinary translate case; `refitHouseFence()` below handles the count-changing
  // case by rebuilding the whole list. `isFence` (#317) marks them tie-able, same
  // as before.
  _houseFenceObstacles() {
    return this._buildHouseFenceSegmentRects();
  }

  _buildHouseFenceSegmentRects() {
    const posts = this.props.houseFence;
    if (!posts?.length) return [];
    const rects = [];
    for (let i = 0; i < posts.length - 1; i++) {
      const rect = { x: 0, y: 0, w: 0, h: 0, isFence: true, ownGroup: posts };
      rect.refit = () => this._fitHouseFenceSegment(rect, i);
      rect.refit();
      rects.push(rect);
    }
    return rects;
  }

  // Fit `rect` to post pair (i, i+1)'s CURRENT positions. HOUSE_FENCE_BAND is the
  // solid slice of the fence texture's height the old hardcoded rect used. Maths
  // in houseFence.js so it's testable without Phaser. Guards against the post at
  // this index no longer existing (a respace shrank the run) by collapsing to a
  // zero-size rect instead of throwing — `refitHouseFence()` immediately rebuilds
  // the whole list in that case anyway, so this is just a safety net.
  _fitHouseFenceSegment(rect, i) {
    const posts = this.props.houseFence;
    const a = posts?.[i], b = posts?.[i + 1];
    if (!a || !b) { rect.x = rect.y = rect.w = rect.h = 0; return rect; }
    const [box] = houseFenceSegmentRects([a, b], HOUSE_FENCE_BAND);
    if (box) Object.assign(rect, box);
    return rect;
  }

  // Re-derive the house-fence collision segments after the POST ARRAY changed —
  // either individual posts moving (ordinary #330 drag) or, since #370, the run
  // being RESPACED to a different post COUNT entirely (dragging a run endpoint).
  // A fixed set of per-index `refit()` closures (built once in
  // _buildHouseFenceSegmentRects) can follow posts moving, but can't describe a
  // different number of segments — so when the live post count no longer matches
  // the number of segment rects already in `this.obstacles`, this rebuilds the
  // whole list from scratch instead of refitting in place. (Safe to splice/push
  // here because this method is only ever called directly — from
  // `_respaceHouseFenceTo`, houseFencePath.js — never from inside another loop
  // over `this.obstacles`, unlike the ordinary per-post drag path in devDrag.js's
  // `_devDragShiftObstacles`, which stays a plain in-place `o.refit?.()` and never
  // needs to resize the array.)
  refitHouseFence() {
    const posts = this.props.houseFence;
    if (!this.obstacles || !posts) return;
    const existing = this.obstacles.filter((o) => o.ownGroup === posts);
    const wantCount = Math.max(0, posts.length - 1);
    if (existing.length !== wantCount) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        if (this.obstacles[i].ownGroup === posts) this.obstacles.splice(i, 1);
      }
      this.obstacles.push(...this._buildHouseFenceSegmentRects());
      return;
    }
    for (const o of existing) o.refit?.();
  }

  buildObstacles() {
    // Collision footprint for a centred prop (origin 0.5,0.5) from its live
    // position — so a movable prop's collision follows it instead of being pinned
    // to a hardcoded rect (#110). Inset to the solid body, not the full sprite.
    const centredBox = (p, w, h, extra = {}) =>
      p ? [{ x: p.x - w / 2, y: p.y - h / 2, w, h, ...extra }] : [];

    // Rects in world space {x, y, w, h} — top-left origin.
    // Sized to the solid/wall area of each prop (not full sprite bounds).
    //
    // `own` (#330): the prop record this rect's geometry was derived from. Inert in
    // normal play — nothing reads it — but the dev DRAG tool uses it to shift a
    // dragged object's collision by the same delta as its art, so what you bump into
    // matches what you see while you're positioning things. Obstacles are built ONCE
    // at create() from the props' live x/y, so without this tag a drag leaves the
    // collision rect behind at the source position. Rects with no owning prop (the
    // pasture perimeter fence, the stream) are deliberately untagged — they aren't
    // draggable objects.
    this.obstacles = [
      // House walls (#241) — derived from the LIVE prop anchor, not hardcoded absolutes
      // (#345; same latent bug as the stale fence rect in #344). Geometry: the sprite
      // is 84×66 at S=2 → 168×132, drawn with origin (0.5,1) at (house.x, house.y + 30)
      // — i.e. its foot sits 30px below the prop anchor (see the house build above).
      // The solid body is the lower 88px of the sprite, inset 6px on each side
      // (168 - 12 = 156 wide), so relative to the anchor:
      //   left  = house.x - 156/2      = house.x - 78
      //   top   = (house.y + 30) - 88  = house.y - 58
      // Matches (141, 195) at the current position (219, 253) and now follows the
      // house automatically if it's ever dragged/rebaked.
      ...(this.props.house ? [{ x: this.props.house.x - 78, y: this.props.house.y - 58, w: 156, h: 88, own: this.props.house }] : []),
      // Barn walls (#35) — the walk-in barn's perimeter with a south doorway gap.
      // Registered as this.barnObstacles by buildBarn (paddock/barn.js); spread in here.
      ...(this.barnObstacles || []), ...(this.doghouseObstacles || []), // + doghouse #237
      // Coop (origin 0.5,1 at 930,400; 64×52 at S=2 → 128×104). home:'flock' →
      // excluded from a flock bird's own obstacle list (#269, see _obstaclesFor).
      { x: 868, y: 300, w: 124, h: 100, home: 'flock', own: this.props.coop },
      // Trough — tied to the live trough (origin 0.5,0.5; 52×200 sprite after the
      // 90° rotation in #336, inset to its body) so the collision moves with it
      // when repositioned (#110/#106/#330). The rect is what stops a horse walking
      // THROUGH the trough to a spot on the far side (see data/trough.js).
      ...centredBox(this.props.trough, 44, 176, { isTrough: true, own: this.props.trough }),
      // House fence line — derived from the LIVE post records (#344), never hardcoded.
      ...this._houseFenceObstacles(),
      // Spinning wheel (#233) — solid ~52×20 footprint at swx,swy.
      ...(this.props.spinningWheel ? [{ x: this.props.spinningWheel.x - 26, y: this.props.spinningWheel.y - 20, w: 52, h: 20, own: this.props.spinningWheel }] : []),
      // Kitchen counter (#40) — solid ~56×16 counter-top footprint at S=2.
      ...(this.props.kitchenCounter ? [{ x: this.props.kitchenCounter.x - 28, y: this.props.kitchenCounter.y - 16, w: 56, h: 16, own: this.props.kitchenCounter }] : []),
      // Slop-maker (#225) — solid ~48×20 barrel footprint at S=2, house exterior.
      ...(this.props.slopMaker ? [{ x: this.props.slopMaker.x - 24, y: this.props.slopMaker.y - 20, w: 48, h: 20, own: this.props.slopMaker }] : []),
      // Shop stall (#29) — solid ~128×48 counter footprint at S=2. Mirrors the farm stand.
      ...(this.props.shop ? [{ x: this.props.shop.x - 64, y: this.props.shop.y - 48, w: 128, h: 48, isShop: true, own: this.props.shop }] : []),
      // The unified store (#215/#217/#222/#312) building footprint — registered by
      // its own concern mixin (buildGeneralStore, now built from buildTown), spread
      // in here like the barn/doghouse.
      ...(this.generalStoreObstacles || []),
      // Compost bin (#232) — solid ~80×40 footprint at S=2.
      ...(this.props.compostBin ? [{ x: this.props.compostBin.x - 40, y: this.props.compostBin.y - 40, w: 80, h: 40, own: this.props.compostBin }] : []),
      ...(this.birdEcosystemObstacles || []), ...this._petBowlObstacles(), // #202 fix; see worldObjects.js
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

    // Gate obstacle — fills the fence gap; matches the fence's own vertical band
    // (topY ± T/2) instead of a taller offset rect, which felt snaggy (#117).
    this.gateObstacle = { x: 960 - 56, y: topY - T / 2, w: 112, h: T, isGate: true, own: this.props.gate };
    if (this.props.gate && !this.props.gate.open) {
      this.obstacles.push(this.gateObstacle);
    }

    // Nest obstacles added after nests are built (in buildWorld nests are created before this)
    // Each nest: origin 0.5,0.5 at (nx,ny); 18×12 at S=2 → 36×24.
    // home:'flock' → like the coop, excluded from a flock bird's own obstacle
    // list so a hen can walk onto a nest to lay. Other creatures treat it as solid.
    for (const n of this.props.nests) {
      this.obstacles.push({ x: n.x - 18, y: n.y - 12, w: 36, h: 24, isNest: true, home: 'flock', own: n });
    }

    // Trash can (#191) — solid drum footprint. Sprite 32×46 at S=2 (origin 0.5,1);
    // the drum body is the lower ~38px of the art → ~48×56 solid, bottom at y.
    if (this.props.trashCan) {
      const t = this.props.trashCan;
      this.obstacles.push({ x: t.x - 24, y: t.y - 56, w: 48, h: 56, isTrashCan: true, own: t });
    }

    // Gathering source obstacles — solid base centered on x, bottom at y.
    for (const s of this.props.sources) {
      if (!s.ob) continue;
      this.obstacles.push({ x: s.x - s.ob.w / 2, y: s.y - s.ob.h, w: s.ob.w, h: s.ob.h, isSource: true, own: s });
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

  // The obstacle list a given creature should respect: shared obstacles minus any
  // tagged as its home (species id, or 'flock' for coop/nests); dog is gate-exempt.
  _obstaclesFor(key) {
    const species = this._speciesOf(key);
    const home = SPECIES[species]?.capabilities?.roosts ? 'flock' : species;
    if (species === 'dog') return this.obstacles.filter(o => o.home !== home && !o.isGate);
    return this.obstacles.filter(o => o.home !== home);
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
