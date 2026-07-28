// World building (ground, house, barn, coop, fence, gathering sources) and the obstacle/
// collision helpers. Applied as a functional mixin so `this` is the scene.

import Phaser from 'phaser';
import {
  WORLD_W, WORLD_H, PASTURE_BOUNDS, GATE_X, GATE_HALF_W, S,
  FENCE_POST_CROP_W,
  FENCE_RAIL_TOP_OFFSET, FENCE_RAIL_BOTTOM_OFFSET, FENCE_RAIL_THICKNESS,
  FENCE_RAIL_TOP_COLOR, FENCE_RAIL_BOTTOM_COLOR,
  PASTURE_FENCE_BAND,
} from './constants.js';
import { SPECIES } from '../../data/species/index.js';
import { bakeStaticGraphics } from './bakeGraphics.js';
import { houseFenceSegmentRect, perimeterFenceSegmentRect } from './houseFence.js';
import { fenceRailDepth } from './fencePath.js';

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
      // fromHouse/toGate/toStream: #373 drag tool, repositioned + bend points
      // added 2026-07-27 (owner's own placements).
      fromHouse: [[221, 265], [219, 380], [398, 511], [680, 574], [905, 720]],
      toGate:    [[905, 720], [983, 763], [961, 874], [976, 1124], [952, 1406], [1410, 1379], [1394, 1268]],
      toStream:  [[978, 797], [1029, 663], [1180, 537], [1454, 459], [1718, 534], [1844, 468], [1848, 221]],
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
      // Chaikin-style corner-cutting (#378): soften each interior waypoint's
      // hard kink by repeatedly replacing points with two points pulled a
      // percentage toward their neighbors, before the straight-segment
      // stamping below runs. This is a local copy used only for this bake —
      // it never touches `wp` itself, so the real corner points
      // `_pathRoutes` holds (and that splineDrag.js drags/inserts against)
      // are untouched. Endpoints are left alone (each pass re-anchors the
      // first/last point) so route junctions/entrances still land exactly
      // on the declared coordinates.
      //
      // A single pass only trims the very tip of the corner, which still
      // reads as a (smaller) cut corner rather than a true curve — a
      // playtest note on the first version of this fix (#378). Running
      // several passes, each smoothing the previous pass's output, converges
      // toward a properly rounded bend while staying a cheap point-pull
      // (no bezier/spline math needed).
      const CHAIKIN_PASSES = 3;
      const CHAIKIN_PULL = 0.25;
      let smoothed = wp;
      for (let pass = 0; pass < CHAIKIN_PASSES && smoothed.length > 2; pass++) {
        smoothed = [
          smoothed[0],
          ...smoothed.slice(1, -1).flatMap(([x, y], idx) => {
            const [px, py] = smoothed[idx];       // previous point (idx is i-1 in current array)
            const [nx, ny] = smoothed[idx + 2];   // next point
            return [
              [x + (px - x) * CHAIKIN_PULL, y + (py - y) * CHAIKIN_PULL],
              [x + (nx - x) * CHAIKIN_PULL, y + (ny - y) * CHAIKIN_PULL],
            ];
          }),
          smoothed[smoothed.length - 1],
        ];
      }
      const pts = [];
      for (let i = 0; i < smoothed.length - 1; i++) {
        const [x0, y0] = smoothed[i], [x1, y1] = smoothed[i + 1];
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / 30));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const wobble = 10 * Math.sin((x0 + (x1 - x0) * t) / 140);
          pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + wobble]);
        }
      }
      pts.push(smoothed[smoothed.length - 1]);
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

    // Fords (#377): a path drag can create or close a stream crossing just as
    // much as a stream drag can, so re-derive the stream's collision here too.
    // Guarded on `_streamCtrl` existing — at boot, `buildPath()` runs before
    // `buildStream()` (below), so the very first call has no stream yet to
    // re-check; `buildStream()`'s own initial `_rebuildStream()` call already
    // scans the (by-then-built) `_pathRoutes` once it runs.
    if (this._streamCtrl) this._rebuildStream();
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
    // #375 rework: the run is now an ordered list of JOINTS (start, any
    // interior joints, end) rather than a single {start,end} pair — a chain
    // of straight SEGMENTS the fence bends around. Initially just the two
    // ends (one segment, same as before); dragging an individual #330-style
    // post grab point (houseFencePath.js's `_houseFenceResolveJoint`) can
    // PROMOTE an auto-filled interior post into a new joint, splitting a
    // segment in two. `_fillHouseFencePosts` runs `respaceHouseFence` once per
    // segment and stitches the results into the flat `this.props.houseFence`
    // list the rest of the game reads.
    const fenceStart = { x: -136, y: 57 };
    const fenceEnd   = { x: -136 + 5 * 96, y: 57 }; // 6 posts, 96px spacing
    this.props.houseFenceJoints = [fenceStart, fenceEnd];
    this.props.houseFence = [];
    this._fillHouseFencePosts(this.props.houseFenceJoints);
    this._buildHouseFenceRails(this.props.houseFenceJoints);

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

    // Market stall (#29, narrowed by #312) — TOOL UPGRADES only (#295) now; feed
    // moved to the unified store in town (paddock/town.js's buildTown →
    // buildGeneralStore). Unstaffed — the shopkeeper NPC that briefly staffed the
    // unified store (#244/#312) was removed per #388. West of the farm stand
    // (SELL station, 1628,753) so the two economy halves read as distinct.
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
      { x: 1510, y: 412, content: 'apple',  tex: 'appleTree',    label: 'Apple Tree',    reach: 90,  ob: { w: 44,  h: 26 } }, // #330 drag tool, repositioned 2026-07-27
      { x: 1635, y: 447, content: 'orange', tex: 'orangeTree', label: 'Orange Tree', reach: 90, ob: { w: 44, h: 26 } }, // #228 tree, mirrors apple; #330 drag tool, repositioned 2026-07-27
      { x: 1573, y: 442, content: 'berry',  tex: 'berryBush',  label: 'Berry Bush',  reach: 85, ob: { w: 40, h: 18 } }, // #228 bush, same mechanic, no trunk; #330 drag tool, repositioned 2026-07-27
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

  // #376 first gave the pasture perimeter the same joint/segment data model
  // as the house fence (ordered joints, one straight segment per consecutive
  // pair), but auto-generated a full 4-sided rectangle around the pasture
  // with its own separate rendering technique. #386: the owner asked for
  // that auto-generated shape to be thrown away entirely — no attempt to
  // preserve or convert its position — and replaced with a SECOND instance
  // of the literal house-fence drag tool (see pastureFencePath.js/
  // fencePath.js), started from a small blank two-joint run near the gate.
  // The owner places/bends the real perimeter himself live with the #330/#370
  // drag tool, then hands back an export to bake in here as the permanent
  // shape — mirroring how the house fence, worn paths, and the stream were
  // all iterated on this session (drag live → export → bake in).
  buildPastureFence() {
    const PB = PASTURE_BOUNDS;
    const topY = PB.minY - 8;
    const gateX = GATE_X, gateY = topY;

    // Gate (interactive) — positioned at top center of pasture. Built FIRST so
    // the gate-linked joint below can be derived from its position.
    const gateSprite = this.add.image(gateX, gateY, 'gateClosed')
      .setScale(S).setDepth(gateY).setOrigin(0.5, 0.5);
    this.props.gate = { x: gateX, y: gateY, sprite: gateSprite, open: false };

    // Full perimeter, the owner's own placement (#330/#370 drag tool, baked
    // in 2026-07-27) — bent out from the gate's left side, around the whole
    // pasture, back to the gate's right side. Both end joints are LINKED to
    // the gate (`gateLink` — `_applyPastureGateLinks` re-derives their x/y
    // from the gate's CURRENT position every respace, the "follows if the
    // gate moves" behavior #376 built); the rest are plain fixed joints,
    // draggable/promotable in the dev tool same as any house-fence joint.
    // The two south corners (originally y:1523/y:1516) sat just 5-12px above
    // the world's south camera-scroll clamp — the exact permanently-untappable
    // dead zone #390 fixed (see DEV_DRAG_MAX_Y in constants.js). Nudged up to
    // sit safely clear of that line; same perimeter shape, same margin above
    // PASTURE_BOUNDS.maxY (1450) the fence line was already respecting.
    this.props.pastureFenceJoints = [
      { x: gateX - GATE_HALF_W, y: gateY, gateLink: 'left' },
      { x: -39, y: 870 },
      { x: -46, y: 1490 },
      { x: 2032, y: 1490 },
      { x: 2021, y: 860 },
      { x: gateX + GATE_HALF_W, y: gateY, gateLink: 'right' },
    ];
    this.props.pastureFence = [];
    this._applyPastureGateLinks(this.props.pastureFenceJoints);
    this._fillPastureFencePosts(this.props.pastureFenceJoints);
    this._buildPastureFenceRails(this.props.pastureFenceJoints);
  }

  // House-fence rail lines (#372 rework, #372 playtest fix, #375 polyline
  // rework). Draws the two rails as continuous line segments joint-to-joint
  // for EVERY segment of the run — one pair of lines per consecutive joint
  // pair, not one pair for the whole span — so a bent fence's rails follow
  // every corner instead of cutting a chord across it. Each line is offset by
  // a FIXED vertical amount from the post's own y — matching the post
  // sprites, which are always drawn un-rotated (plain vertical post art)
  // regardless of a segment's angle. An earlier version offset the rails
  // perpendicular to the run's ANGLE instead, which lined up with the post art
  // only when the run was horizontal — at any other angle the perpendicular
  // offset visibly drifted off the (un-rotated) post sprites, worse the
  // steeper the angle (2026-07-27 playtest). Since `respaceFenceRun` places
  // every post exactly on the straight line between its segment's two joints,
  // a pure vertical translation of that line still passes through every
  // intermediate post's own (x, y+offset) point — collinearity is preserved
  // under a (0, dy) translation — so one line per rail per segment still
  // reaches every post correctly, just anchored to the post art instead of
  // rotated to the segment.
  //
  // #386: generalized to take a `gfxProp` — the instance-field name to stash
  // the Graphics object under — so a SECOND fence instance (the pasture
  // fence) can call this exact same function without clobbering the house
  // fence's rail Graphics. `_buildHouseFenceRails`/`_buildPastureFenceRails`
  // below are the two thin per-instance wrappers fencePath.js's
  // `respaceFromJoints` calls by name.
  _buildFenceRails(joints, gfxProp) {
    this[gfxProp]?.destroy();
    if (!joints || joints.length < 2) { this[gfxProp] = null; return null; }
    const g = this.add.graphics().setDepth(fenceRailDepth(joints));
    // Post sprites are drawn with origin (0, 0.5) — a joint's x is each post's
    // LEFT edge, not its visual center. That's invisible on a mostly-
    // horizontal run (a few px of x-offset is lost along a long line), but on
    // a north/south run the rails end up hugging one side of the post column
    // instead of passing through its center (2026-07-27 playtest). Shift both
    // ends by half the cropped post width so the rails attach at post center.
    const cx = (FENCE_POST_CROP_W * S) / 2;
    const drawRail = (offset, color) => {
      g.lineStyle(FENCE_RAIL_THICKNESS, color, 1);
      for (let i = 0; i < joints.length - 1; i++) {
        const a = joints[i], b = joints[i + 1];
        g.lineBetween(a.x + cx, a.y + offset, b.x + cx, b.y + offset);
      }
    };
    drawRail(FENCE_RAIL_TOP_OFFSET, FENCE_RAIL_TOP_COLOR);
    drawRail(FENCE_RAIL_BOTTOM_OFFSET, FENCE_RAIL_BOTTOM_COLOR);
    this[gfxProp] = g;
    return g;
  }

  _buildHouseFenceRails(joints)   { return this._buildFenceRails(joints, '_houseFenceRailGfx'); }
  _buildPastureFenceRails(joints) { return this._buildFenceRails(joints, '_pastureFenceRailGfx'); }

  // ─── Obstacles & collision ───────────────────────────────────────────────

  // Collision for the house fence line (#344, reworked #372). This used to be a
  // literal `{ x: 300, y: 300, w: 576, h: 40 }` typed to match the posts' ORIGINAL
  // spot, so once the run was dragged elsewhere (#330/#337, baked in by #343) you
  // still bumped into an invisible fence back at the old position; later it became
  // a single bounding box over `this.props.houseFence`'s live post coordinates.
  //
  // #372 playtest follow-up: that single box over-covered near the ends/corners of
  // a diagonal run (its corners stick out past the actual thin, angled line). This
  // returns one tight rect per POST-TO-POST SPAN instead of one for the whole run.
  //
  // #387 follow-up: even a single ~96px span's box stuck its corners out on a
  // diagonal. Each span's rect is now a true ORIENTED rect (OBB) — centered on
  // the segment, sized to its length × the collision band, rotated to match its
  // angle — instead of an axis-aligned box (see houseFence.js and `_hits()`'s
  // comment below for the maths).
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
    if (!a || !b) { rect.x = rect.y = rect.w = rect.h = rect.angle = 0; return rect; }
    Object.assign(rect, houseFenceSegmentRect(a, b, HOUSE_FENCE_BAND));
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

  // Pasture-perimeter fence collision (#376 rework — was 4 hand-fixed rects
  // over the original rectangle). Mirrors `_houseFenceObstacles`/
  // `_buildHouseFenceSegmentRects`/`refitHouseFence` exactly, one tight rect
  // per POST-TO-POST span of `this.props.pastureFence` instead of a fixed set
  // over the old 4-sided rectangle — so collision follows the live joint
  // polyline (including any bend point dragged into it) rather than a shape
  // baked to the fence's original corners. Uses `perimeterFenceSegmentRect`
  // (houseFence.js) — an oriented rect (#387), so unlike the old axis-aligned
  // version it handles a pure-vertical span (the left/right perimeter walls)
  // exactly like any other angle; kept as its own name for clarity even though
  // it's the same maths as the house-fence version now.
  _pastureFenceObstacles() {
    return this._buildPastureFenceSegmentRects();
  }

  _buildPastureFenceSegmentRects() {
    const posts = this.props.pastureFence;
    if (!posts?.length) return [];
    const rects = [];
    for (let i = 0; i < posts.length - 1; i++) {
      const rect = { x: 0, y: 0, w: 0, h: 0, isFence: true, ownGroup: posts };
      rect.refit = () => this._fitPastureFenceSegment(rect, i);
      rect.refit();
      rects.push(rect);
    }
    return rects;
  }

  _fitPastureFenceSegment(rect, i) {
    const posts = this.props.pastureFence;
    const a = posts?.[i], b = posts?.[i + 1];
    if (!a || !b) { rect.x = rect.y = rect.w = rect.h = rect.angle = 0; return rect; }
    Object.assign(rect, perimeterFenceSegmentRect(a, b, PASTURE_FENCE_BAND));
    return rect;
  }

  // Same "rebuild on count change, else refit in place" logic as `refitHouseFence`.
  refitPastureFence() {
    const posts = this.props.pastureFence;
    if (!this.obstacles || !posts) return;
    const existing = this.obstacles.filter((o) => o.ownGroup === posts);
    const wantCount = Math.max(0, posts.length - 1);
    if (existing.length !== wantCount) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        if (this.obstacles[i].ownGroup === posts) this.obstacles.splice(i, 1);
      }
      this.obstacles.push(...this._buildPastureFenceSegmentRects());
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

    // ── Solid pasture fence ── (#376: one tight rect per post-to-post span of
    // the live joint polyline, instead of 4 rects fixed to the original
    // rectangle — see `_pastureFenceObstacles` above. `this.fenceObstacles` is
    // kept as the same PUBLIC name/shape other code may already expect (a
    // flat array of `isFence: true` rects), it's just derived now instead of
    // hand-typed. The gate opening is still just "wherever the two gate-linked
    // joints currently are" — no separate gate-gap rect needed, since the open
    // polyline doesn't have a segment spanning the gap in the first place.
    const PB = PASTURE_BOUNDS;
    const topY = PB.minY - 8;
    const T = PASTURE_FENCE_BAND; // gate collision thickness — matches the fence's own collision band
    this.fenceObstacles = this._pastureFenceObstacles();
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

  // Point-vs-rect check with a character radius. Every obstacle in the game
  // goes through this one function.
  //
  // #387: fence segments now carry an optional `angle` (radians) so their
  // collision can be a true rect ORIENTED along the rail instead of an
  // axis-aligned box that over-covers a diagonal span. When `obs.angle` is
  // set, `obs.x`/`obs.y` are the rect's CENTER (not a corner) and `obs.w`/
  // `obs.h` are its full length/thickness — the standard "rotate the query
  // point into the rect's own local frame, then do the same axis-aligned
  // half-extent test" technique for circle-vs-OBB. Every other obstacle in
  // the game (buildings, props, plain fence stand-ins, etc.) has no `angle`
  // and falls through to the original corner-based AABB test unchanged.
  _hits(x, y, r, obs) {
    // `!== undefined`, not a truthy check — a perfectly horizontal segment's
    // angle is exactly 0, which is falsy but still means "oriented rect".
    if (obs.angle !== undefined) {
      const cos = Math.cos(-obs.angle), sin = Math.sin(-obs.angle);
      const dx = x - obs.x, dy = y - obs.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const hw = obs.w / 2, hh = obs.h / 2;
      return lx + r > -hw && lx - r < hw && ly + r > -hh && ly - r < hh;
    }
    return x + r > obs.x && x - r < obs.x + obs.w &&
           y + r > obs.y && y - r < obs.y + obs.h;
  }

  // Closest point ON an obstacle rect to (px,py) — handles both a plain
  // corner-based AABB ({x,y,w,h}, x/y = top-left, matching `_hits` above) and
  // an oriented rect ({x,y,w,h,angle}, x/y = CENTER). Used by fence-adjacent
  // features that need "the nearest point on THIS rail" rather than just a
  // boolean hit test (tying a horse to a fence, the dev tooltip's nearest
  // rail) — added alongside the #387 oriented-rect fence collision so those
  // stay correct instead of clamping into a rect using corner-based math a
  // centered, rotated rect doesn't have.
  _nearestPointOnObstacleRect(px, py, o) {
    if (o.angle === undefined) {
      return {
        x: Math.min(Math.max(px, o.x), o.x + o.w),
        y: Math.min(Math.max(py, o.y), o.y + o.h),
      };
    }
    const cos = Math.cos(o.angle), sin = Math.sin(o.angle);
    const dx = px - o.x, dy = py - o.y;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const hw = o.w / 2, hh = o.h / 2;
    const clx = Math.min(Math.max(lx, -hw), hw);
    const cly = Math.min(Math.max(ly, -hh), hh);
    return {
      x: o.x + clx * cos - cly * sin,
      y: o.y + clx * sin + cly * cos,
    };
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
