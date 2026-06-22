import Phaser from 'phaser';
import { saveHorse } from '../data/save.js';
import {
  playHoofbeat, playEat, playDrink, playBrush, playChime,
  playSplash, playBirdChirp, startWind, stopWind, startMusic, stopMusic,
} from '../audio/sounds.js';

const WORLD_W = 1920;
const WORLD_H = 1600;

const INTERACT_DIST = 100;
const PLAYER_SPEED  = 210;
const RIDE_SPEED    = 340;

const BOUNDS      = { minX: 180, maxX: 1740, minY: 200, maxY: 900 };
const PLAYER_BOUNDS = { minX: 40, maxX: 1880, minY: 80, maxY: 1550 };
const PASTURE_BOUNDS = { minX: 180, maxX: 1740, minY: 910, maxY: 1450 };

// Gate opening in the top pasture fence (the only gap; gate sits here)
const GATE_X = 960;
const GATE_GAP_X0 = 900;
const GATE_GAP_X1 = 1020;

const S = 2;

export default class PaddockScene extends Phaser.Scene {
  constructor() {
    super('PaddockScene');
  }

  create() {
    this.horse    = this.registry.get('horse');
    this.decayAccum = 0;
    this.saveAccum  = 0;
    this.horses     = [];
    this.foals      = [];
    this.animals    = [];
    this.registry.set('viewingChicken', null);

    // World interactables
    this.props = { trough: null, hayPiles: [], seedPiles: [], nests: [] };
    this.inventory = {};
    this.basketEggs = 0;
    this.money = 0;
    this.farmStand = null;
    this.npcs = [];

    // Riding / leading state
    this.riding   = null; // { h, saddleImg }
    this.rideNav  = null; // tap-to-move waypoints while mounted
    this._rideStuck = 0;
    this.leadHorses = [];  // horses currently being led (in order, trailing the player)
    this.leadRope = null; // Graphics line

    this.buildWorld();
    this.buildObstacles();
    this.buildHorses();
    this.buildAnimals();
    this.buildPlayer();
    this.buildFarmStand();

    // Periodic AI tick: direct idle horses to food/water
    this.time.addEvent({ delay: 3000, loop: true, callback: this.horseTick, callbackScope: this });

    // NPC customer spawning — schedule first arrival
    this._scheduleNextCustomer();

    this.isNight = false;
    this.game.events.on('horse-action',    this.doAction,        this);
    this.game.events.on('phase-change',    this.onPhaseChange,   this);
    this.game.events.on('basket-shortcut', this.doBasketAction,  this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('horse-action',    this.doAction,        this);
      this.game.events.off('phase-change',    this.onPhaseChange,   this);
      this.game.events.off('basket-shortcut', this.doBasketAction,  this);
      stopWind();
      stopMusic();
    });

    // Ambient audio
    startWind();
    startMusic();
    this._scheduleBirds();

    // Riding hoofbeat timer (fires at horse walk frame rate)
    this._hoofTimer = this.time.addEvent({
      delay: 310, loop: true,
      callback: () => {
        if (!this.riding) return;
        const { h } = this.riding;
        const moving = h.sprite.anims.isPlaying && h.sprite.anims.currentAnim?.key.startsWith('walk_');
        if (moving) playHoofbeat(true);
      },
    });
  }

  // ─── World ───────────────────────────────────────────────────────────────

  buildWorld() {
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

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
      [1700, 600], [1800, 380], [1860, 520], [1050, 800], [1180, 950],
      [1380, 850], [1520, 980], [1650, 780], [1780, 900], [280, 880],
      [420, 1020], [560, 900], [700, 1040], [850, 820], [980, 1020],
      [120, 750], [240, 1100], [360, 980], [500, 800], [630, 1100],
    ].forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length])
        .setScale(S).setDepth(y);
    });

    // Barn (decorative)
    this.add.image(240, 280, 'barn').setScale(S).setDepth(279).setOrigin(0.5, 1);

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

    // Water trough (interactive) — inside the gated pasture
    const tx = 740, ty = 1100;
    const troughSprite = this.add.image(tx, ty, 'trough')
      .setScale(S).setDepth(ty).setOrigin(0.5, 0.5);
    this.props.trough = { x: tx, y: ty, sprite: troughSprite, filled: false, drinks: 0 };

    // --- Pasture Fencing & Gate ---
    this.buildPastureFence();
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
    // Rects in world space {x, y, w, h} — top-left origin.
    // Sized to the solid/wall area of each prop (not full sprite bounds).
    this.obstacles = [
      // Barn walls (origin 0.5,1 at 240,280; sprite 84×66 at S=2 → 168×132; walls ~lower 90px)
      { x: 162, y: 192, w: 156, h: 88 },
      // Coop (origin 0.5,1 at 930,400; sprite 64×52 at S=2 → 128×104).
      // home:'chicken' → the coop is the chickens' home, so it's excluded from
      // their personal obstacle list (they're allowed to walk in). See _obstaclesFor.
      { x: 868, y: 300, w: 124, h: 100, home: 'chicken' },
      // Trough (origin 0.5,0.5 at 740,1100; sprite 100×26 at S=2 → 200×52)
      { x: 652, y: 1078, w: 176, h: 44 },
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
    // Each nest: origin 0.5,0.5 at (nx,ny); 18×12 at S=2 → 36×24
    for (const n of this.props.nests) {
      this.obstacles.push({ x: n.x - 18, y: n.y - 12, w: 36, h: 24, isNest: true });
    }
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

  // ─── Horses ──���─────────────────────────────────────────────���─────────────

  buildHorses() {
    const h1 = this.spawnHorse(680,  1200, 'horse',  1500);
    const h2 = this.spawnHorse(380,  1300, 'horse2',  800);
    const h3 = this.spawnHorse(1380, 1250, 'horse3', 2200);
    const h4 = this.spawnHorse(1050, 1150, 'horse4', 1200);
    const h5 = this.spawnHorse(520,  1350, 'horse5', 3000);
    const h6 = this.spawnHorse(1600, 1280, 'horse6', 1800);
    const h7 = this.spawnHorse(900,  1220, 'horse7', 2600); // Ebony — Friesian

    // Foals disabled for now — re-enable by uncommenting
    // this.spawnFoal(h3.sprite.x + 80,  h3.sprite.y, 'foal1', h3); // grey foal → Ash
    // this.spawnFoal(h4.sprite.x - 70,  h4.sprite.y, 'foal2', h4); // paint foal → Splash
    // this.spawnFoal(h2.sprite.x + 60,  h2.sprite.y, 'foal3', h2); // bay foal → Clover
  }

  // ─── Other animals ───────────────────────────────────────────────────────

  buildAnimals() {
    // Other animals disabled for now — keep code, just uncomment to re-enable
    // this.spawnAnimal( 450,  680, 'cow',   0.80, 5, 16);
    // this.spawnAnimal( 900,  820, 'sheep', 0.65, 6, 14);
    // this.spawnAnimal(1300,  700, 'pig',   0.50, 7, 13);
    // this.spawnAnimal( 700,  570, 'dog',   0.44, 8, 10);
    // this.spawnAnimal(1100,  580, 'cat',   0.34, 7, 12);

    // Chicken flock — 5 birds, each with identity, name, and appearance
    const allChickens = this.registry.get('allChickens');
    const cx = 560, cy = 760;
    const offsets = [[-40,-20],[30,-30],[0,30],[-60,20],[50,10]];
    offsets.forEach(([ox, oy], i) => {
      const chickenModel = allChickens[`chicken${i}`];
      this.spawnAnimal(cx + ox, cy + oy, `chicken${i}`, 0.25, 8, 10, cx, cy, 180, 6, chickenModel);
    });

    this.time.addEvent({ delay: 2000, loop: true, callback: this.chickenTick, callbackScope: this });
  }

  // ─── Farm Stand ──────────────────────────────────────────────────────────

  buildFarmStand() {
    const sx = 1680, sy = 360;
    const sprite = this.add.image(sx, sy, 'farmStand')
      .setScale(S).setDepth(sy).setOrigin(0.5, 1);
    this.farmStand = { x: sx, y: sy, stock: 0, sprite };

    // Sign above stand showing stock
    this.farmStand.sign = this.add.text(sx, sy - 100, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#fffde0',
      backgroundColor: '#1c1f2ecc',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5, 1).setDepth(sy + 10).setVisible(false);

    // Obstacle: the solid table area (72*2=144 wide, ~22*2=44 tall, top-half of sprite)
    this.obstacles.push({ x: sx - 72, y: sy - 88, w: 144, h: 60, isFarmStand: true });

    this._updateStandSign();
  }

  _updateStandSign() {
    const s = this.farmStand;
    if (s.stock > 0) {
      s.sign.setText(`🥚 ×${s.stock}  for sale`);
      s.sign.setVisible(true);
    } else {
      s.sign.setVisible(false);
    }
  }

  doBasketAction() {
    const { player } = this;
    // Deposit at farm stand
    if (this.farmStand && this.basketEggs > 0) {
      const fd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, this.farmStand.x, this.farmStand.y
      );
      if (fd < 120) { this.stockStand(); return; }
    }
    // Collect egg from nearest nest
    for (const nest of this.props.nests) {
      if (!nest.hasEgg) continue;
      const nd = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, nest.x, nest.y);
      if (nd < 80) { this.collectEgg(nest); return; }
    }
  }

  stockStand() {
    if (this.basketEggs <= 0) return;
    const n = this.basketEggs;
    this.basketEggs = 0;
    this.farmStand.stock += n;
    this.game.events.emit('basket-changed', 0);
    this._updateStandSign();

    const icon = this.add.image(this.farmStand.x, this.farmStand.y - 60, 'iconEgg')
      .setScale(1.8).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // ─── NPC Customers ───────────────────────────────────────────────────────

  _scheduleNextCustomer() {
    const delay = Phaser.Math.Between(45_000, 90_000);
    this.time.delayedCall(delay, () => {
      if (!this.isNight) this._spawnCustomer();
      this._scheduleNextCustomer();
    });
  }

  _spawnCustomer() {
    if (!this.farmStand || this.farmStand.stock <= 0) {
      // No stock — NPC shows up but leaves disappointed
    }

    // Spawn from the right edge of the world
    const spawnX = WORLD_W - 20;
    const spawnY = Phaser.Math.Clamp(
      this.farmStand.y + Phaser.Math.Between(-80, 80),
      PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY
    );

    if (!this.anims.exists('npc_walk')) {
      this.anims.create({
        key: 'npc_walk',
        frames: [{ key: 'npc_walk_0' }, { key: 'npc_walk_1' }],
        frameRate: 7, repeat: -1,
      });
    }

    const shadow = this.add.image(spawnX, spawnY, 'shadow').setScale(S * 0.9).setDepth(spawnY - 1);
    const sprite = this.add.sprite(spawnX, spawnY, 'npc_walk_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(spawnY);

    const npc = { sprite, shadow, tween: null, state: 'arriving' };
    this.npcs.push(npc);

    // Walk to the stand
    const tx = this.farmStand.x + Phaser.Math.Between(-30, 30);
    const ty = this.farmStand.y + 20;
    const dist = Phaser.Math.Distance.Between(spawnX, spawnY, tx, ty);

    sprite.setFlipX(true); // walking left toward stand
    sprite.play('npc_walk', true);

    npc.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: (dist / (PLAYER_SPEED * 0.85)) * 1000,
      ease: 'Linear',
      onComplete: () => {
        npc.tween = null;
        sprite.stop();
        sprite.setTexture('npc_walk_0');
        this._npcShop(npc);
      },
    });
  }

  _npcShop(npc) {
    npc.state = 'shopping';
    const stand = this.farmStand;

    if (stand.stock <= 0) {
      // Nothing to buy — show sad bubble and leave
      this._npcSpeech(npc, ':(');
      this.time.delayedCall(1200, () => this._npcLeave(npc));
      return;
    }

    // Buy 1–3 eggs (up to what's in stock)
    const qty = Math.min(stand.stock, Phaser.Math.Between(1, 3));
    const price = qty * 5; // $5 per egg
    stand.stock -= qty;
    this.money += price;
    this._updateStandSign();
    this.game.events.emit('money-changed', this.money);

    this._npcSpeech(npc, `$${price}!`);

    // Floating coin feedback over the stand
    const coin = this.add.image(stand.x, stand.y - 50, 'iconCoin')
      .setScale(2).setDepth(10000);
    this.tweens.add({
      targets: coin, y: coin.y - 48, alpha: 0,
      duration: 1100, ease: 'Sine.easeOut',
      onComplete: () => coin.destroy(),
    });

    this.time.delayedCall(1500, () => this._npcLeave(npc));
  }

  _npcSpeech(npc, text) {
    const bubble = this.add.text(npc.sprite.x, npc.sprite.y - 60, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px', color: '#fffde0',
      backgroundColor: '#2a3050ee',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5, 1).setDepth(10001);
    this.tweens.add({
      targets: bubble, y: bubble.y - 24, alpha: 0,
      duration: 1400, ease: 'Sine.easeOut',
      onComplete: () => bubble.destroy(),
    });
  }

  _npcLeave(npc) {
    npc.state = 'leaving';
    const exitX = WORLD_W + 40;

    npc.sprite.setFlipX(false); // walking right off screen
    npc.sprite.play('npc_walk', true);

    const dist = Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, exitX, npc.sprite.y);
    npc.tween = this.tweens.add({
      targets: npc.sprite, x: exitX,
      duration: (dist / PLAYER_SPEED) * 1000,
      ease: 'Linear',
      onComplete: () => {
        npc.sprite.destroy();
        npc.shadow.destroy();
        this.npcs = this.npcs.filter(n => n !== npc);
      },
    });
  }

  spawnAnimal(startX, startY, key, shadowScale, walkFps, tweenRate, homeX, homeY, wanderRadius, eatFps, model = null) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1,
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` },
        ],
        frameRate: walkFps, repeat: -1,
      });
      if (eatFps) {
        this.anims.create({
          key: `eat_${key}`,
          frames: [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }],
          frameRate: eatFps, repeat: -1,
        });
      }
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S * shadowScale).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    const a = { sprite, shadow, key, state: 'idle', wanderTween: null, tweenRate,
                homeX: homeX ?? null, homeY: homeY ?? null, wanderRadius: wanderRadius ?? null,
                _eatPile: null, eatTimer: null, model };
    this.animals.push(a);
    this.scheduleAnimalWander(a, Phaser.Math.Between(500, 3000));
    return a;
  }

  scheduleAnimalWander(a, delay) {
    this.time.delayedCall(delay, () => {
      if (this.isNight || a.state !== 'idle') return;
      this.animalWander(a);
    });
  }

  animalWander(a) {
    if (!a.sprite.active || a.state !== 'idle') return;
    a.state = 'wandering';

    const obsList = this._obstaclesFor(a.key);
    let tx, ty;
    if (a.homeX !== null) {
      // Try up to 12 angles to find a clear spot within home radius
      let found = false;
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * a.wanderRadius;
        const cx = Phaser.Math.Clamp(a.homeX + Math.cos(angle) * r, BOUNDS.minX, BOUNDS.maxX);
        const cy = Phaser.Math.Clamp(a.homeY + Math.sin(angle) * r, BOUNDS.minY, BOUNDS.maxY);
        if (!this._collides(cx, cy, 18, obsList)) { tx = cx; ty = cy; found = true; break; }
      }
      if (!found) { tx = a.homeX; ty = a.homeY; }
    } else {
      const r = this._safeTarget(BOUNDS.minX, BOUNDS.maxX, BOUNDS.minY, BOUNDS.maxY,
                                  obsList, a.sprite.x, a.sprite.y);
      tx = r.tx; ty = r.ty;
    }
    const onArrive = () => {
      if (!a.sprite.active) return;
      a.wanderTween = null;
      a.sprite.play(`idle_${a.key}`, true);
      a.state = 'idle';
      this.scheduleAnimalWander(a, Phaser.Math.Between(4000, 10000));
    };

    // Wander targets are always in the farm area, so if this animal is currently
    // on the pasture side of the fence (e.g. a chicken that walked through the
    // open gate to peck at seed), route it back out through the gate opening.
    if (this._inPasture(a.sprite.x, a.sprite.y) !== this._inPasture(tx, ty)) {
      this._runPath(a, this._gatePath(a.sprite.x, a.sprite.y, tx, ty), onArrive);
      return;
    }

    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty);

    a.sprite.setFlipX(tx < a.sprite.x);
    a.sprite.play(`walk_${a.key}`, true);

    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: tx, y: ty,
      duration: Math.max(800, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: onArrive,
    });
  }

  chickenTick() {
    if (this.isNight) return;
    if (!this.props.seedPiles?.length) return;
    const gateOpen = !!this.props.gate?.open;
    for (const a of this.animals) {
      if (!a.key.startsWith('chicken')) continue;
      if (a.state !== 'idle' && a.state !== 'wandering') continue;
      let closest = null, closestDist = Infinity;
      for (const pile of this.props.seedPiles) {
        if (this.animals.some(o => o !== a && o._eatPile === pile)) continue; // 1 chicken per pile
        // Seed inside the pasture is only reachable when the gate is open
        if (this._inPasture(pile.x, pile.y) && !gateOpen) continue;
        const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, pile.x, pile.y);
        if (d < closestDist) { closestDist = d; closest = pile; }
      }
      if (closest && closestDist < 500) {
        this.chickenGoEat(a, closest);
      }
    }
  }

  chickenGoEat(a, pile) {
    a.state = 'eating';
    a._eatPile = pile;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }

    const facingRight = pile.x >= a.sprite.x;
    const tx = pile.x + (facingRight ? -16 : 16);
    const ty = pile.y;

    const startPecking = () => {
      if (a.state !== 'eating') return;
      a.wanderTween = null;
      a.sprite.play(`eat_${a.key}`, true); // pecking animation

      a.eatTimer = this.time.delayedCall(2200, () => {
        a.eatTimer = null;
        if (a.state !== 'eating') return;
        pile.sprite.destroy();
        this.props.seedPiles = this.props.seedPiles.filter(p => p !== pile);
        a._eatPile = null;
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(1000, 3000));
      });
    };

    // Route through the gate if the seed is on the far side of the pasture fence.
    this._runPath(a, this._gatePath(a.sprite.x, a.sprite.y, tx, ty), startPecking);
  }

  eggLayTick() {
    if (this.isNight) return;
    const freeNests = this.props.nests.filter(n => !n.hasEgg && !n.occupant);
    if (!freeNests.length) return;

    // Pick a random idle chicken
    const chickens = this.animals.filter(a => a.key.startsWith('chicken') && a.state === 'idle');
    if (!chickens.length) return;

    const chicken = Phaser.Utils.Array.GetRandom(chickens);
    const nest    = Phaser.Utils.Array.GetRandom(freeNests);
    this.chickenGoLay(chicken, nest);
  }

  chickenGoLay(a, nest) {
    a.state = 'laying';
    nest.occupant = a;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }

    a.sprite.setFlipX(nest.x < a.sprite.x);
    a.sprite.play(`walk_${a.key}`, true);

    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, nest.x, nest.y);
    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: nest.x, y: nest.y,
      duration: Math.max(400, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (a.state !== 'laying') { nest.occupant = null; return; }
        a.wanderTween = null;
        a.sprite.play(`idle_${a.key}`, true);

        // After a pause, lay the egg
        this.time.delayedCall(2800, () => {
          if (a.state !== 'laying') { nest.occupant = null; return; }
          nest.hasEgg = true;
          nest.occupant = null;
          nest.sprite.setTexture('nestEgg');
          a.state = 'idle';
          this.scheduleAnimalWander(a, Phaser.Math.Between(2000, 5000));
        });
      },
    });
  }

  collectEgg(nest) {
    if (!nest.hasEgg) return;
    const item = this.getActiveItem();
    if (item?.key !== 'basket') return;
    nest.hasEgg = false;
    nest.sprite.setTexture('nest');
    this.basketEggs++;
    this.game.events.emit('basket-changed', this.basketEggs);

    // Floating egg icon feedback
    const icon = this.add.image(nest.x, nest.y - 20, 'iconEgg')
      .setScale(1.5).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }


  spawnFoal(startX, startY, key, parentH) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` }
        ],
        frameRate: 8, repeat: -1
      });
      this.anims.create({
        key: `sleep_${key}`,
        frames: [{ key: `${key}_sleep_0` }, { key: `${key}_sleep_1` }],
        frameRate: 1, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S * 0.7).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    const foal = { sprite, shadow, key, parentH };
    this.foals.push(foal);
    return foal;
  }

  spawnHorse(startX, startY, key, wanderDelay) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` }
        ],
        frameRate: 6, repeat: -1
      });
      this.anims.create({
        key: `eat_${key}`,
        frames: [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `sleep_${key}`,
        frames: [{ key: `${key}_sleep_0` }, { key: `${key}_sleep_1` }],
        frameRate: 1, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    const h = { sprite, shadow, key, state: 'idle', wanderTween: null, eatTimer: null };
    this.horses.push(h);
    this.scheduleWander(h, wanderDelay);
    return h;
  }

  scheduleWander(h, delay) {
    this.time.delayedCall(delay, () => {
      if (this.isNight || h.state !== 'idle') return;
      if (!this.horseTickForHorse(h)) this.wander(h);
    });
  }

  wander(h) {
    if (!h.sprite.active || h.state !== 'idle') return;
    h.state = 'wandering';
    // Horses wander in the pasture, other animals in the farm area
    const isHorse = this.horses.includes(h);
    const bounds = isHorse ? PASTURE_BOUNDS : BOUNDS;
    const { tx, ty } = this._safeTarget(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY,
                                         this._obstaclesFor(h.key), h.sprite.x, h.sprite.y);

    const onArrive = () => {
      if (!h.sprite.active) return;
      h.wanderTween = null;
      h.sprite.play(`idle_${h.key}`, true);
      h.state = 'idle';
      this.scheduleWander(h, Phaser.Math.Between(2000, 5000));
    };

    // Route through the gate if the horse is wandering back across the fence
    // (e.g. it walked out to eat hay and now heads back into the pasture).
    if (isHorse) {
      this._runPath(h, this._gatePath(h.sprite.x, h.sprite.y, tx, ty), onArrive);
      return;
    }

    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);
    h.sprite.setFlipX(tx < h.sprite.x);
    h.sprite.play(`walk_${h.key}`, true);
    h.wanderTween = this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(600, dist * 11),
      ease: 'Sine.easeInOut',
      onComplete: onArrive,
    });
  }

  // ─── Day / Night ─────────────────────────────────────────────────────────

  onPhaseChange({ isNight }) {
    if (isNight && !this.isNight) {
      this.isNight = true;
      this.restAllAnimals();
    } else if (!isNight && this.isNight) {
      this.isNight = false;
      this.wakeAllAnimals();
    }
  }

  restAllAnimals() {
    const stopOne = (a) => {
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
      if (a.eatTimer)    { a.eatTimer.remove?.() ?? this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
      a._eatPile = null;
      a.state = 'resting';
      a.sprite.play(`idle_${a.key}`, true);
      // Schedule random lay-down moments while sleeping
      this._scheduleLayDown(a);
    };
    for (const h of this.horses) stopOne(h);
    for (const a of this.animals) {
      if (a.key.startsWith('chicken')) this.chickenRoost(a);
      else stopOne(a);
    }
    // Send any visiting NPCs away at night
    for (const npc of [...this.npcs]) {
      if (npc.tween) { npc.tween.stop(); npc.tween = null; }
      this._npcLeave(npc);
    }
  }

  _scheduleLayDown(a) {
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    if (a.state !== 'resting') return;

    const delay = Phaser.Math.Between(8000, 16000);
    a._sleepTimer = this.time.delayedCall(delay, () => {
      if (a.state !== 'resting') return;
      a._sleepTimer = null;

      if (Math.random() < 0.5) {
        a.sprite.play(`sleep_${a.key}`, true);
        const layDownTime = Phaser.Math.Between(3000, 7000);
        this.time.delayedCall(layDownTime, () => {
          if (a.state === 'resting') {
            a.sprite.play(`idle_${a.key}`, true);
          }
        });
      }
      this._scheduleLayDown(a);
    });
  }

  wakeAllAnimals() {
    for (const h of this.horses) {
      if (h._sleepTimer) { this.time.removeEvent(h._sleepTimer); h._sleepTimer = null; }
      if (h.state === 'resting') { h.state = 'idle'; this.scheduleWander(h, Phaser.Math.Between(500, 3000)); }
    }
    for (const a of this.animals) {
      if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
      if (a.key.startsWith('chicken')) {
        if (a.state === 'roosting') this.chickenLeaveCoop(a);
      } else if (a.state === 'resting') {
        a.state = 'idle'; this.scheduleAnimalWander(a, Phaser.Math.Between(500, 3000));
      }
    }
  }

  // Nightfall: walk a chicken to the coop ramp, then up into the pop-door,
  // fading out of view (depth-sorting also tucks it behind the coop body).
  chickenRoost(a) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    if (a.eatTimer)    { a.eatTimer.remove?.() ?? this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    a._eatPile = null;
    a.state = 'roosting';
    for (const n of this.props.nests) if (n.occupant === a) n.occupant = null;

    const coop = this.props.coop;
    a.sprite.setFlipX(coop.rampX < a.sprite.x);
    a.sprite.play(`walk_${a.key}`, true);

    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, coop.rampX, coop.rampY);
    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: coop.rampX, y: coop.rampY,
      duration: Math.max(500, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        a.wanderTween = null;
        if (a.state !== 'roosting' || !a.sprite.active) return;
        a.sprite.setFlipX(false);
        a.shadow.setVisible(false);
        a.wanderTween = this.tweens.add({
          targets: a.sprite, x: coop.doorX, y: coop.doorY, alpha: 0,
          duration: 600, ease: 'Sine.easeIn',
          onComplete: () => {
            a.wanderTween = null;
            if (a.state === 'roosting') a.sprite.setVisible(false);
          },
        });
      },
    });
  }

  // Morning: chicken reappears at the pop-door and hops down the ramp to resume.
  chickenLeaveCoop(a) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    const coop = this.props.coop;
    a.state = 'leaving';
    a.sprite.setPosition(coop.doorX, coop.doorY).setAlpha(0).setVisible(true);
    a.shadow.setPosition(coop.doorX, coop.doorY).setVisible(true);
    a.sprite.setFlipX(true);
    a.sprite.play(`walk_${a.key}`, true);

    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: coop.rampX, y: coop.rampY, alpha: 1,
      duration: 600, ease: 'Sine.easeOut',
      onComplete: () => {
        a.wanderTween = null;
        if (!a.sprite.active) return;
        a.sprite.setAlpha(1);
        if (this.isNight) { this.chickenRoost(a); return; }
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(300, 2500));
      },
    });
  }

  _scheduleBirds() {
    const delay = Phaser.Math.Between(4000, 12000);
    this.time.delayedCall(delay, () => {
      if (!this.isNight) playBirdChirp();
      this._scheduleBirds();
    });
  }

  // ─── Horse AI — eat / drink ───────────────────────────────────────────────

  horseTick() {
    if (this.isNight) return;
    for (const h of this.horses) {
      if (h.state === 'idle' || h.state === 'wandering') this.horseTickForHorse(h);
    }
  }

  // True if (x, y) is within the gated pasture — horses can only reach food here.
  _inPasture(x, y) {
    const pb = PASTURE_BOUNDS;
    return x >= pb.minX && x <= pb.maxX && y >= pb.minY && y <= pb.maxY;
  }

  // Returns true if horse was directed somewhere; false if it should wander normally.
  horseTickForHorse(h) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[h.key];
    if (!horseData) return false;

    if (horseData.stats.hunger < 95 && this.props.hayPiles.length > 0) {
      const gateOpen = !!this.props.gate?.open;
      let closest = null, closestDist = Infinity;
      for (const pile of this.props.hayPiles) {
        // Hay outside the fence is only reachable when the gate is open
        if (!this._inPasture(pile.x, pile.y) && !gateOpen) continue;
        const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y);
        if (d < closestDist) { closestDist = d; closest = pile; }
      }
      if (closest && closestDist < 700) {
        this.horseGoEat(h, closest);
        return true;
      }
    }

    if (horseData.stats.thirst < 95 && this.props.trough?.filled &&
        this._inPasture(this.props.trough.x, this.props.trough.y)) {
      const td = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.props.trough.x, this.props.trough.y);
      if (td < 1000) {
        this.horseGoDrink(h);
        return true;
      }
    }

    return false;
  }

  // Waypoints from (fromX,fromY) to (tx,ty). If the path crosses the pasture
  // fence, it's routed through the gate opening so movers never clip the fence.
  _gatePath(fromX, fromY, tx, ty) {
    const insideFrom = this._inPasture(fromX, fromY);
    const insideTo   = this._inPasture(tx, ty);
    if (insideFrom === insideTo) return [{ x: tx, y: ty }];

    const gateLine = PASTURE_BOUNDS.minY;        // top fence line
    const inPoint  = { x: GATE_X, y: gateLine + 24 };  // just inside the gate
    const outPoint = { x: GATE_X, y: gateLine - 24 };  // just outside the gate
    return insideFrom
      ? [inPoint, outPoint, { x: tx, y: ty }]    // leaving the pasture
      : [outPoint, inPoint, { x: tx, y: ty }];   // entering the pasture
  }

  // Move any creature (horse or animal) along a list of waypoints with walk
  // tweens, then call onArrive. tweenRate defaults to the horse pace (10).
  // If a leg would carry the creature across the fence line while the gate is
  // shut, the trip is abandoned and the creature settles on its home side — so
  // nobody ever walks through a closed gate (e.g. it's shut mid-crossing).
  _runPath(a, points, onArrive) {
    const rate = a.tweenRate ?? 10;
    const line = PASTURE_BOUNDS.minY;
    const step = (i) => {
      if (!a.sprite.active) return;
      if (i >= points.length) { a.wanderTween = null; onArrive?.(); return; }
      const { x: tx, y: ty } = points[i];
      if ((a.sprite.y - line) * (ty - line) < 0 && !this.props.gate?.open) {
        a.wanderTween = null;
        this._settleAtGate(a);
        return;
      }
      const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty);
      a.sprite.setFlipX(tx < a.sprite.x);
      a.sprite.play(`walk_${a.key}`, true);
      a.wanderTween = this.tweens.add({
        targets: a.sprite, x: tx, y: ty,
        duration: Math.max(300, dist * rate),
        ease: 'Sine.easeInOut',
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  // Place a creature just clear of the gate on its home side (horses inside the
  // pasture, other animals in the farm) and return it to normal life. Used when
  // the gate shuts on a mover that was crossing or about to cross.
  _settleAtGate(a) {
    const isHorse = this.horses.includes(a);
    const line = PASTURE_BOUNDS.minY;
    a.sprite.x = Phaser.Math.Clamp(a.sprite.x, GATE_GAP_X0 + 12, GATE_GAP_X1 - 12);
    a.sprite.y = isHorse ? line + 30 : line - 30;
    a.shadow.setPosition(a.sprite.x, a.sprite.y).setDepth(a.sprite.y - 1);
    a.sprite.setDepth(a.sprite.y).play(`idle_${a.key}`, true);
    if (a.eatTimer) { this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    a._eatPile = null;
    a.state = 'idle';
    if (isHorse) this.scheduleWander(a, Phaser.Math.Between(800, 2000));
    else         this.scheduleAnimalWander(a, Phaser.Math.Between(800, 2000));
  }

  horseGoEat(h, pile) {
    // Only one horse per hay pile
    const alreadyEating = this.horses.some(o => o !== h && o.state === 'eating' && o._eatPile === pile);
    if (alreadyEating) return;

    h.state = 'eating';
    h._eatPile = pile;
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }

    const facingRight = pile.x >= h.sprite.x;
    const tx = pile.x + (facingRight ? -50 : 50);
    const ty = pile.y;

    // Route through the gate if the hay is on the far side of the fence
    const path = this._gatePath(h.sprite.x, h.sprite.y, tx, ty);

    this._runPath(h, path, () => {
      if (h.state !== 'eating') return;
      h.sprite.setFlipX(!facingRight);
      h.sprite.play(`eat_${h.key}`, true);

      playEat();
      h.eatTimer = this.time.delayedCall(1800, () => {
        h.eatTimer = null;
        if (h.state !== 'eating') return;
        const allHorses = this.registry.get('allHorses');
        allHorses[h.key]?.feed();
        this.game.events.emit('stats-changed');
        pile.sprite.destroy();
        this.props.hayPiles = this.props.hayPiles.filter(p => p !== pile);
        h._eatPile = null;
        h.sprite.play(`idle_${h.key}`, true);
        h.state = 'idle';
        this.scheduleWander(h, 1500);
      });
    });
  }

  horseGoDrink(h) {
    const trough = this.props.trough;
    // Limit to 2 horses at the trough at once
    const atTrough = this.horses.filter(o => o !== h && o.state === 'drinking').length;
    if (atTrough >= 2) return;

    h.state = 'drinking';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }

    // Spread horses along the trough length so they don't stack
    const slot = atTrough; // 0 or 1
    const facingRight = trough.x >= h.sprite.x;
    const spread = (slot === 0 ? -30 : 30);
    const tx = trough.x + spread + (facingRight ? -70 : 70);
    const ty = trough.y;

    // Route through the gate if the horse is currently outside the pasture
    const path = this._gatePath(h.sprite.x, h.sprite.y, tx, ty);

    this._runPath(h, path, () => {
        if (h.state !== 'drinking') return;
        if (!trough.filled) { h.state = 'idle'; this.scheduleWander(h, 500); return; }
        h.sprite.setFlipX(!facingRight);
        h.sprite.play(`eat_${h.key}`, true);

        playDrink();
        let drinksDone = 0;
        h.eatTimer = this.time.addEvent({
          delay: 2500, repeat: 1,
          callback: () => {
            if (h.state !== 'drinking') { if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; } return; }
            playDrink();
            const allHorses = this.registry.get('allHorses');
            allHorses[h.key]?.water();
            this.game.events.emit('stats-changed');
            drinksDone++;
            trough.drinks = Math.max(0, (trough.drinks ?? 3) - 1);
            if (trough.drinks <= 0) {
              trough.filled = false;
              trough.sprite.setTexture('trough');
            }
            if (drinksDone >= 1) {
              if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
              h.sprite.play(`idle_${h.key}`, true);
              h.state = 'idle';
              this.scheduleWander(h, 1500);
            }
          }
        });
    });
  }

  // ─── Player ──────────────────────────────────────────────────────────────

  buildPlayer() {
    const makeAnim = (key, frames, rate) => {
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames, frameRate: rate, repeat: -1 });
      }
    };
    makeAnim('player_walk_down', [
      { key: 'player_down_0' }, { key: 'player_down_1' },
      { key: 'player_down_2' }, { key: 'player_down_3' },
    ], 8);
    makeAnim('player_walk_up', [
      { key: 'player_up_0' }, { key: 'player_up_1' },
      { key: 'player_up_2' }, { key: 'player_up_3' },
    ], 8);
    makeAnim('player_walk_side', [
      { key: 'player_side_0' }, { key: 'player_side_1' },
      { key: 'player_side_2' }, { key: 'player_side_3' },
    ], 8);

    const startX = WORLD_W / 2;
    const startY = WORLD_H / 2 + 60;

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, 'player_down_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(startY);

    this.player    = { sprite, shadow, facing: 'down', moving: false };
    // Tap-to-move walks the player along navPath, sliding against obstacles each
    // frame (so the gate/fence can't be walked through). navOnArrive fires once
    // the last waypoint is reached.
    this.navPath     = null;
    this.navOnArrive = null;
    this._navStuck   = 0;

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(sprite, true, 0.12, 0.12);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.on('pointerdown', this.handleTap, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    // Hold-to-move state: while the pointer is held, movement keeps re-targeting
    // the live pointer position so you steer continuously instead of re-tapping.
    this._pointerDown    = false;
    this._holdMove       = false;
    this._holdTarget     = null;
    this._holdPathTarget = null;
    this._holdDownAt     = 0;
    this._holdMoved      = false;
    this._holdRepathAt   = 0;

    this.gamePad      = null;
    this.usingPad     = false;
    this.padAJustDown = false;
    this._prevRawButtons = {};
    this._paused = false;
    this._pauseOverlay = null;

    this.input.gamepad.on('connected', pad => { this.gamePad = pad; });
    if (this.input.gamepad.total > 0) this.gamePad = this.input.gamepad.getPad(0);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', color: '#ffffff',
      backgroundColor: '#1c1f2ecc',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5, 1).setDepth(9999).setVisible(false);

    // Lead rope drawn each frame when leading a horse
    this.leadRope = this.add.graphics().setDepth(9998);

  }

  handleTap(pointer) {
    if (this.scene.isActive('PortraitScene')) return;
    if (this.scene.isActive('ChickenInfoScene')) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    if (pointer.button !== 0) return;

    // Ignore taps in the badge area at the bottom of the canvas
    if (pointer.y > this.scale.height - 72) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Track the press so hold-to-move and tap-vs-hold release can be detected.
    this._pointerDown = true;
    this._holdDownAt  = this.time.now;
    this._holdMoved   = false;
    this._holdMove    = false;

    // While mounted: tapping on the horse dismounts; tapping elsewhere steers it
    // there (and holding keeps it heading toward your finger).
    if (this.riding) {
      const hs = this.riding.h.sprite;
      if (Phaser.Math.Distance.Between(world.x, world.y, hs.x, hs.y) < 64) {
        this.dismount();
        return;
      }
      this._startHold(world.x, world.y);
      return;
    }

    const item  = this.getActiveItem();

    // Horse tap
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(world.x, world.y, h.sprite.x, h.sprite.y);
      if (d < 80) {
        const tx = h.sprite.x + (world.x < h.sprite.x ? -70 : 70);
        this.tapMoveTo(tx, h.sprite.y, () => {
          const cur = this.getActiveItem();
          if (cur?.action === 'ride')      { this.mountHorse(h); return; }
          if (cur?.action === 'lead')      { this.toggleLead(h); return; }
          if (cur?.action === 'interact')  { this.openPortrait(h.key); return; }
          if (cur?.action === 'feed')      { this.placeFood(cur); return; }
          // Water and seeds aren't used directly on horses — just open the portrait.
          if (cur && cur.action !== 'seed' && cur.action !== 'water') { this.useItemOnHorse(cur, h); return; }
          this.openPortrait(h.key);
        });
        return;
      }
    }

    // Animal (chicken) tap
    for (const a of this.animals) {
      if (!a.sprite.visible) continue; // tucked inside the coop at night
      const d = Phaser.Math.Distance.Between(world.x, world.y, a.sprite.x, a.sprite.y);
      if (d < 60) {
        const tx = a.sprite.x + (world.x < a.sprite.x ? -40 : 40);
        this.tapMoveTo(tx, a.sprite.y, () => {
          this.openChickenInfo(a.key);
        });
        return;
      }
    }

    // Gate tap — walk to the gate, then toggle it open/closed
    const gate = this.props.gate;
    if (gate) {
      const gd = Phaser.Math.Distance.Between(world.x, world.y, gate.x, gate.y);
      if (gd < 90) {
        const side = this.player.sprite.y < gate.y ? -1 : 1;
        this.tapMoveTo(gate.x, gate.y + side * 70, () => this.toggleGate());
        return;
      }
    }

    // Basket tap — walk to a nest and collect its egg, or to the farm stand to
    // deposit. The nest is an obstacle, so aim for a reachable spot just south of
    // it; _stepNav fires the callback once the player is wedged up against it.
    if (item?.key === 'basket') {
      let bestNest = null, bestNd = 100;
      for (const nest of this.props.nests) {
        if (!nest.hasEgg) continue;
        const nd = Phaser.Math.Distance.Between(world.x, world.y, nest.x, nest.y);
        if (nd < bestNd) { bestNd = nd; bestNest = nest; }
      }
      if (bestNest) {
        this.tapMoveTo(bestNest.x, bestNest.y + 45, () => this.collectEgg(bestNest));
        return;
      }
      const stand = this.farmStand;
      if (stand && this.basketEggs > 0) {
        const sd = Phaser.Math.Distance.Between(world.x, world.y, stand.x, stand.y);
        if (sd < 160) {
          const side = world.x < stand.x ? -1 : 1;
          this.tapMoveTo(stand.x + side * 90, stand.y + 20, () => this.stockStand());
          return;
        }
      }
    }

    // Trough tap with bucket — walk to trough then fill
    const trough = this.props.trough;
    if (trough && item?.key === 'bucket' && !trough.filled) {
      const td = Phaser.Math.Distance.Between(world.x, world.y, trough.x, trough.y);
      if (td < 220) {
        const side = world.x < trough.x ? 1 : -1;
        this.tapMoveTo(trough.x + side * 110, trough.y, () => this.fillTrough());
        return;
      }
    }

    // Walk and drop food at destination (hay, apple, carrot, seeds — all the same)
    if (item?.action === 'feed' || item?.action === 'seed') {
      this.tapMoveTo(world.x, world.y, () => this.placeFood(item));
      return;
    }

    // Plain locomotion — start a hold-capable move toward the point.
    this._startHold(world.x, world.y);
  }

  // Begin (or re-aim) a hold-to-move trip toward (x,y). Works mounted or on foot.
  _startHold(x, y) {
    this._holdMove       = true;
    this._holdTarget     = { x, y };
    this._holdPathTarget = { x, y };
    this._holdRepathAt   = this.time.now;
    this._moveToward(x, y);
  }

  _moveToward(x, y) {
    if (this.riding) this._rideMoveTo(x, y);
    else             this.tapMoveTo(x, y);
  }

  handlePointerMove(pointer) {
    if (!this._pointerDown || !this._holdMove) return;
    if (!pointer.isDown) return;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this._holdTarget = { x: w.x, y: w.y };
    this._holdMoved  = true;
  }

  handlePointerUp() {
    if (this._holdMove) {
      // A real hold (long press or dragged) stops on release. A quick tap keeps
      // its route so you still walk all the way to where you tapped.
      const held = this.time.now - this._holdDownAt;
      if (held > 200 || this._holdMoved) {
        if (this.riding) this._cancelRideNav();
        else             this._cancelTapMove();
      }
    }
    this._pointerDown = false;
    this._holdMove    = false;
    this._holdTarget  = null;
  }

  // While the pointer is held, keep the active route pointed at the live finger
  // position — re-pathing only when it drifts a cell or the route runs out, and
  // throttled so the A* search doesn't run every frame.
  _updateHold() {
    if (!this._pointerDown || !this._holdMove || !this._holdTarget) return;
    const now = this.time.now;
    if (now - this._holdRepathAt < 100) return;

    const t = this._holdTarget;
    const drifted = !this._holdPathTarget ||
      Phaser.Math.Distance.Between(t.x, t.y, this._holdPathTarget.x, this._holdPathTarget.y) > 24;
    const routeEmpty = this.riding ? !this.rideNav : !this.navPath;
    if (drifted || routeEmpty) {
      this._holdRepathAt   = now;
      this._holdPathTarget = { x: t.x, y: t.y };
      this._moveToward(t.x, t.y);
    }
  }

  tapMoveTo(tx, ty, onArrive) {
    this._cancelTapMove();

    const { sprite } = this.player;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    if (Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty) < 8) {
      onArrive?.();
      return;
    }

    // Find a route that steers around obstacles (the trough, fences, nests…) and
    // through the gate opening when it's open. If nothing connects (e.g. the gate
    // is shut and the target is on the far side), head straight and let _stepNav's
    // collision stop us where we can't proceed.
    const path = this._findPath(sprite.x, sprite.y, tx, ty);
    this.navPath     = (path && path.length) ? path : [{ x: tx, y: ty }];
    this.navDest     = { x: tx, y: ty };
    this.navOnArrive = onArrive ?? null;
    this._navStuck = 0;
  }

  // True if a straight segment from (x0,y0) to (x1,y1) stays clear of obstacles
  // for a body of radius R, sampled densely enough to not skip thin walls.
  _clearLine(x0, y0, x1, y1, R) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this._collides(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R)) return false;
    }
    return true;
  }

  // Grid A* across the walkable area, returning a smoothed list of world-space
  // waypoints from just after (fromX,fromY) to (toX,toY), or null if unreachable.
  // Used by tap-to-move so the player walks around obstacles instead of into them.
  _findPath(fromX, fromY, toX, toY) {
    const R = 16; // clearance — a touch more than the player's collision radius
    // Straight shot? Skip the grid search entirely.
    if (this._clearLine(fromX, fromY, toX, toY, R)) return [{ x: toX, y: toY }];

    const CELL = 24;
    const { minX, maxX, minY, maxY } = PLAYER_BOUNDS;
    const cols = Math.floor((maxX - minX) / CELL) + 1;
    const rows = Math.floor((maxY - minY) / CELL) + 1;
    const N = cols * rows;
    const wx = c => minX + c * CELL;
    const wy = r => minY + r * CELL;
    const toC = x => Phaser.Math.Clamp(Math.round((x - minX) / CELL), 0, cols - 1);
    const toR = y => Phaser.Math.Clamp(Math.round((y - minY) / CELL), 0, rows - 1);

    const blocked = new Uint8Array(N);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        blocked[r * cols + c] = this._collides(wx(c), wy(r), R) ? 1 : 0;

    const startC = toC(fromX), startR = toR(fromY);
    let goalC = toC(toX), goalR = toR(toY);

    // Snap a blocked goal (e.g. tapping the trough itself) to the nearest free cell.
    if (blocked[goalR * cols + goalC]) {
      let best = -1, bestD = Infinity;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (blocked[r * cols + c]) continue;
          const d = (c - goalC) ** 2 + (r - goalR) ** 2;
          if (d < bestD) { bestD = d; best = r * cols + c; }
        }
      if (best < 0) return null;
      goalC = best % cols; goalR = Math.floor(best / cols);
    }
    const startIdx = startR * cols + startC;
    const goalIdx  = goalR * cols + goalC;
    blocked[startIdx] = 0; // never trap the search at the player's own cell

    const g = new Float64Array(N).fill(Infinity);
    const f = new Float64Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const h = (c, r) => {
      const dc = Math.abs(c - goalC), dr = Math.abs(r - goalR);
      return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr); // octile
    };
    g[startIdx] = 0;
    f[startIdx] = h(startC, startR);
    const open = new Set([startIdx]);
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    let found = false;
    while (open.size) {
      let cur = -1, curF = Infinity;
      for (const idx of open) if (f[idx] < curF) { curF = f[idx]; cur = idx; }
      if (cur === goalIdx) { found = true; break; }
      open.delete(cur);
      const cc = cur % cols, cr = (cur - cc) / cols;
      for (const [dc, dr] of DIRS) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const nidx = nr * cols + nc;
        if (blocked[nidx]) continue;
        // Don't cut across an obstacle corner on diagonal moves.
        if (dc !== 0 && dr !== 0 && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
        const ng = g[cur] + ((dc !== 0 && dr !== 0) ? Math.SQRT2 : 1);
        if (ng < g[nidx]) {
          g[nidx] = ng;
          came[nidx] = cur;
          f[nidx] = ng + h(nc, nr);
          open.add(nidx);
        }
      }
    }
    if (!found) return null;

    // Reconstruct, then string-pull: keep only waypoints we can't see past.
    const cells = [];
    for (let i = goalIdx; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map(i => ({ x: wx(i % cols), y: wy(Math.floor(i / cols)) }));
    pts[0] = { x: fromX, y: fromY };
    const last = pts[pts.length - 1];
    if (this._clearLine(last.x, last.y, toX, toY, R)) pts.push({ x: toX, y: toY });

    const smooth = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      const tail = smooth[smooth.length - 1];
      while (j > i + 1 && !this._clearLine(tail.x, tail.y, pts[j].x, pts[j].y, R)) j--;
      smooth.push(pts[j]);
      i = j;
    }
    smooth.shift(); // drop the player's current position
    return smooth.length ? smooth : [{ x: toX, y: toY }];
  }

  // Stop any in-progress tap-to-move and drop its arrival callback.
  _cancelTapMove() {
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    this._navStuck = 0;
  }

  // Drop the player onto an idle frame matching their current facing.
  _stopWalkAnim() {
    const player = this.player;
    if (!player.moving) return;
    const idleKey = player.facing === 'up'  ? 'player_up_0' :
                    player.facing === 'down' ? 'player_down_0' : 'player_side_0';
    player.sprite.setFlipX(player.facing === 'left');
    player.sprite.stop();
    player.sprite.setTexture(idleKey);
    player.moving = false;
  }

  // Advance the player one frame along navPath, sliding against obstacles like
  // keyboard movement. Reaching the last waypoint fires navOnArrive; getting
  // wedged (e.g. against a closed gate) abandons the trip.
  _stepNav(delta) {
    const { player } = this;
    const sprite = player.sprite;

    let wp = this.navPath[0];
    while (wp && Phaser.Math.Distance.Between(sprite.x, sprite.y, wp.x, wp.y) < 8) {
      this.navPath.shift();
      wp = this.navPath[0];
    }
    if (!wp) { this._stopWalkAnim(); this._finishNav(); return; }

    const dx = wp.x - sprite.x, dy = wp.y - sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = PLAYER_SPEED * (delta / 1000);
    const nx = Phaser.Math.Clamp(sprite.x + (dx / dist) * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(sprite.y + (dy / dist) * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const beforeX = sprite.x, beforeY = sprite.y;
    if (!this._collides(nx, sprite.y)) sprite.x = nx;
    if (!this._collides(sprite.x, ny)) sprite.y = ny;

    // If barely any progress was made, we're wedged against an obstacle — bail
    // after a short grace period rather than scrubbing in place forever. If we
    // wedged right next to the destination (e.g. the trough or a nest, which are
    // themselves obstacles), treat it as an arrival so the interaction still fires.
    if (Math.hypot(sprite.x - beforeX, sprite.y - beforeY) < step * 0.25) {
      this._navStuck += delta;
      if (this._navStuck > 350) {
        this._stopWalkAnim();
        const dest = this.navDest;
        if (dest && Phaser.Math.Distance.Between(sprite.x, sprite.y, dest.x, dest.y) < 60) {
          this._finishNav();
        } else {
          this._cancelTapMove();
        }
        return;
      }
    } else {
      this._navStuck = 0;
    }

    const newFacing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    if (!player.moving || newFacing !== player.facing) {
      player.facing = newFacing;
      const animKey = newFacing === 'up' ? 'player_walk_up' :
                      newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
      sprite.setFlipX(newFacing === 'left');
      sprite.play(animKey, true);
    }
    player.moving = true;
  }

  _finishNav() {
    const cb = this.navOnArrive;
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    cb?.();
  }

  getActiveItem() {
    return this.scene.get('HotbarScene')?.getActiveItem() ?? null;
  }

  // ─── Riding ──────────────────────────────────────────────────────────────

  mountHorse(h) {
    if (this.riding) this.dismount();
    if (this.leadHorses.includes(h)) this.stopLeadingHorse(h);

    // Interrupt any current behavior
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    h.state = 'riding';

    const saddleImg = this.add.image(h.sprite.x, h.sprite.y, 'saddleOverlay')
      .setScale(S).setOrigin(0.5, 1).setDepth(h.sprite.depth + 1)
      .setFlipX(h.sprite.flipX);

    // Freeze player on side-view idle frame so they appear to sit
    this.player.sprite.stop();
    this.player.sprite.setTexture('player_side_0');
    this.player.shadow.setVisible(false);
    this._cancelTapMove();
    this.player.moving = false;

    this._cancelRideNav();
    this.riding = { h, saddleImg };
    this.cameras.main.startFollow(h.sprite, true, 0.12, 0.12);
  }

  dismount() {
    if (!this.riding) return;
    const { h, saddleImg } = this.riding;
    saddleImg.destroy();

    // Place player next to horse, restore shadow
    const offset = h.sprite.flipX ? 80 : -80;
    this.player.sprite.x = Phaser.Math.Clamp(h.sprite.x + offset, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    this.player.sprite.y = h.sprite.y;
    this.player.sprite.setDepth(this.player.sprite.y);
    this.player.shadow.setVisible(true);

    h.state = 'idle';
    this.riding = null;
    this._cancelRideNav();
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.scheduleWander(h, 2000);
  }

  updateRiding(delta) {
    if (!this.riding) return;
    const { h, saddleImg } = this.riding;
    const { cursors, wasd } = this;

    let vx = 0, vy = 0;
    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;
    const pad = this.gamePad;
    if (pad) {
      if (Math.abs(pad.leftStick.x) > 0.15) vx += pad.leftStick.x;
      if (Math.abs(pad.leftStick.y) > 0.15) vy += pad.leftStick.y;
      if (pad.left  > 0.5) vx -= 1;
      if (pad.right > 0.5) vx += 1;
      if (pad.up    > 0.5) vy -= 1;
      if (pad.down  > 0.5) vy += 1;
    }
    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    const manual = vx !== 0 || vy !== 0;
    if (manual) this._cancelRideNav();

    const step = RIDE_SPEED * (delta / 1000);
    let moving = false;
    if (manual) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      moving = this._moveHorseBy(h, vx * step, vy * step);
      if (vx !== 0) h.sprite.setFlipX(vx < 0);
    } else if (this.rideNav) {
      moving = this._stepRideNav(delta);
    }

    h.sprite.play(moving ? `walk_${h.key}` : `idle_${h.key}`, true);

    saddleImg.x = h.sprite.x;
    saddleImg.y = h.sprite.y;
    saddleImg.setFlipX(h.sprite.flipX);
    saddleImg.setDepth(h.sprite.depth + 1);

    // Position rider on horse's back (saddle is ~55px above horse feet at scale 2)
    const riderXOff = h.sprite.flipX ? 10 : -10;
    this.player.sprite.x = h.sprite.x + riderXOff;
    this.player.sprite.y = h.sprite.y - 55;
    this.player.sprite.setFlipX(h.sprite.flipX);
    this.player.sprite.setDepth(h.sprite.depth + 2);

    // Keep player shadow hidden under horse
    this.player.shadow.x = h.sprite.x;
    this.player.shadow.y = h.sprite.y;

    // E or A → dismount
    if (Phaser.Input.Keyboard.JustDown(this.eKey) || this.padAJustDown) {
      this.padAJustDown = false;
      this.dismount();
    }
  }

  // Slide the ridden horse by (dx,dy), blocked by fences/gate and clamped to the
  // walkable world. Axis-separated so it slides along walls. Returns true if it
  // actually moved.
  _moveHorseBy(h, dx, dy) {
    const r = 16, s = h.sprite;
    const bx = s.x, by = s.y;
    const nx = Phaser.Math.Clamp(s.x + dx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(s.y + dy, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    if (!this._collides(nx, s.y, r)) s.x = nx;
    if (!this._collides(s.x, ny, r)) s.y = ny;
    return Math.hypot(s.x - bx, s.y - by) > 0.5;
  }

  // Tap-to-ride: route the mounted horse to (tx,ty) around obstacles.
  _rideMoveTo(tx, ty) {
    const s = this.riding.h.sprite;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    const path = this._findPath(s.x, s.y, tx, ty);
    this.rideNav = (path && path.length) ? path : [{ x: tx, y: ty }];
    this._rideStuck = 0;
  }

  _cancelRideNav() { this.rideNav = null; this._rideStuck = 0; }

  // Advance the ridden horse one frame along rideNav; abandons if wedged.
  _stepRideNav(delta) {
    const s = this.riding.h.sprite;
    let wp = this.rideNav[0];
    while (wp && Phaser.Math.Distance.Between(s.x, s.y, wp.x, wp.y) < 10) {
      this.rideNav.shift();
      wp = this.rideNav[0];
    }
    if (!wp) { this._cancelRideNav(); return false; }

    const dx = wp.x - s.x, dy = wp.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = RIDE_SPEED * (delta / 1000);
    const moved = this._moveHorseBy(this.riding.h, (dx / dist) * step, (dy / dist) * step);
    if (Math.abs(dx) > 1) s.setFlipX(dx < 0);

    if (!moved) {
      this._rideStuck += delta;
      if (this._rideStuck > 350) { this._cancelRideNav(); return false; }
    } else {
      this._rideStuck = 0;
    }
    return moved;
  }

  // ─── Leading ─────────────────────────────────────────────────────────────

  toggleLead(h) {
    // Toggle this horse off if already led
    if (this.leadHorses.includes(h)) { this.stopLeadingHorse(h); return; }

    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    h.state = 'led';
    this.leadHorses.push(h);
  }

  stopLeadingHorse(h) {
    const i = this.leadHorses.indexOf(h);
    if (i === -1) return;
    this.leadHorses.splice(i, 1);
    h.state = 'idle';
    this.scheduleWander(h, 1500);
    if (this.leadHorses.length === 0) this.leadRope.clear();
  }

  stopLeading() {
    // Release every led horse
    for (const h of [...this.leadHorses]) this.stopLeadingHorse(h);
  }

  updateLeading(delta) {
    if (this.leadHorses.length === 0) { this.leadRope.clear(); return; }

    const p = this.player.sprite;
    const { facing } = this.player;

    this.leadRope.clear();
    this.leadRope.lineStyle(3, 0xc8a040, 0.85);

    // Each led horse trails further behind, forming a line. The rope chains from
    // the player to the first horse, then horse-to-horse.
    let prevX = p.x, prevY = p.y - 16;
    this.leadHorses.forEach((h, idx) => {
      const behind = 100 + idx * 70;
      let tx = p.x, ty = p.y;
      if      (facing === 'right') tx = p.x - behind;
      else if (facing === 'left')  tx = p.x + behind;
      else if (facing === 'down')  ty = p.y - behind;
      else                         ty = p.y + behind;

      const dx = tx - h.sprite.x;
      const dy = ty - h.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const fromX = h.sprite.x, fromY = h.sprite.y;
      if (dist > 30) {
        const speed = PLAYER_SPEED * 1.15 * (delta / 1000);
        const ratio = Math.min(1, speed / dist);
        // Axis-separated move with collision so a led horse slides along the
        // fence and can only cross the pasture boundary through the open gate.
        const nx = h.sprite.x + dx * ratio;
        const ny = h.sprite.y + dy * ratio;
        if (!this._collides(nx, h.sprite.y, 16)) h.sprite.x = nx;
        if (!this._collides(h.sprite.x, ny, 16)) h.sprite.y = ny;
        if (Math.abs(dx) > 1) h.sprite.setFlipX(dx < 0);
      }

      // Animate from actual movement, not distance-to-target. A led horse trots
      // at 1.15x player speed, so at steady state it hovers around the stop
      // threshold and would otherwise flicker between walk and idle each frame.
      // A short hysteresis window keeps the walk cycle alive through the brief
      // catch-up pauses, so it only drops to idle once it has truly settled.
      const moved = Math.hypot(h.sprite.x - fromX, h.sprite.y - fromY);
      if (moved > 0.3) {
        h._ledStillFor = 0;
        h.sprite.play(`walk_${h.key}`, true);
      } else {
        h._ledStillFor = (h._ledStillFor || 0) + delta;
        if (h._ledStillFor > 150 && h.sprite.anims.currentAnim?.key !== `idle_${h.key}`) {
          h.sprite.play(`idle_${h.key}`, true);
        }
      }

      // Draw rope segment from previous point to this horse
      this.leadRope.beginPath();
      this.leadRope.moveTo(prevX, prevY);
      this.leadRope.lineTo(h.sprite.x, h.sprite.y - 32);
      this.leadRope.strokePath();
      prevX = h.sprite.x;
      prevY = h.sprite.y - 32;
    });
  }

  // ─── Food placement ──────────────────────────────────────────────────────

  // Ground sprite for each food item dropped by the player.
  static FOOD_GROUND_TEX = {
    hay: 'hayPile', apple: 'applePile', carrot: 'carrotPile', seed: 'seedPile',
  };

  // Generic food drop — identical placement for every food. Seeds feed chickens
  // (seedPiles); all other foods feed horses (hayPiles).
  placeFood(item) {
    if (!item) return;
    const { sprite, facing } = this.player;
    let px = sprite.x, py = sprite.y;
    if      (facing === 'right') px += 70;
    else if (facing === 'left')  px -= 70;
    else if (facing === 'down')  py += 50;
    else                         py -= 50;
    px = Phaser.Math.Clamp(px + Phaser.Math.Between(-15, 15), PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    py = Phaser.Math.Clamp(py + Phaser.Math.Between(-10, 10), PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const tex = PaddockScene.FOOD_GROUND_TEX[item.key] || 'hayPile';
    const pileSprite = this.add.image(px, py, tex).setScale(S).setDepth(py);
    const pile = { x: px, y: py, sprite: pileSprite, feedsLeft: 3 };
    if (item.key === 'seed') this.props.seedPiles.push(pile);
    else                     this.props.hayPiles.push(pile);
  }

  fillTrough() {
    const t = this.props.trough;
    if (!t || t.filled) return;
    t.filled = true;
    t.drinks = 3;
    t.sprite.setTexture('troughFull');
    playSplash();
  }

  toggleGate() {
    const gate = this.props.gate;
    if (!gate) return;

    gate.open = !gate.open;
    gate.sprite.setTexture(gate.open ? 'gateOpen' : 'gateClosed');

    // Update gate obstacle — open gate is passable for everyone, closed gate blocks everyone
    const gateInList = this.obstacles.includes(this.gateObstacle);
    if (gate.open && gateInList) {
      // Remove gate from obstacles so player and horses can pass through
      this.obstacles = this.obstacles.filter(o => o !== this.gateObstacle);
    } else if (!gate.open && !gateInList) {
      // Add gate to obstacles to block passage
      this.obstacles.push(this.gateObstacle);
      // If the player is standing inside the gate footprint, nudge them out to
      // whichever side (farm-north or pasture-south) is closer so they don't get trapped.
      const p = this.player?.sprite;
      const g = this.gateObstacle;
      if (p && this._hits(p.x, p.y, 14, g)) {
        // Strongly favor nudging the player north (toward the farm). Only push
        // them south into the pasture if they're clearly in the bottom portion.
        const nudgeSouth = p.y > g.y + g.h * 0.8;
        p.y = nudgeSouth ? g.y + g.h + 15 : g.y - 15;
        p.y = Phaser.Math.Clamp(p.y, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
        if (this.player.shadow) this.player.shadow.y = p.y;
      }

      // Bounce any creature caught mid-stride in the gate doorway to its home
      // side so it isn't left standing in (or walking through) the shut gate.
      // Movers still approaching the gate are stopped by the _runPath guard.
      for (const m of [...this.horses, ...this.animals]) {
        if (!m.sprite?.active || !m.wanderTween) continue;
        if (this._hits(m.sprite.x, m.sprite.y, 16, g)) {
          m.wanderTween.stop();
          m.wanderTween = null;
          this._settleAtGate(m);
        }
      }
    }
  }

  // ─── Item use ────────────────────────────────────────────────────────────

  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    switch (item.action) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': horse.brush(); break;
      case 'pet':   horse.pet();   break;
      case 'ride':  this.mountHorse(h); return;
      case 'lead':  this.toggleLead(h); return;
    }

    if (h.key === 'horse') saveHorse(horse);
    this.game.events.emit('stats-changed');

    if (item.action === 'pet') {
      playChime();
      this.showHeart(h.sprite);
      this.hop(h.sprite);
    } else {
      if (item.action === 'feed')  playEat();
      if (item.action === 'water') playDrink();
      if (item.action === 'brush') playBrush();
      this.showIcon(item.icon, h.sprite);
    }

    if (this.scene.isActive('PortraitScene')) {
      const viewing = this.registry.get('viewingHorse');
      if (viewing?.horseKey === h.key) {
        this.scene.get('PortraitScene').refreshStats(horse);
      }
    }
  }

  // ─── Portrait ────────────────────────────────────────────────────────────

  openPortrait(key) {
    const allHorses = this.registry.get('allHorses');
    this.registry.set('viewingHorse', {
      horse:      allHorses[key],
      portraitKey: `portrait_${key}`,
      horseKey:   key,
    });
    if (this.scene.isActive('PortraitScene')) {
      this.scene.get('PortraitScene').refresh();
      return;
    }
    this.scene.launch('PortraitScene');
    this.scene.bringToTop('PortraitScene');
  }

  openChickenInfo(key) {
    const allChickens = this.registry.get('allChickens');
    this.registry.set('viewingChicken', {
      chicken:   allChickens[key],
      chickenKey: key,
    });
    if (this.scene.isActive('ChickenInfoScene')) {
      this.scene.get('ChickenInfoScene').refresh();
      return;
    }
    this.scene.launch('ChickenInfoScene');
    this.scene.bringToTop('ChickenInfoScene');
  }

  // ─── Actions (from PortraitScene buttons) ────────────────────────────────

  doAction({ type, horseKey }) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[horseKey];
    if (!horseData) return;

    switch (type) {
      case 'feed':  horseData.feed();  break;
      case 'water': horseData.water(); break;
      case 'brush': horseData.brush(); break;
      case 'pet':   horseData.pet();   break;
    }

    if (horseKey === 'horse') saveHorse(horseData);

    if (type === 'pet')   playChime();
    if (type === 'feed')  playEat();
    if (type === 'water') playDrink();
    if (type === 'brush') playBrush();

    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet') {
        this.showHeart(h.sprite);
        this.hop(h.sprite);
      } else {
        const icons = { feed: 'iconFeed', water: 'iconWater', brush: 'iconBrush' };
        this.showIcon(icons[type], h.sprite);
      }
    }
  }

  showHeart(sprite) {
    const heart = this.add.image(sprite.x, sprite.y - 100, 'heart')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: heart, y: heart.y - 56, alpha: 0, scale: S * 1.4,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  showIcon(key, sprite) {
    const icon = this.add.image(sprite.x, sprite.y - 112, key)
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 44, alpha: 0,
      duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  hop(sprite) {
    this.tweens.add({
      targets: sprite, y: sprite.y - 12, duration: 120,
      yoyo: true, ease: 'Quad.easeOut',
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    this._pollRawPad();
    if (this._paused) return;
    this._updateHold();
    this.updateRiding(delta);
    this.movePlayer(delta);
    this.updateLeading(delta);
    this.updateFoals(delta);
    this.checkProximity();
    this.depthSort();
    this.tickDecay(delta);
    this.tickAutosave(delta);
  }

  _togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      const sw = this.scale.width, sh = this.scale.height;
      const bg = this.add.graphics().setDepth(9990);
      bg.fillStyle(0x000000, 0.55);
      bg.fillRect(0, 0, sw, sh);
      const lbl = this.add.text(sw / 2, sh / 2, 'PAUSED', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      const hint = this.add.text(sw / 2, sh / 2 + 48, 'Press Start to resume', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9aa0c0',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      this._pauseOverlay = [bg, lbl, hint];
    } else {
      this._pauseOverlay?.forEach(o => o.destroy());
      this._pauseOverlay = null;
    }
  }

  _pollRawPad() {
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!raw) { this._rawPad = null; return; }

    // If Phaser detected it, keep this.gamePad set so the rest of the code knows a pad exists.
    // But we'll read actual state from the raw pad to avoid Phaser's stale cache.
    if (!this.gamePad && this.input.gamepad.total > 0) {
      this.gamePad = this.input.gamepad.getPad(0);
    }
    if (!this.gamePad && raw) this.gamePad = {}; // sentinel so movePlayer enters the pad branch

    const btns = raw.buttons;
    const axes = raw.axes;

    // Standard gamepad mapping
    this._rawPad = {
      leftStickX:  axes[0] ?? 0,
      leftStickY:  axes[1] ?? 0,
      dUp:     btns[12]?.pressed ?? false,
      dDown:   btns[13]?.pressed ?? false,
      dLeft:   btns[14]?.pressed ?? false,
      dRight:  btns[15]?.pressed ?? false,
      btnA:    btns[0]?.pressed  ?? false,
      btnB:    btns[1]?.pressed  ?? false,
      btnLT:   (btns[6]?.value ?? 0) > 0.3,
      btnRT:   (btns[7]?.value ?? 0) > 0.3,
      btnBack: btns[8]?.pressed  ?? false,
      btnStart:btns[9]?.pressed  ?? false,
    };

    const prev    = this._prevRawButtons;
    const hotbar  = this.scene.get('HotbarScene');

    if (this._rawPad.btnA && !prev.btnA) {
      this.padAJustDown = true;
      this.usingPad = true;
    }
    // B = close any open menu
    if (this._rawPad.btnB && !prev.btnB) {
      this.usingPad = true;
      if (hotbar?.invOpen)                      hotbar._closeInventory();
      else if (this.scene.isActive('PortraitScene')) this.scene.stop('PortraitScene');
    }
    // LT/RT = cycle hotbar (same as LB/RB)
    if (this._rawPad.btnLT && !prev.btnLT) {
      this.usingPad = true;
      if (hotbar) hotbar._setActive((hotbar.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
    }
    if (this._rawPad.btnRT && !prev.btnRT) {
      this.usingPad = true;
      if (hotbar) hotbar._setActive((hotbar.activeSlot + 1) % NUM_SLOTS);
    }
    // Back = toggle inventory
    if (this._rawPad.btnBack && !prev.btnBack) {
      this.usingPad = true;
      hotbar?._toggleInventory();
    }
    // Start = pause / unpause
    if (this._rawPad.btnStart && !prev.btnStart) {
      this.usingPad = true;
      this._togglePause();
    }

    this._prevRawButtons = {
      btnA:     this._rawPad.btnA,
      btnB:     this._rawPad.btnB,
      btnLT:    this._rawPad.btnLT,
      btnRT:    this._rawPad.btnRT,
      btnBack:  this._rawPad.btnBack,
      btnStart: this._rawPad.btnStart,
    };
  }

  updateFoals(delta) {
    for (const foal of this.foals) {
      const parent = foal.parentH.sprite;
      const dx = parent.x - foal.sprite.x;
      const dy = parent.y - foal.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 80) {
        const speed = PLAYER_SPEED * 1.05 * (delta / 1000);
        const ratio = Math.min(1, speed / dist);
        foal.sprite.x += dx * ratio;
        foal.sprite.y += dy * ratio;
        foal.sprite.setFlipX(dx < 0);
        foal.sprite.play(`walk_${foal.key}`, true);
      } else {
        foal.sprite.play(`idle_${foal.key}`, true);
      }

      foal.shadow.x = foal.sprite.x;
      foal.shadow.y = foal.sprite.y;
      foal.shadow.setDepth(foal.sprite.y - 1);
      foal.sprite.setDepth(foal.sprite.y);
    }
  }

  movePlayer(delta) {
    if (this.riding) return;

    // Stop all movement while radial menu is open
    if (this.scene.get('HotbarScene')?.invOpen) {
      this._cancelTapMove();
      this._stopWalkAnim();
      return;
    }

    const { cursors, wasd, player } = this;
    const pad = this.gamePad;

    let vx = 0, vy = 0;

    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;

    const rp = this._rawPad;
    if (rp) {
      if (Math.abs(rp.leftStickX) > 0.15) vx += rp.leftStickX;
      if (Math.abs(rp.leftStickY) > 0.15) vy += rp.leftStickY;
      if (rp.dLeft)  vx -= 1;
      if (rp.dRight) vx += 1;
      if (rp.dUp)    vy -= 1;
      if (rp.dDown)  vy += 1;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = rp && (
      Math.abs(rp.leftStickX) > 0.15 || Math.abs(rp.leftStickY) > 0.15 ||
      rp.dLeft || rp.dRight || rp.dUp || rp.dDown
    );
    if (kbActive)  this.usingPad = false;
    if (padActive) this.usingPad = true;

    // Manual input cancels any tap-to-move trip in progress.
    if (kbActive || padActive) this._cancelTapMove();

    if (this.navPath) {
      this._stepNav(delta);
      player.shadow.x = player.sprite.x;
      player.shadow.y = player.sprite.y;
      return;
    }

    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      const step = PLAYER_SPEED * (delta / 1000);
      const nx = Phaser.Math.Clamp(player.sprite.x + vx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      const ny = Phaser.Math.Clamp(player.sprite.y + vy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
      // Slide: try each axis independently so player can slide along walls
      if (!this._collides(nx, player.sprite.y)) player.sprite.x = nx;
      if (!this._collides(player.sprite.x, ny)) player.sprite.y = ny;

      let newFacing;
      if (Math.abs(vx) >= Math.abs(vy)) {
        newFacing = vx < 0 ? 'left' : 'right';
      } else {
        newFacing = vy < 0 ? 'up' : 'down';
      }

      if (!player.moving || newFacing !== player.facing) {
        player.facing = newFacing;
        const animKey = newFacing === 'up'  ? 'player_walk_up' :
                        newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
        player.sprite.setFlipX(newFacing === 'left');
        player.sprite.play(animKey, true);
      }
      player.moving = true;

    } else if (player.moving) {
      const idleKey = player.facing === 'up'  ? 'player_up_0' :
                      player.facing === 'down' ? 'player_down_0' : 'player_side_0';
      player.sprite.setFlipX(player.facing === 'left');
      player.sprite.stop();
      player.sprite.setTexture(idleKey);
      player.moving = false;
    }

    player.shadow.x = player.sprite.x;
    player.shadow.y = player.sprite.y;
  }

  checkProximity() {
    if (this.scene.get('HotbarScene')?.invOpen) {
      this.interactPrompt.setVisible(false);
      return;
    }

    // When riding, show dismount hint
    if (this.riding) {
      const h = this.riding.h;
      const btn = this.usingPad ? '[ A ]' : '[ E ]';
      this.interactPrompt.setText(`${btn}  Dismount`);
      this.interactPrompt.setPosition(h.sprite.x, h.sprite.y - 140);
      this.interactPrompt.setVisible(true);
      return;
    }

    const { player } = this;
    const item    = this.getActiveItem();
    const eJust   = Phaser.Input.Keyboard.JustDown(this.eKey);
    const aJust   = this.padAJustDown;
    this.padAJustDown = false;

    // E (keyboard) and A (gamepad) both trigger item use / interact
    const useJust = eJust || aJust;
    const useKey  = this.usingPad ? '[ A ]' : '[ E ]';

    // Gate — open/close
    const gate = this.props.gate;
    if (gate) {
      const gd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, gate.x, gate.y
      );
      if (gd < 100) {
        const gateState = gate.open ? 'Close' : 'Open';
        this.interactPrompt.setText(`${useKey}  ${gateState} Gate`);
        this.interactPrompt.setPosition(gate.x, gate.y - 80);
        this.interactPrompt.setVisible(true);
        if (useJust) this.toggleGate();
        return;
      }
    }

    // Farm stand — deposit basket eggs
    if (this.farmStand) {
      const fd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, this.farmStand.x, this.farmStand.y
      );
      if (fd < 120) {
        const hasBasket = item?.key === 'basket';
        if (hasBasket && this.basketEggs > 0) {
          this.interactPrompt.setText(`${useKey}  Place Eggs  (basket: ${this.basketEggs})`);
        } else if (hasBasket) {
          this.interactPrompt.setText(`Farm Stand  •  ${this.farmStand.stock} egg${this.farmStand.stock !== 1 ? 's' : ''} for sale  (basket empty)`);
        } else {
          this.interactPrompt.setText(`Farm Stand  •  ${this.farmStand.stock} egg${this.farmStand.stock !== 1 ? 's' : ''} for sale`);
        }
        this.interactPrompt.setPosition(this.farmStand.x, this.farmStand.y - 100);
        this.interactPrompt.setVisible(true);
        if (useJust && hasBasket && this.basketEggs > 0) this.stockStand();
        return;
      }
    }

    // Trough — fill with bucket
    const trough = this.props.trough;
    if (trough) {
      const td = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, trough.x, trough.y
      );
      if (td < 130 && item?.key === 'bucket' && !trough.filled) {
        this.interactPrompt.setText(`${useKey}  Fill Trough`);
        this.interactPrompt.setPosition(trough.x, trough.y - 40);
        this.interactPrompt.setVisible(true);
        if (useJust) this.fillTrough();
        return;
      }
    }

    // Nearest horse — use item or open portrait
    let nearest = null, nearestDist = Infinity;
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, h.sprite.x, h.sprite.y
      );
      if (d < nearestDist) { nearestDist = d; nearest = h; }
    }
    // Food and water are placement-only (no direct use on horses). Treats
    // (action 'pet') and tools (brush/ride/lead) can still be used directly.
    const inRange = nearest && nearestDist < INTERACT_DIST &&
      item?.action !== 'seed' && item?.action !== 'basket' &&
      item?.action !== 'feed' && item?.action !== 'water';

    if (inRange) {
      let verb;
      if (item?.action === 'ride')      verb = 'Mount';
      else if (item?.action === 'lead') verb = this.leadHorses.includes(nearest) ? 'Detach Lead' : 'Attach Lead';
      else if (item?.action === 'interact') verb = 'Info';
      else if (item) verb = `Use ${item.label}`;
      else verb = `Info  •  [ A ] Pet`;

      this.interactPrompt.setText(`${useKey}  ${verb}`);
      this.interactPrompt.setPosition(nearest.sprite.x, nearest.sprite.y - 118);
      this.interactPrompt.setVisible(true);

      if (useJust) {
        if (item?.action === 'ride')      this.mountHorse(nearest);
        else if (item?.action === 'lead') this.toggleLead(nearest);
        else if (item?.action === 'interact') this.openPortrait(nearest.key);
        else if (item)                    this.useItemOnHorse(item, nearest);
        else                              this.openPortrait(nearest.key);
      }
      return;
    }

    // Nest — collect eggs (requires basket)
    for (const nest of this.props.nests) {
      if (!nest.hasEgg) continue;
      const nd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, nest.x, nest.y
      );
      if (nd < 80) {
        const hasBasket = item?.key === 'basket';
        this.interactPrompt.setText(hasBasket
          ? `${useKey}  Collect Egg`
          : `Egg in nest  •  equip Basket to collect`);
        this.interactPrompt.setPosition(nest.x, nest.y - 30);
        this.interactPrompt.setVisible(true);
        if (useJust && hasBasket) this.collectEgg(nest);
        return;
      }
    }

    // Foal proximity
    for (const foal of this.foals) {
      const fd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, foal.sprite.x, foal.sprite.y
      );
      if (fd < 65) {
        this.interactPrompt.setText(`[ A ]  Pet`);
        this.interactPrompt.setPosition(foal.sprite.x, foal.sprite.y - 78);
        this.interactPrompt.setVisible(true);
        return;
      }
    }

    // Animal proximity
    for (const a of this.animals) {
      const ad = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, a.sprite.x, a.sprite.y);
      if (ad < 60) {
        this.interactPrompt.setText(`[ A ]  Pet`);
        this.interactPrompt.setPosition(a.sprite.x, a.sprite.y - 54);
        this.interactPrompt.setVisible(true);
        return;
      }
    }

    this.interactPrompt.setVisible(false);

    // Drop food when not near anything (hay, apple, carrot, seeds — all the same)
    if (useJust && (item?.action === 'feed' || item?.action === 'seed')) this.placeFood(item);
  }

  _showAnimalInfo(a) {
    const label = a.key.charAt(0).toUpperCase() + a.key.slice(1);
    const mood  = this.isNight ? 'Sleeping' : 'Wandering';
    const popup = this.add.text(a.sprite.x, a.sprite.y - 60, `${label}\n${mood}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fffde0',
      backgroundColor: '#1c1f2ecc',
      padding: { x: 8, y: 5 },
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(9999);
    this.tweens.add({
      targets: popup,
      y: popup.y - 20,
      alpha: 0,
      duration: 1800,
      ease: 'Quad.easeIn',
      onComplete: () => popup.destroy(),
    });
  }

  depthSort() {
    const p = this.player;
    p.shadow.setDepth(p.sprite.y - 1);
    p.sprite.setDepth(p.sprite.y);

    for (const h of this.horses) {
      h.shadow.x = h.sprite.x;
      h.shadow.y = h.sprite.y;
      h.shadow.setDepth(h.sprite.y - 1);
      h.sprite.setDepth(h.sprite.y);
    }

    for (const a of this.animals) {
      a.shadow.x = a.sprite.x;
      a.shadow.y = a.sprite.y;
      a.shadow.setDepth(a.sprite.y - 1);
      a.sprite.setDepth(a.sprite.y);
    }

    for (const npc of this.npcs) {
      npc.shadow.x = npc.sprite.x;
      npc.shadow.y = npc.sprite.y;
      npc.shadow.setDepth(npc.sprite.y - 1);
      npc.sprite.setDepth(npc.sprite.y);
    }
  }

  tickDecay(delta) {
    this.decayAccum += delta;
    if (this.decayAccum >= 1000) {
      this.horse.applyDecay(this.decayAccum / 1000, false);
      this.decayAccum = 0;
      this.game.events.emit('stats-changed');
    }
  }

  tickAutosave(delta) {
    this.saveAccum += delta;
    if (this.saveAccum >= 15000) {
      this.saveAccum = 0;
      saveHorse(this.horse);
    }
  }
}
