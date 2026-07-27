// World building (ground, house, barn, coop, fence, gathering sources) and the obstacle/
// collision helpers. Applied as a functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { WORLD_W, WORLD_H, PASTURE_BOUNDS, GATE_GAP_X0, GATE_GAP_X1, S } from './constants.js';
import { SPECIES } from '../../data/species/index.js';
import { bakeStaticGraphics } from './bakeGraphics.js';

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
    const g = this.add.graphics().setDepth(-95);
    const fromHouse = [[235, 322], [470, 500], [700, 610], [900, 700]];   // house → junction
    const toGate   = [[900, 700], [935, 800], [960, 895]];               // junction → pasture gate
    const toStream = [[900, 700], [1180, 560], [1420, 440], [1610, 372]]; // junction → stream bank
    const toStand  = [[1955, 742], [1800, 772], [1640, 794], [1560, 802]]; // off east edge → farm stand
    const routes = [fromHouse, toGate, toStream, toStand];
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

    // Static from here on — bake it so those hundreds of fillCircles aren't
    // re-tessellated every frame (#325). Pad = the largest stamp radius.
    bakeStaticGraphics(this, g, routes.flat(), 30, -95);
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
      [80, 400], [140, 600], [260, 360], [340, 620], [460, 410],
      [580, 580], [700, 370], [800, 610], [920, 450], [1000, 350],
      [60, 540], [420, 560], [640, 520], [190, 290], [860, 560],
      [1100, 450], [1200, 620], [1340, 390], [1460, 570], [1580, 430],
      [1700, 600], [1480, 720], [1860, 520], [1050, 800], [1180, 950],
      [1380, 850], [1520, 980], [1650, 780], [1780, 900], [280, 880],
      [420, 1020], [560, 900], [700, 1040], [850, 820], [980, 1020],
      [120, 750], [240, 1100], [360, 980], [500, 800], [630, 1100],
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
    this.props.houseFence = [];
    for (let i = 0; i < 6; i++) {
      const x = 300 + i * 96, y = 320;
      const sprite = this.add.image(x, y, 'fence').setScale(S).setDepth(y).setOrigin(0, 0.5);
      this.props.houseFence.push({ x, y, sprite, label: `Fence Post ${i + 1}` });
    }

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
    const tx = 1130, ty = 992;
    const troughSprite = this.add.image(tx, ty, 'trough')
      .setScale(S).setDepth(ty).setOrigin(0.5, 0.5);
    // level = numeric water (0..TROUGH_CAP); `filled` mirrors level>0 (kept in sync by _setTroughLevel, #103).
    this.props.trough = { x: tx, y: ty, sprite: troughSprite, level: 0, filled: false };
    this.buildShelter(); // covered shelter (#319); places props.shelter — worldObjects.js

    // Trash can (#191) — a dented metal bin the ambient raccoon rummages in at night.
    // Purely a charming prop (no stock/gathering/economy), in the farm band near the
    // stand so the nocturnal mischief happens somewhere the player passes.
    const trashX = 1470, trashY = 720;
    const trashSprite = this.add.image(trashX, trashY, 'trashCan')
      .setScale(S).setDepth(trashY).setOrigin(0.5, 1);
    this.props.trashCan = { x: trashX, y: trashY, sprite: trashSprite, spill: null, open: false };

    // Spinning wheel (#233) — the crafting station that spins a basket of raw wool into
    // yarn (worth more at the stand). In a crafting nook east of the BARN. `craft` names
    // the conversion the useDispatch spin action reads (wool → yarn), so it's data-driven.
    // Position (1673, 1177) — the owner's own placement (#330 drag tool, baked in by #335).
    const swx = 1673, swy = 1177;
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
    this.props.compostBin = { x: 300, y: 1000, sprite: this.add.image(300, 1000, 'compostBin').setScale(S).setDepth(1000).setOrigin(0.5, 1) }; // Compost bin (#232) — dump spot, pasture NW.

    // Market stall (#29, narrowed by #312) — TOOL UPGRADES only (#295) now; feed +
    // the shopkeeper NPC moved to the unified store in town (paddock/town.js's
    // buildTown → buildGeneralStore), so this stall is unstaffed. West of the farm
    // stand (SELL station, 1600,780) so the two economy halves read as distinct.
    // Position (2156, 523) — the owner's own placement (#330 drag tool, baked in by #335).
    const shopX = 2156, shopY = 523;
    const shopSprite = this.add.image(shopX, shopY, 'shopStall')
      .setScale(S).setDepth(shopY).setOrigin(0.5, 1);
    this.props.shop = { x: shopX, y: shopY, sprite: shopSprite };
    // Solid counter footprint, added to this.obstacles below.

    // Gathering sources (#63) — static, infinite props the player fills carriers at.
    this.buildSources();

    // Pet food + water bowls (#202/#283/#311) — fillable dishes the pet eats/drinks
    // from directly (not gather sources). The player keeps them stocked.
    this.buildCatBowls();
    this.buildBunnyBowl();
    this.buildDoghouse(); // #237 decorative yard prop; sets this.doghouseObstacles
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
      { x: 1367, y: 1105, content: 'hay',    tex: 'haystack',     label: 'Hay Pile',      reach: 100, ob: { w: 84,  h: 36 } },
      { x: 1234, y: 425, content: 'carrot', tex: 'carrotGarden', label: 'Carrot Garden', reach: 100, ob: { w: 104, h: 42 } },
      { x: 1660, y: 512, content: 'apple',  tex: 'appleTree',    label: 'Apple Tree',    reach: 90,  ob: { w: 44,  h: 26 } },
      { x: 1802, y: 497, content: 'orange', tex: 'orangeTree', label: 'Orange Tree', reach: 90, ob: { w: 44, h: 26 } }, // #228 tree, mirrors apple
      { x: 1736, y: 546, content: 'berry',  tex: 'berryBush',  label: 'Berry Bush',  reach: 85, ob: { w: 40, h: 18 } }, // #228 bush, same mechanic, no trunk
      { x: 818,  y: 402, content: 'seed',   tex: 'grainBin',     label: 'Grain Bin',     reach: 95,  ob: { w: 66,  h: 40 } },
      { x: 1311, y: 1016, content: 'water',  tex: 'well',         label: 'Well',          reach: 95,  ob: { w: 52,  h: 22 } },
      // Kibble sack (#202 rework) — the cat-food SOURCE, by the house. The player
      // scoops cat food into a basket here (like the grain bin for seed), then pours
      // it into the food bowl. The bowls themselves are no longer gather sources —
      // they're fillable dishes the cat eats/drinks from directly (buildCatBowls).
      { x: 120,  y: 420, content: 'catFood',  tex: 'kibbleSack',   label: 'Kibble Sack',   reach: 90, ob: { w: 22, h: 20 } },
      // Bunny hutch (#224, reworked #283) — gather SOURCE for bunny food, scooped into a
      // basket then poured into the bunny FOOD BOWL (buildBunnyBowl), which bunnies eat
      // from directly; stocking it also lures a wild bunny in (capped at 4). No ground
      // pile (items.js `stocks`). Water bowl fills from a plain bucket, like the cat's.
      { x: 1293, y: 107, content: 'bunnyFood',  tex: 'bunnyHutch',    label: 'Bunny Hutch', reach: 100, ob: { w: 44, h: 30 } },
      // Nectar station (#226) — sugar-water jug by the house; fill a bucket, pour into the hummingbird feeder (its OWN resource vs seed #240).
      { x: 190,  y: 360, content: 'nectar',   tex: 'nectarStation', label: 'Nectar Jug',  reach: 90,  ob: { w: 24, h: 24 } },
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
      // House walls (#241) (origin 0.5,1 at 219,283; sprite 84×66 at S=2 → 168×132; walls ~lower 90px)
      { x: 141, y: 195, w: 156, h: 88 },
      // Barn walls (#35) — the walk-in barn's perimeter with a south doorway gap.
      // Registered as this.barnObstacles by buildBarn (paddock/barn.js); spread in here.
      ...(this.barnObstacles || []), ...(this.doghouseObstacles || []), // + doghouse #237
      // Coop (origin 0.5,1 at 930,400; 64×52 at S=2 → 128×104). home:'flock' →
      // excluded from a flock bird's own obstacle list (#269, see _obstaclesFor).
      { x: 868, y: 300, w: 124, h: 100, home: 'flock' },
      // Trough — tied to the live trough (origin 0.5,0.5; 200×52 sprite, inset to
      // its body) so the collision moves with it when repositioned (#110/#106).
      ...centredBox(this.props.trough, 176, 44, { isTrough: true }),
      // Fence line (6 segments at y=320, origin 0,0.5; 96×48 each → x=300..876). isFence (#317): any rail is tie-able.
      { x: 300, y: 300, w: 576, h: 40, isFence: true },
      // Spinning wheel (#233) — solid ~52×20 footprint at swx,swy.
      ...(this.props.spinningWheel ? [{ x: this.props.spinningWheel.x - 26, y: this.props.spinningWheel.y - 20, w: 52, h: 20 }] : []),
      // Kitchen counter (#40) — solid ~56×16 counter-top footprint at S=2.
      ...(this.props.kitchenCounter ? [{ x: this.props.kitchenCounter.x - 28, y: this.props.kitchenCounter.y - 16, w: 56, h: 16 }] : []),
      // Slop-maker (#225) — solid ~48×20 barrel footprint at S=2, house exterior.
      ...(this.props.slopMaker ? [{ x: this.props.slopMaker.x - 24, y: this.props.slopMaker.y - 20, w: 48, h: 20 }] : []),
      // Shop stall (#29) — solid ~128×48 counter footprint at S=2. Mirrors the farm stand.
      ...(this.props.shop ? [{ x: this.props.shop.x - 64, y: this.props.shop.y - 48, w: 128, h: 48, isShop: true }] : []),
      // The unified store (#215/#217/#222/#312) building footprint — registered by
      // its own concern mixin (buildGeneralStore, now built from buildTown), spread
      // in here like the barn/doghouse.
      ...(this.generalStoreObstacles || []),
      // Compost bin (#232) — solid ~80×40 footprint at S=2.
      ...(this.props.compostBin ? [{ x: this.props.compostBin.x - 40, y: this.props.compostBin.y - 40, w: 80, h: 40 }] : []),
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
    this.gateObstacle = { x: 960 - 56, y: topY - T / 2, w: 112, h: T, isGate: true };
    if (this.props.gate && !this.props.gate.open) {
      this.obstacles.push(this.gateObstacle);
    }

    // Nest obstacles added after nests are built (in buildWorld nests are created before this)
    // Each nest: origin 0.5,0.5 at (nx,ny); 18×12 at S=2 → 36×24.
    // home:'flock' → like the coop, excluded from a flock bird's own obstacle
    // list so a hen can walk onto a nest to lay. Other creatures treat it as solid.
    for (const n of this.props.nests) {
      this.obstacles.push({ x: n.x - 18, y: n.y - 12, w: 36, h: 24, isNest: true, home: 'flock' });
    }

    // Trash can (#191) — solid drum footprint. Sprite 32×46 at S=2 (origin 0.5,1);
    // the drum body is the lower ~38px of the art → ~48×56 solid, bottom at y.
    if (this.props.trashCan) {
      const t = this.props.trashCan;
      this.obstacles.push({ x: t.x - 24, y: t.y - 56, w: 48, h: 56, isTrashCan: true });
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
