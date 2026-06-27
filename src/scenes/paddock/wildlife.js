// Ambient wildlife (issues #181/#182/#183): a stream fish, fly-by/peck birds, and a
// scampering raccoon. Pure scenery for life and charm — NOT cared-for animals, so they
// live outside the roster/save/care machinery (no model, no info panel, no persistence)
// and outside the `this.animals` array the day/night + depth passes iterate. Each is a
// self-contained, tween-driven spawner on its own low-frequency timer; the only per-
// frame work is depth-sorting the active ground critters and their skittish fleeing.
//
// Applied as a functional mixin so `this` is the scene. Builders for the textures live
// in art/wildlifeArt.js (built in BootScene alongside world/player, not the roster).

import Phaser from 'phaser';
import { S, WORLD_W, BOUNDS } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';

// How close the player can get before a ground critter bolts (skittish). Birds in
// flight and fish ignore the player.
const FLEE_DIST = 200;

// World-px above horse sprite.y (origin bottom) to reach the back/withers.
// FRAME_H=54, scale=2 → top of horse ≈ 108px up; back sits at ~64px up.
const PERCH_Y = -64;

// Display scale for the wildlife sprites: their textures are super-sampled on the
// ART_SCALE grid (wildlifeArt.js), so they show at S/ART_SCALE — same on-screen size
// as before, but crisp edges (matches the horse/sheep pipeline).
const WILD_SCALE = S / ART_SCALE;

export const WithWildlife = (Base) => class extends Base {
  // ─── Setup ─────────────────────────────────────────────────────────────────

  buildWildlife() {
    this._wildCritters = []; // active birds/raccoons updateWildlife() manages

    // Animations (created once). Fish/birds flap; the raccoon scampers.
    const anim = (key, frames, frameRate) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate, repeat: -1 });
    };
    anim('fish_swim', ['fish_0', 'fish_1'], 3);
    anim('bird_fly', ['bird_fly_0', 'bird_fly_1'], 10);
    anim('bird_peck', ['bird_peck_0', 'bird_peck_1'], 4);
    anim('raccoon_idle', ['raccoon_idle_0', 'raccoon_idle_1'], 2);
    anim('raccoon_run', ['raccoon_run_0', 'raccoon_run_1', 'raccoon_run_2', 'raccoon_run_3'], 9);

    // Stagger the first appearance of each so they don't all pop in at once.
    this._scheduleFish(Phaser.Math.Between(3000, 8000));
    this._scheduleBirdVisit(Phaser.Math.Between(5000, 12000));
    this._scheduleRaccoonVisit(Phaser.Math.Between(8000, 20000));
    this._scheduleHorsePerch(Phaser.Math.Between(20000, 45000));
  }

  // Per-frame upkeep for the active ground critters: keep them depth-sorted against
  // the world, and make them bolt if the player crowds them.
  updateWildlife() {
    if (!this._wildCritters?.length) return;
    const px = this.player.sprite.x, py = this.player.sprite.y;
    for (const c of this._wildCritters) {
      if (!c.sprite.active) continue;

      // Horse-perched birds: track the host's position; flush only once perched.
      if (c.perchHost) {
        const horse = c.perchHost;
        const hostCalm = horse.sprite?.active &&
          (horse.state === 'idle' || horse.state === 'grazing' ||
           horse.state === 'eating' || horse.state === 'drinking' ||
           horse.state === 'wandering'); // tolerate wander during descent
        if (!hostCalm || (c.state === 'perched' && horse.state === 'wandering')) {
          c.perchHost = null;
          this._birdTakeOff(c);
          continue;
        }
        // Keep depth just above the horse.
        c.sprite.setDepth(horse.sprite.y + 1);
        // Follow the horse by applying the position delta each frame.
        if (c._lastHostX !== undefined && c.state === 'perched') {
          c.sprite.x += horse.sprite.x - c._lastHostX;
          c.sprite.y += horse.sprite.y - c._lastHostY;
        }
        c._lastHostX = horse.sprite.x;
        c._lastHostY = horse.sprite.y;
      }

      if (c.ground) c.sprite.setDepth(c.sprite.y);
      if (c.ground && !c.fleeing && Phaser.Math.Distance.Between(px, py, c.sprite.x, c.sprite.y) < FLEE_DIST) {
        if (c.kind === 'bird') this._birdTakeOff(c);
        else this._raccoonScurryOff(c);
      }
    }
  }

  // Drop a critter: stop its tween, fade it out, remove it from the active list.
  _despawnCritter(c) {
    const i = this._wildCritters.indexOf(c);
    if (i >= 0) this._wildCritters.splice(i, 1);
    if (c.tween) { c.tween.stop(); c.tween = null; }
    if (c.sprite?.active) c.sprite.destroy();
  }

  // ─── Fish (#183) ───────────────────────────────────────────────────────────
  // A fish surfaces somewhere along the stream, darts a short way along the current
  // (a low-alpha shadow under the water), leaves a ripple, and vanishes. Purely
  // ambient — fire-and-forget; Phaser tears the sprite/tween down on scene shutdown.

  _scheduleFish(delay) {
    this.time.delayedCall(delay, () => {
      // Fish keep to the daylit phases (the water's too dark to read at night).
      if (!this._sleeping && this._phase !== 'Night' && this.streamPath?.length) {
        this._spawnFish();
        if (Math.random() < 0.25) this.time.delayedCall(Phaser.Math.Between(300, 900), () => this._spawnFish());
      }
      this._scheduleFish(Phaser.Math.Between(6000, 15000));
    });
  }

  _spawnFish() {
    const pts = this.streamPath;
    const p = pts[Phaser.Math.Between(0, pts.length - 1)];
    const upstream = Math.random() < 0.5 ? -1 : 1; // dart with or against the current
    const dx = p.tx * upstream, dy = p.ty * upstream;
    const dist = Phaser.Math.Between(36, 80);

    const fish = this.add.sprite(p.x - dx * dist * 0.5, p.y - dy * dist * 0.5, 'fish_0')
      .setOrigin(0.5, 0.5).setScale(WILD_SCALE).setDepth(-94).setAlpha(0).setFlipX(dx < 0)
      .play('fish_swim');
    this._fishRipple(fish.x, fish.y); // a ring where it surfaces

    this.tweens.add({
      targets: fish,
      x: fish.x + dx * dist, y: fish.y + dy * dist,
      alpha: { value: 0.55, duration: 500 },
      duration: Phaser.Math.Between(1600, 2800), ease: 'Sine.easeInOut',
      onComplete: () => {
        this._fishRipple(fish.x, fish.y); // …and another where it dives back down
        this.tweens.add({ targets: fish, alpha: 0, duration: 400, onComplete: () => fish.destroy() });
      },
    });
  }

  // A soft expanding ring on the water surface.
  _fishRipple(x, y) {
    const r = this.add.image(x, y, 'fishRipple').setScale(S * 0.5).setDepth(-94).setAlpha(0.7);
    this.tweens.add({ targets: r, scaleX: S, scaleY: S, alpha: 0, duration: 850, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
  }

  // ─── Birds (#182) ────────────────────────────────────────────────────────��─
  // Two visits, picked at random: a high fly-by across the sky, or a landing where the
  // bird hops and pecks the ground a few times before flushing. More frequent at dawn.

  _scheduleBirdVisit(delay) {
    this.time.delayedCall(delay, () => {
      if (!this._sleeping && this._phase !== 'Night') {
        if (Math.random() < 0.55) this._spawnFlyby();
        else this._spawnPerch();
      }
      // Birds are livelier in the morning, sparse otherwise.
      const morning = this._phase === 'Morning';
      this._scheduleBirdVisit(morning ? Phaser.Math.Between(3000, 8000) : Phaser.Math.Between(9000, 20000));
    });
  }

  _spawnFlyby() {
    const dir = Math.random() < 0.5 ? 1 : -1;            // 1 = left→right
    const y0 = Phaser.Math.Between(90, 300);
    const arc = Phaser.Math.Between(18, 60);
    const startX = dir === 1 ? -40 : WORLD_W + 40;
    const endX = dir === 1 ? WORLD_W + 40 : -40;
    const sprite = this.add.sprite(startX, y0, 'bird_fly_0')
      .setOrigin(0.5, 0.5).setScale(WILD_SCALE).setDepth(100000).setFlipX(dir === -1).play('bird_fly');
    const c = { sprite, kind: 'bird', ground: false, state: 'flying', tween: null };
    this._wildCritters.push(c);

    const prox = { p: 0 };
    c.tween = this.tweens.add({
      targets: prox, p: 1, duration: Phaser.Math.Between(6000, 9500), ease: 'Sine.easeInOut',
      onUpdate: () => {
        sprite.x = Phaser.Math.Linear(startX, endX, prox.p);
        sprite.y = y0 - Math.sin(Math.PI * prox.p) * arc;
      },
      onComplete: () => this._despawnCritter(c),
    });
  }

  _spawnPerch() {
    // A clear ground spot to land on, well inside the play bounds.
    let sx = 0, sy = 0;
    for (let i = 0; i < 12; i++) {
      sx = Phaser.Math.Between(BOUNDS.minX + 80, BOUNDS.maxX - 80);
      sy = Phaser.Math.Between(BOUNDS.minY + 40, BOUNDS.maxY - 40);
      if (!this._collides(sx, sy, 16, this.obstacles)) break;
    }
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, sy - 220, 'bird_fly_0')
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(sy).setFlipX(dir === -1).play('bird_fly');
    const c = { sprite, kind: 'bird', ground: false, state: 'descending', tween: null, fleeing: false };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > sx); // face the landing spot
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, sx, sy);
    c.tween = this.tweens.add({
      targets: sprite, x: sx, y: sy, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        sprite.play('bird_peck');
        this._perchHop(c, Phaser.Math.Between(3, 6));
      },
    });
  }

  // A perched bird hops + pecks `n` times, then flushes (flies off) on its own.
  _perchHop(c, n) {
    if (!c.sprite.active || c.state !== 'perched') return;
    if (n <= 0) { this._birdTakeOff(c); return; }
    const sprite = c.sprite;
    if (Math.random() < 0.4) sprite.setFlipX(!sprite.flipX); // hop turns it around
    c.tween = this.tweens.add({
      targets: sprite, y: sprite.y - 6, duration: 140, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(500, 1400), () => this._perchHop(c, n - 1)),
    });
  }

  // Flush a bird into the air toward the nearest side and despawn it (used both when
  // it finishes pecking and when the player startles it).
  _birdTakeOff(c) {
    if (c.fleeing || !c.sprite.active) return;
    c.fleeing = true; c.ground = false; c.state = 'leaving';
    if (c.tween) { c.tween.stop(); c.tween = null; }
    const sprite = c.sprite;
    sprite.play('bird_fly');
    const toLeft = sprite.x < WORLD_W / 2;
    sprite.setFlipX(toLeft);
    c.tween = this.tweens.add({
      targets: sprite,
      x: toLeft ? -60 : WORLD_W + 60, y: Phaser.Math.Between(80, 200),
      duration: Phaser.Math.Between(1800, 2800), ease: 'Sine.easeIn',
      onComplete: () => this._despawnCritter(c),
    });
  }

  // ─── Horse-back perch (#192) ────────────────────────────────────────────────
  // Occasionally a bird flies in and lands on a calm horse's back — a cozy oxpecker
  // moment. The bird tracks the host sprite frame-by-frame and flushes the instant
  // the horse starts moving or the player draws near.

  // (PERCH_Y is defined as a module constant below — static getters on anonymous
  //  mixin classes are not reachable by the class name at call sites.)

  _scheduleHorsePerch(delay) {
    this.time.delayedCall(delay, () => {
      if (!this._sleeping && this._phase !== 'Night') this._maybeSpawnHorsePerch();
      // A treat — infrequent so it stays charming.
      this._scheduleHorsePerch(Phaser.Math.Between(30000, 70000));
    });
  }

  _maybeSpawnHorsePerch() {
    const calm = (this.horses ?? []).filter((h) =>
      h.sprite?.active && !h.wanderTween &&
      (h.state === 'idle' || h.state === 'grazing' ||
       h.state === 'eating' || h.state === 'drinking')
    );
    if (!calm.length) return;

    // Prefer a horse that's visible in the camera so the event is seen.
    const view = this.cameras.main.worldView;
    const onScreen = calm.filter((h) =>
      h.sprite.x >= view.x - 80 && h.sprite.x <= view.x + view.width + 80 &&
      h.sprite.y >= view.y - 80 && h.sprite.y <= view.y + view.height + 300
    );
    const pool = onScreen.length ? onScreen : calm;
    this._spawnHorsePerch(pool[Phaser.Math.Between(0, pool.length - 1)]);
  }

  _spawnHorsePerch(horse) {
    const hx = horse.sprite.x, hy = horse.sprite.y;
    const tx = hx + Phaser.Math.Between(-8, 8);
    const ty = hy + PERCH_Y;

    // Enter from off the left or right edge of the camera view, angled down toward
    // the horse's back — same approach as the ground-perch swoop, not straight down.
    const view = this.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? view.x - 40 : view.x + view.width + 40;
    const startY = ty - Phaser.Math.Between(80, 160);

    const sprite = this.add.sprite(startX, startY, 'bird_fly_0')
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(hy + 1)
      .setFlipX(startX > tx).play('bird_fly');

    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, perchHost: horse,
                _lastHostX: hx, _lastHostY: hy };
    this._wildCritters.push(c);

    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: Phaser.Math.Between(1200, 1800), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active || c.fleeing) return;
        c.state = 'perched';
        sprite.play('bird_peck');
        this._horsePerchHop(c, Phaser.Math.Between(5, 9));
      },
    });
  }

  _horsePerchHop(c, n) {
    if (!c.sprite.active || c.fleeing || c.state !== 'perched') return;
    if (n <= 0) { this._birdTakeOff(c); return; }
    if (Math.random() < 0.3) c.sprite.setFlipX(!c.sprite.flipX);
    c.tween = this.tweens.add({
      targets: c.sprite, y: c.sprite.y - 5, duration: 120, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () =>
        this.time.delayedCall(Phaser.Math.Between(600, 1800), () => this._horsePerchHop(c, n - 1)),
    });
  }

  // ─── Raccoon (#181) ──────────────────────────────────────────────────────────
  // A raccoon scurries in from a side and ambles between the buildings/props (the
  // barn, coop, nests, gardens, feed sources, stand) — rummaging at each for a beat —
  // then scurries off. Skittish: bolts if the player gets close. Nocturnal: mostly
  // shows up in the evening and at night.

  _scheduleRaccoonVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Active at dusk/night; an occasional daytime cameo.
      const nocturnal = this._phase === 'Evening' || this._phase === 'Night';
      if (!this._sleeping && (nocturnal || Math.random() < 0.15)) {
        this._spawnRaccoon();
      }
      this._scheduleRaccoonVisit(nocturnal ? Phaser.Math.Between(12000, 28000) : Phaser.Math.Between(30000, 60000));
    });
  }

  _spawnRaccoon() {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -30 : WORLD_W + 30;
    const y = Phaser.Math.Between(BOUNDS.minY + 60, BOUNDS.maxY);
    const sprite = this.add.sprite(x, y, 'raccoon_idle_0')
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(y).setFlipX(!fromLeft).play('raccoon_run');
    const c = { sprite, kind: 'raccoon', ground: true, state: 'darting', tween: null, fleeing: false };
    this._wildCritters.push(c);
    // First dash brings it on-screen, then it potters between a few spots.
    const inX = fromLeft ? Phaser.Math.Between(200, 500) : WORLD_W - Phaser.Math.Between(200, 500);
    this._raccoonDartTo(c, inX, y, () => this._raccoonDart(c, Phaser.Math.Between(2, 4)));
  }

  // Quick dash to (tx,ty): play the run cycle, face the movement, then onArrive.
  _raccoonDartTo(c, tx, ty, onArrive) {
    if (!c.sprite.active) return;
    const sprite = c.sprite;
    sprite.setFlipX(tx < sprite.x);
    sprite.play('raccoon_run', true);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    // ms-per-pixel of travel (higher = slower). A calm amble — slower than a horse
    // (~11), not the blur it was before (was 3.4 ≈ 290px/s, which outran the player).
    // Tuned down twice on owner feedback (#181).
    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: Math.max(700, dist * 9), ease: 'Sine.easeInOut',
      onComplete: () => { c.tween = null; onArrive?.(); },
    });
  }

  // Potter: amble to a nearby building/prop, rummage a beat, repeat `n` times, leave.
  _raccoonDart(c, n) {
    if (!c.sprite.active || c.fleeing) return;
    if (n <= 0) { this._raccoonScurryOff(c); return; }
    const t = this._raccoonNextTarget(c);
    this._raccoonDartTo(c, t.x, t.y, () => {
      if (!c.sprite.active || c.fleeing) return;
      c.sprite.play('raccoon_idle', true); // pause and rummage at the building
      this.time.delayedCall(Phaser.Math.Between(1000, 3000), () => this._raccoonDart(c, n - 1));
    });
  }

  // Choose the raccoon's next stop: a *nearby* building/prop (so it ambles
  // building-to-building rather than teleporting across the map), with a little
  // jitter so it stands beside the prop, not on the same pixel. Falls back to a
  // random clear spot if no props are reachable.
  _raccoonNextTarget(c) {
    const near = this._raccoonPropTargets()
      .map((t) => ({ ...t, d: Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, t.x, t.y) }))
      .filter((t) => t.d > 50)          // don't re-pick the spot it's already at
      .sort((a, b) => a.d - b.d);
    if (near.length) {
      const base = near[Phaser.Math.Between(0, Math.min(3, near.length - 1))]; // one of the closest few
      const jx = Phaser.Math.Clamp(base.x + Phaser.Math.Between(-24, 24), BOUNDS.minX, BOUNDS.maxX);
      const jy = Phaser.Math.Clamp(base.y + Phaser.Math.Between(-16, 16), BOUNDS.minY, BOUNDS.maxY);
      return this._collides(jx, jy, 16, this.obstacles) ? { x: base.x, y: base.y } : { x: jx, y: jy };
    }
    // Fallback: a random nearby clear point.
    let tx = c.sprite.x, ty = c.sprite.y;
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2, r = Phaser.Math.Between(120, 320);
      tx = Phaser.Math.Clamp(c.sprite.x + Math.cos(ang) * r, BOUNDS.minX, BOUNDS.maxX);
      ty = Phaser.Math.Clamp(c.sprite.y + Math.sin(ang) * r, BOUNDS.minY + 40, BOUNDS.maxY);
      if (!this._collides(tx, ty, 16, this.obstacles)) break;
    }
    return { x: tx, y: ty };
  }

  // Grass spots just in front of the farm's buildings/props for the raccoon to rummage
  // at — south of each so it stands clear of the building's own collision footprint.
  // Clamped to the critter's roam band and filtered to genuinely walkable spots.
  _raccoonPropTargets() {
    const p = this.props, out = [];
    if (p.barn) out.push({ x: p.barn.x + 40, y: p.barn.y + 80 });
    if (p.coop) out.push({ x: p.coop.x, y: p.coop.y + 48 });
    for (const s of (p.sources ?? [])) out.push({ x: s.x, y: s.y + 36 }); // hay/gardens/grain/well
    for (const n of (p.nests ?? [])) out.push({ x: n.x, y: n.y + 24 });   // after the eggs…
    if (this.farmStand) out.push({ x: this.farmStand.x, y: this.farmStand.y + 42 });
    return out
      .map((t) => ({ x: Phaser.Math.Clamp(t.x, BOUNDS.minX, BOUNDS.maxX), y: Phaser.Math.Clamp(t.y, BOUNDS.minY, BOUNDS.maxY) }))
      .filter((t) => !this._collides(t.x, t.y, 16, this.obstacles));
  }

  // Bolt off the nearest side and despawn.
  _raccoonScurryOff(c) {
    if (c.fleeing || !c.sprite.active) return;
    c.fleeing = true; c.state = 'leaving';
    if (c.tween) { c.tween.stop(); c.tween = null; }
    const toLeft = c.sprite.x < WORLD_W / 2;
    this._raccoonDartTo(c, toLeft ? -40 : WORLD_W + 40, c.sprite.y, () => {
      this._despawnCritter(c);
    });
  }
};
