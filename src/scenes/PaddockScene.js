import Phaser from 'phaser';
import { saveHorse } from '../data/save.js';
import {
  playHoofbeat, playEat, playDrink, playBrush, playChime,
  playSplash, playBirdChirp, startWind, stopWind, startMusic, stopMusic,
} from '../audio/sounds.js';

const WORLD_W = 1920;
const WORLD_H = 1280;

const INTERACT_DIST = 100;
const PLAYER_SPEED  = 210;
const RIDE_SPEED    = 340;

const BOUNDS      = { minX: 180, maxX: 1740, minY: 360, maxY: 1060 };
const PLAYER_BOUNDS = { minX: 40, maxX: 1880, minY: 80, maxY: 1220 };

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

    // World interactables
    this.props = { trough: null, hayPiles: [], seedPiles: [], nests: [] };
    this.inventory = { egg: 0 };

    // Riding / leading state
    this.riding   = null; // { h, saddleImg }
    this.leading  = null; // horse being led
    this.leadRope = null; // Graphics line

    this.buildWorld();
    this.buildObstacles();
    this.buildHorses();
    this.buildAnimals();
    this.buildPlayer();

    // Periodic AI tick: direct idle horses to food/water
    this.time.addEvent({ delay: 3000, loop: true, callback: this.horseTick, callbackScope: this });

    this.isNight = false;
    this.game.events.on('horse-action',  this.doAction,      this);
    this.game.events.on('phase-change',  this.onPhaseChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('horse-action',  this.doAction,      this);
      this.game.events.off('phase-change',  this.onPhaseChange, this);
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

    // Nests in front of (below) the coop
    const nestPositions = [[906, 410], [930, 416], [954, 410]];
    for (const [nx, ny] of nestPositions) {
      const sprite = this.add.image(nx, ny, 'nest').setScale(S).setDepth(ny + 1).setOrigin(0.5, 0.5);
      this.props.nests.push({ x: nx, y: ny, hasEgg: false, sprite, occupant: null });
    }

    // Egg-laying timer: every 45 seconds a random chicken may lay in a free nest
    this.time.addEvent({ delay: 45_000, loop: true, callback: this.eggLayTick, callbackScope: this });

    // Water trough (interactive)
    const tx = 740, ty = 490;
    const troughSprite = this.add.image(tx, ty, 'trough')
      .setScale(S).setDepth(ty).setOrigin(0.5, 0.5);
    this.props.trough = { x: tx, y: ty, sprite: troughSprite, filled: false, drinks: 0 };
  }

  // ─── Obstacles & collision ───────────────────────────────────────────────

  buildObstacles() {
    // Rects in world space {x, y, w, h} — top-left origin.
    // Sized to the solid/wall area of each prop (not full sprite bounds).
    this.obstacles = [
      // Barn walls (origin 0.5,1 at 240,280; sprite 84×66 at S=2 → 168×132; walls ~lower 90px)
      { x: 162, y: 192, w: 156, h: 88 },
      // Coop (origin 0.5,1 at 930,400; sprite 64×52 at S=2 → 128×104)
      { x: 868, y: 300, w: 124, h: 100 },
      // Trough (origin 0.5,0.5 at 740,490; sprite 100×26 at S=2 → 200×52)
      { x: 652, y: 468, w: 176, h: 44 },
      // Fence line (6 segments at y=320, origin 0,0.5; 96×48 each → x=300..876)
      { x: 300, y: 300, w: 576, h: 40 },
    ];

    // Chicken-specific list: same but without the coop (they're allowed in)
    this.chickenObstacles = this.obstacles.filter(o => o !== this.obstacles[1]);

    // Nest obstacles added after nests are built (in buildWorld nests are created before this)
    // Each nest: origin 0.5,0.5 at (nx,ny); 18×12 at S=2 → 36×24
    for (const n of this.props.nests) {
      this.obstacles.push({ x: n.x - 18, y: n.y - 12, w: 36, h: 24, isNest: true });
    }
    // Chickens avoid other nests too (but they approach the target nest directly)
    this.chickenObstacles = this.obstacles.filter(o => o !== this.obstacles[1]);
  }

  // Point-vs-rect check with a character radius.
  _hits(x, y, r, obs) {
    return x + r > obs.x && x - r < obs.x + obs.w &&
           y + r > obs.y && y - r < obs.y + obs.h;
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
    const h1 = this.spawnHorse(680,  730, 'horse',  1500);
    const h2 = this.spawnHorse(380,  530, 'horse2',  800);
    const h3 = this.spawnHorse(1380, 860, 'horse3', 2200);
    const h4 = this.spawnHorse(1050, 480, 'horse4', 1200);
    const h5 = this.spawnHorse(520,  920, 'horse5', 3000);
    const h6 = this.spawnHorse(1600, 620, 'horse6', 1800);
    const h7 = this.spawnHorse(900,  600, 'horse7', 2600); // Ebony — Friesian

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

    // Chicken flock — 5 birds, each a different color coat
    const cx = 560, cy = 760;
    const offsets = [[-40,-20],[30,-30],[0,30],[-60,20],[50,10]];
    offsets.forEach(([ox, oy], i) => {
      this.spawnAnimal(cx + ox, cy + oy, `chicken${i}`, 0.25, 8, 10, cx, cy, 180, 6);
    });

    this.time.addEvent({ delay: 2000, loop: true, callback: this.chickenTick, callbackScope: this });
  }

  spawnAnimal(startX, startY, key, shadowScale, walkFps, tweenRate, homeX, homeY, wanderRadius, eatFps) {
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
                _eatPile: null, eatTimer: null };
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

    const obsList = a.key.startsWith('chicken') ? this.chickenObstacles : this.obstacles;
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
    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty);

    a.sprite.setFlipX(tx < a.sprite.x);
    a.sprite.play(`walk_${a.key}`, true);

    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: tx, y: ty,
      duration: Math.max(800, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!a.sprite.active) return;
        a.wanderTween = null;
        a.sprite.play(`idle_${a.key}`, true);
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(4000, 10000));
      },
    });
  }

  chickenTick() {
    if (this.isNight) return;
    if (!this.props.seedPiles?.length) return;
    for (const a of this.animals) {
      if (!a.key.startsWith('chicken')) continue;
      if (a.state !== 'idle' && a.state !== 'wandering') continue;
      let closest = null, closestDist = Infinity;
      for (const pile of this.props.seedPiles) {
        if (this.animals.some(o => o !== a && o._eatPile === pile)) continue; // 1 chicken per pile
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
    a.sprite.setFlipX(!facingRight);
    a.sprite.play(`walk_${a.key}`, true);

    const tx = pile.x + (facingRight ? -16 : 16);
    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, pile.y);

    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: tx, y: pile.y,
      duration: Math.max(300, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: () => {
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
      },
    });
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
    nest.hasEgg = false;
    nest.sprite.setTexture('nest');
    this.inventory.egg++;
    this.game.events.emit('inventory-changed', this.inventory);

    // Floating egg icon feedback
    const icon = this.add.image(nest.x, nest.y - 20, 'iconEgg')
      .setScale(1.5).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  placeSeeds() {
    const { sprite, facing } = this.player;
    let px = sprite.x, py = sprite.y;
    if      (facing === 'right') px += 60;
    else if (facing === 'left')  px -= 60;
    else if (facing === 'down')  py += 45;
    else                         py -= 45;
    px = Phaser.Math.Clamp(px + Phaser.Math.Between(-10, 10), BOUNDS.minX, BOUNDS.maxX);
    py = Phaser.Math.Clamp(py + Phaser.Math.Between(-8,  8),  BOUNDS.minY, BOUNDS.maxY);

    const pileSprite = this.add.image(px, py, 'seedPile').setScale(S).setDepth(py);
    this.props.seedPiles.push({ x: px, y: py, sprite: pileSprite });
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
    const { tx, ty } = this._safeTarget(BOUNDS.minX, BOUNDS.maxX, BOUNDS.minY, BOUNDS.maxY,
                                         this.obstacles, h.sprite.x, h.sprite.y);
    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);

    h.sprite.setFlipX(tx < h.sprite.x);
    h.sprite.play(`walk_${h.key}`, true);

    h.wanderTween = this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(600, dist * 11),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!h.sprite.active) return;
        h.wanderTween = null;
        h.sprite.play(`idle_${h.key}`, true);
        h.state = 'idle';
        this.scheduleWander(h, Phaser.Math.Between(2000, 5000));
      }
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
    };
    for (const h of this.horses) stopOne(h);
    for (const a of this.animals) stopOne(a);
  }

  wakeAllAnimals() {
    for (const h of this.horses) {
      if (h.state === 'resting') { h.state = 'idle'; this.scheduleWander(h, Phaser.Math.Between(500, 3000)); }
    }
    for (const a of this.animals) {
      if (a.state === 'resting') { a.state = 'idle'; this.scheduleAnimalWander(a, Phaser.Math.Between(500, 3000)); }
    }
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

  // Returns true if horse was directed somewhere; false if it should wander normally.
  horseTickForHorse(h) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[h.key];
    if (!horseData) return false;

    if (horseData.stats.hunger < 95 && this.props.hayPiles.length > 0) {
      let closest = null, closestDist = Infinity;
      for (const pile of this.props.hayPiles) {
        const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y);
        if (d < closestDist) { closestDist = d; closest = pile; }
      }
      if (closest && closestDist < 700) {
        this.horseGoEat(h, closest);
        return true;
      }
    }

    if (horseData.stats.thirst < 95 && this.props.trough?.filled) {
      const td = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.props.trough.x, this.props.trough.y);
      if (td < 1000) {
        this.horseGoDrink(h);
        return true;
      }
    }

    return false;
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
    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);

    h.sprite.setFlipX(!facingRight);
    h.sprite.play(`walk_${h.key}`, true);

    h.wanderTween = this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(500, dist * 10),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (h.state !== 'eating') return;
        h.wanderTween = null;
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
      }
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
    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);

    h.sprite.setFlipX(!facingRight);
    h.sprite.play(`walk_${h.key}`, true);

    h.wanderTween = this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(500, dist * 10),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (h.state !== 'drinking') return;
        h.wanderTween = null;
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
      }
    });
  }

  // ─── Player ──────────────────────────────────────────────────────────────

  buildPlayer() {
    const makeAnim = (key, frames, rate) => {
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames, frameRate: rate, repeat: -1 });
      }
    };
    makeAnim('player_walk_down', [{ key: 'player_down_0' }, { key: 'player_down_1' }], 7);
    makeAnim('player_walk_up',   [{ key: 'player_up_0'   }, { key: 'player_up_1'   }], 7);
    makeAnim('player_walk_side', [{ key: 'player_side_0' }, { key: 'player_side_1' }], 7);

    const startX = WORLD_W / 2;
    const startY = WORLD_H / 2 + 60;

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, 'player_down_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(startY);

    this.player    = { sprite, shadow, facing: 'down', moving: false };
    this.moveTween = null;

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

    this.gamePad      = null;
    this.usingPad     = false;
    this.padAJustDown = false;

    this.input.gamepad.on('connected', pad => { this.gamePad = pad; });
    if (this.input.gamepad.total > 0) this.gamePad = this.input.gamepad.getPad(0);

    this.input.gamepad.on('down', (_pad, button) => {
      this.usingPad = true;
      if (button.index === 0) this.padAJustDown = true;
      if (button.index === 1 && this.scene.isActive('PortraitScene')) {
        this.scene.stop('PortraitScene');
      }
    });

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
    if (this.scene.get('RadialMenuScene')?.isOpen) return;
    if (pointer.button !== 0) return;
    if (this.riding) return;

    // Ignore taps in the badge area at the bottom of the canvas
    if (pointer.y > this.scale.height - 72) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const item  = this.getActiveItem();

    // Horse tap
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(world.x, world.y, h.sprite.x, h.sprite.y);
      if (d < 80) {
        const tx = h.sprite.x + (world.x < h.sprite.x ? -70 : 70);
        this.tapMoveTo(tx, h.sprite.y, () => {
          const cur = this.getActiveItem();
          if (cur?.action === 'ride')  { this.mountHorse(h); return; }
          if (cur?.action === 'lead')  { this.toggleLead(h); return; }
          if (cur && cur.action !== 'seed') { this.useItemOnHorse(cur, h); return; }
          this.openPortrait(h.key);
        });
        return;
      }
    }

    // Trough tap with bucket — walk to trough then fill
    const trough = this.props.trough;
    if (trough && item?.key === 'bucket' && !trough.filled) {
      const td = Phaser.Math.Distance.Between(world.x, world.y, trough.x, trough.y);
      if (td < 220) {
        const side = world.x < trough.x ? 1 : -1;
        this.tapMoveTo(trough.x + side * 90, trough.y, () => this.fillTrough());
        return;
      }
    }

    // Walk and drop hay at destination
    if (item?.action === 'feed') {
      this.tapMoveTo(world.x, world.y, () => this.placeHay());
      return;
    }

    // Walk and scatter seeds at destination
    if (item?.action === 'seed') {
      this.tapMoveTo(world.x, world.y, () => this.placeSeeds());
      return;
    }

    if (!this._collides(world.x, world.y)) this.tapMoveTo(world.x, world.y);
  }

  tapMoveTo(tx, ty, onArrive) {
    if (this.moveTween) { this.moveTween.stop(); this.moveTween = null; }

    const { sprite } = this.player;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    if (dist < 8) { onArrive?.(); return; }

    const dx = tx - sprite.x;
    const dy = ty - sprite.y;
    const facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');

    this.player.facing = facing;
    sprite.setFlipX(facing === 'left');
    const animKey = facing === 'up' ? 'player_walk_up' :
                    facing === 'down' ? 'player_walk_down' : 'player_walk_side';
    sprite.play(animKey, true);
    this.player.moving = true;

    this.moveTween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: (dist / PLAYER_SPEED) * 1000,
      ease: 'Linear',
      onComplete: () => {
        this.moveTween = null;
        this.player.moving = false;
        const idleKey = facing === 'up'  ? 'player_up_0' :
                        facing === 'down' ? 'player_down_0' : 'player_side_0';
        sprite.stop();
        sprite.setTexture(idleKey);
        onArrive?.();
      },
    });
  }

  getActiveItem() {
    return this.scene.get('RadialMenuScene')?.getActiveItem() ?? null;
  }

  // ─── Riding ──────────────────────────────────────────────────────────────

  mountHorse(h) {
    if (this.riding) this.dismount();
    if (this.leading === h) this.stopLeading();

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
    if (this.moveTween) { this.moveTween.stop(); this.moveTween = null; }
    this.player.moving = false;

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

    if (vx !== 0 || vy !== 0) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      h.sprite.x = Phaser.Math.Clamp(h.sprite.x + vx * RIDE_SPEED * (delta / 1000), BOUNDS.minX, BOUNDS.maxX);
      h.sprite.y = Phaser.Math.Clamp(h.sprite.y + vy * RIDE_SPEED * (delta / 1000), BOUNDS.minY, BOUNDS.maxY);
      h.sprite.setFlipX(vx < 0);
      h.sprite.play(`walk_${h.key}`, true);
    } else {
      h.sprite.play(`idle_${h.key}`, true);
    }

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

  // ─── Leading ─────────────────────────────────────────────────────────────

  toggleLead(h) {
    if (this.leading === h) { this.stopLeading(); return; }
    if (this.leading) this.stopLeading();

    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    h.state = 'led';
    this.leading = h;
  }

  stopLeading() {
    if (!this.leading) return;
    this.leading.state = 'idle';
    this.scheduleWander(this.leading, 1500);
    this.leading = null;
    this.leadRope.clear();
  }

  updateLeading(delta) {
    if (!this.leading) { this.leadRope.clear(); return; }

    const h = this.leading;
    const p = this.player.sprite;

    // Target: behind the player based on facing direction
    const behind = 100;
    let tx = p.x, ty = p.y;
    const { facing } = this.player;
    if      (facing === 'right') tx = p.x - behind;
    else if (facing === 'left')  tx = p.x + behind;
    else if (facing === 'down')  ty = p.y - behind;
    else                         ty = p.y + behind;

    const dx = tx - h.sprite.x;
    const dy = ty - h.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 30) {
      const speed = PLAYER_SPEED * 1.15 * (delta / 1000);
      const ratio = Math.min(1, speed / dist);
      h.sprite.x += dx * ratio;
      h.sprite.y += dy * ratio;
      h.sprite.setFlipX(dx < 0);
      h.sprite.play(`walk_${h.key}`, true);
    } else {
      h.sprite.stop();
      h.sprite.setTexture(`${h.key}_idle_0`);
    }

    // Draw rope
    this.leadRope.clear();
    this.leadRope.lineStyle(3, 0xc8a040, 0.85);
    this.leadRope.beginPath();
    this.leadRope.moveTo(p.x, p.y - 16);
    this.leadRope.lineTo(h.sprite.x, h.sprite.y - 32);
    this.leadRope.strokePath();
  }

  // ─── Hay placement ───────────────────────────────────────────────────────

  placeHay() {
    const { sprite, facing } = this.player;
    let px = sprite.x, py = sprite.y;
    if      (facing === 'right') px += 70;
    else if (facing === 'left')  px -= 70;
    else if (facing === 'down')  py += 50;
    else                         py -= 50;
    px = Phaser.Math.Clamp(px + Phaser.Math.Between(-15, 15), BOUNDS.minX, BOUNDS.maxX);
    py = Phaser.Math.Clamp(py + Phaser.Math.Between(-10, 10), BOUNDS.minY, BOUNDS.maxY);

    const pileSprite = this.add.image(px, py, 'hayPile')
      .setScale(S).setDepth(py);
    const pile = { x: px, y: py, sprite: pileSprite, feedsLeft: 3 };
    this.props.hayPiles.push(pile);
  }

  fillTrough() {
    const t = this.props.trough;
    if (!t || t.filled) return;
    t.filled = true;
    t.drinks = 3;
    t.sprite.setTexture('troughFull');
    playSplash();

    const icon = this.add.image(t.x, t.y - 40, 'iconWater')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
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
    this.updateRiding(delta);
    this.movePlayer(delta);
    this.updateLeading(delta);
    this.updateFoals(delta);
    this.checkProximity();
    this.depthSort();
    this.tickDecay(delta);
    this.tickAutosave(delta);
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
    if (this.scene.get('RadialMenuScene')?.isOpen) {
      if (this.moveTween) { this.moveTween.stop(); this.moveTween = null; }
      if (this.player.moving) {
        const idleKey = this.player.facing === 'up'  ? 'player_up_0' :
                        this.player.facing === 'down' ? 'player_down_0' : 'player_side_0';
        this.player.sprite.stop();
        this.player.sprite.setTexture(idleKey);
        this.player.moving = false;
      }
      return;
    }

    const { cursors, wasd, player } = this;
    const pad = this.gamePad;

    let vx = 0, vy = 0;

    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;

    if (pad) {
      const sx = pad.leftStick.x, sy = pad.leftStick.y;
      if (Math.abs(sx) > 0.15) vx += sx;
      if (Math.abs(sy) > 0.15) vy += sy;
      if (pad.left  > 0.5) vx -= 1;
      if (pad.right > 0.5) vx += 1;
      if (pad.up    > 0.5) vy -= 1;
      if (pad.down  > 0.5) vy += 1;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = pad && (
      Math.abs(pad.leftStick.x) > 0.15 || Math.abs(pad.leftStick.y) > 0.15 ||
      pad.left > 0.5 || pad.right > 0.5 || pad.up > 0.5 || pad.down > 0.5
    );
    if (kbActive)  this.usingPad = false;
    if (padActive) this.usingPad = true;

    if ((kbActive || padActive) && this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }

    if (this.moveTween) {
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
    if (this.scene.get('RadialMenuScene')?.isOpen) {
      this.interactPrompt.setVisible(false);
      return;
    }

    // When riding, show dismount hint (handled in updateRiding)
    if (this.riding) {
      const h = this.riding.h;
      const btn = this.usingPad ? '[ A ]' : '[ E ]';
      this.interactPrompt.setText(`${btn}  Dismount`);
      this.interactPrompt.setPosition(h.sprite.x, h.sprite.y - 140);
      this.interactPrompt.setVisible(true);
      return;
    }

    const { player } = this;
    const item = this.getActiveItem();
    const btn  = this.usingPad ? '[ A ]' : '[ E ]';
    const eJust = Phaser.Input.Keyboard.JustDown(this.eKey);
    const aJust = this.padAJustDown;
    this.padAJustDown = false;
    const pressed = eJust || aJust;

    // Trough proximity — checked first so it wins over horse when both are in range
    const trough = this.props.trough;
    if (trough) {
      const td = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, trough.x, trough.y
      );
      if (td < 130 && item?.key === 'bucket' && !trough.filled) {
        this.interactPrompt.setText(`${btn}  Fill Trough`);
        this.interactPrompt.setPosition(trough.x, trough.y - 40);
        this.interactPrompt.setVisible(true);
        if (pressed) this.fillTrough();
        return;
      }
    }

    // Nearest horse
    let nearest = null, nearestDist = Infinity;
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, h.sprite.x, h.sprite.y
      );
      if (d < nearestDist) { nearestDist = d; nearest = h; }
    }
    const inRange = nearest && nearestDist < INTERACT_DIST && item?.action !== 'seed';

    if (inRange) {
      let verb;
      if (item?.action === 'ride') verb = 'Mount';
      else if (item?.action === 'lead') verb = this.leading === nearest ? 'Detach Lead' : 'Attach Lead';
      else if (item) verb = `Use ${item.label}`;
      else verb = 'Info';

      this.interactPrompt.setText(`${btn}  ${verb}`);
      this.interactPrompt.setPosition(nearest.sprite.x, nearest.sprite.y - 118);
      this.interactPrompt.setVisible(true);

      if (pressed) {
        if (item?.action === 'ride')        this.mountHorse(nearest);
        else if (item?.action === 'lead')   this.toggleLead(nearest);
        else if (item)                      this.useItemOnHorse(item, nearest);
        else                                this.openPortrait(nearest.key);
      }
      return;
    }

    // Nest proximity — collect eggs
    for (const nest of this.props.nests) {
      if (!nest.hasEgg) continue;
      const nd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, nest.x, nest.y
      );
      if (nd < 80) {
        this.interactPrompt.setText(`${btn}  Collect Egg`);
        this.interactPrompt.setPosition(nest.x, nest.y - 30);
        this.interactPrompt.setVisible(true);
        if (pressed) this.collectEgg(nest);
        return;
      }
    }

    // Foal proximity — pettable
    for (const foal of this.foals) {
      const fd = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, foal.sprite.x, foal.sprite.y
      );
      if (fd < 65) {
        this.interactPrompt.setText(`${btn}  Pet`);
        this.interactPrompt.setPosition(foal.sprite.x, foal.sprite.y - 78);
        this.interactPrompt.setVisible(true);
        if (pressed) {
          this.showHeart(foal.sprite);
          this.hop(foal.sprite);
        }
        return;
      }
    }

    this.interactPrompt.setVisible(false);

    // Place hay on ground when pressing E with food item, not near anything
    if (pressed && item?.action === 'feed') {
      this.placeHay();
    }
    if (pressed && item?.action === 'seed') {
      this.placeSeeds();
    }
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
