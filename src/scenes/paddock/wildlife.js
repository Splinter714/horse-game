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
import { S, BOUNDS } from './constants.js';
import { offscreenX, exitX, skyY } from './offscreen.js';
import { ART_SCALE } from '../../art/_frames.js';
import { wildlifeActiveInWeather } from '../../data/weather.js';
import { BIRD_TYPES, pickBirdType, shouldRaccoonBolt } from '../../data/wildlife.js';
import { birdTexKey, birdAnimKey } from '../../art/wildlifeArt.js';

// How close the player can get before a ground critter bolts (skittish). Birds in
// flight and fish ignore the player.
const FLEE_DIST = 200;

// The raccoon gets its own, much tighter flee radius (#191 playtest 2026-07-06: it
// bolted too easily/too far to actually watch it rummage). The player has to walk
// right up to it — closer than the general wildlife radius — before it scurries off.
const RACCOON_FLEE_DIST = 70;

// World-px above horse sprite.y (origin bottom) to reach the back/withers.
// FRAME_H=54, scale=2 → top of horse ≈ 108px up; back sits at ~64px up.
const PERCH_Y = -64;

// Display scale for the wildlife sprites: their textures are super-sampled on the
// ART_SCALE grid (wildlifeArt.js), so they show at S/ART_SCALE — same on-screen size
// as before, but crisp edges (matches the horse/sheep pipeline).
export const WILD_SCALE = S / ART_SCALE;

export const WithWildlife = (Base) => class extends Base {
  // ─── Setup ─────────────────────────────────────────────────────────────────

  buildWildlife() {
    this._wildCritters = []; // active birds/raccoons updateWildlife() manages

    // Animations (created once). Fish/birds flap; the raccoon scampers.
    const anim = (key, frames, frameRate) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate, repeat: -1 });
    };
    anim('fish_swim', ['fish_0', 'fish_1'], 3);
    // One fly/peck animation pair per bird type (visual variety, #220). The original
    // un-prefixed keys stay as the default sparrow for any older references.
    anim('bird_fly', ['bird_fly_0', 'bird_fly_1'], 10);
    anim('bird_peck', ['bird_peck_0', 'bird_peck_1'], 4);
    for (const t of BIRD_TYPES) {
      anim(birdAnimKey(t.id, 'fly'), [birdTexKey(t.id, 'fly', 0), birdTexKey(t.id, 'fly', 1)], 10);
      anim(birdAnimKey(t.id, 'peck'), [birdTexKey(t.id, 'peck', 0), birdTexKey(t.id, 'peck', 1)], 4);
      // Bathing (#366): a wing-flutter/ruffle shake, distinct from peck's head-bob.
      anim(birdAnimKey(t.id, 'bathe'), [birdTexKey(t.id, 'bathe', 0), birdTexKey(t.id, 'bathe', 1)], 8);
    }
    // Hummingbird (#226): a fast wing-buzz — two blur poses swapped quickly so the
    // wings read as a motion smear.
    anim('hummer_buzz', ['hummer_0', 'hummer_1'], 20);
    // Bee (#239): a fast wing-buzz, like the hummingbird's.
    anim('bee_buzz', ['bee_0', 'bee_1'], 18);
    anim('raccoon_idle', ['raccoon_idle_0', 'raccoon_idle_1'], 2);
    anim('raccoon_run', ['raccoon_run_0', 'raccoon_run_1', 'raccoon_run_2', 'raccoon_run_3'], 9);

    // Stagger the first appearance of each so they don't all pop in at once.
    this._scheduleFish(Phaser.Math.Between(3000, 8000));
    this._scheduleBirdVisit(Phaser.Math.Between(5000, 12000));
    this._scheduleRaccoonVisit(Phaser.Math.Between(8000, 20000));
    this._scheduleHorsePerch(Phaser.Math.Between(20000, 45000));
    // Object-anchored bird beats (bird bath #219, seed feeder #240, and the future
    // hummingbird/bee visits) live in the bird-ecosystem mixin, which owns those props.
    this.startBirdEcosystemVisits?.();
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

      // Ground critters depth-sort by their feet — EXCEPT birds perched up on a tall
      // prop (#340): their feet are far above the prop's own anchor, so sorting by
      // sprite.y would bury them behind the birdhouse/feeder/bath they're standing on.
      // Those spawn with an explicit depth of prop.y + 1 and keep it (`fixedDepth`).
      if (c.ground && !c.fixedDepth) c.sprite.setDepth(c.sprite.y);
      if (c.ground) {
        const dist = Phaser.Math.Distance.Between(px, py, c.sprite.x, c.sprite.y);
        if (c.kind === 'bird') {
          if (!c.fleeing && dist < FLEE_DIST) this._birdTakeOff(c);
        } else if (shouldRaccoonBolt({ fleeing: c.fleeing, dist, fleeDist: RACCOON_FLEE_DIST })) {
          this._raccoonScurryOff(c);
        }
      }
    }
  }

  // Rain gate (#188): ambient wildlife stays hidden while it's raining and returns
  // when it's fair. `this._weather` is set by the weather event; treat undefined
  // (before the first weather roll) as fair.
  _weatherAllowsWildlife() {
    return wildlifeActiveInWeather(this._weather ?? 'sun');
  }

  // Rain just started (called from onWeatherChange): send any critters currently
  // out for cover. Birds in flight/perched fly off; hummingbirds (#226) zip away;
  // ground raccoons scurry off. Fish are fire-and-forget tweens that fade on their
  // own, so they need no help.
  _clearWildlifeForRain() {
    for (const c of [...(this._wildCritters ?? [])]) {
      if (!c.sprite?.active) continue;
      if (c.kind === 'bird') { c.perchHost = null; this._birdTakeOff(c); }
      else if (c.kind === 'hummer') this._hummerLeave?.(c);
      else if (c.kind === 'bee') this._beeLeave?.(c);
      else this._raccoonScurryOff?.(c);
    }
  }

  // Pick a bird type (weighted by rarity, #220) and resolve its texture/animation keys
  // so a spawn can dress itself in one line. Purely cosmetic — no per-type behavior.
  _pickBird() {
    const t = pickBirdType();
    return {
      type: t,
      tex: birdTexKey(t.id, 'fly', 0),
      flyAnim: birdAnimKey(t.id, 'fly'),
      peckAnim: birdAnimKey(t.id, 'peck'),
      batheAnim: birdAnimKey(t.id, 'bathe'),
    };
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
      // Fish keep to the daylit phases (the water's too dark to read at night) and
      // stay down in the rain (#188).
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() && this.streamPath?.length) {
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
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife()) {
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
    // Enter/leave just past the CURRENT view, high in the on-screen sky (#354) — the
    // old fixed farm-edge numbers now sit mid-map thanks to the trail/town extensions.
    const y0 = skyY(this, Phaser.Math.Between);
    const arc = Phaser.Math.Between(18, 60);
    const startX = offscreenX(this, dir === 1);
    const endX = offscreenX(this, dir !== 1);
    const b = this._pickBird();
    const sprite = this.add.sprite(startX, y0, b.tex)
      .setOrigin(0.5, 0.5).setScale(WILD_SCALE).setDepth(100000).setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'flying', tween: null, bird: b };
    this._wildCritters.push(c);

    // Time the crossing by SPEED rather than a fixed duration: the span is now the
    // camera's width, not the whole farm, so a fixed 6–9.5s would read as slow motion.
    // (0.21–0.33 px/ms is what the old numbers worked out to across the old world.)
    const span = Math.abs(endX - startX);
    const speed = Phaser.Math.FloatBetween(0.21, 0.33);
    const prox = { p: 0 };
    c.tween = this.tweens.add({
      targets: prox, p: 1, duration: Phaser.Math.Clamp(span / speed, 2500, 12000), ease: 'Sine.easeInOut',
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
    const b = this._pickBird();
    // Swoop in from beyond the current view (and clear of the landing spot), #354.
    const sprite = this.add.sprite(offscreenX(this, dir === 1, 40, sx), sy - 220, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(sy).setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending', tween: null, fleeing: false, bird: b };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > sx); // face the landing spot
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, sx, sy);
    c.tween = this.tweens.add({
      targets: sprite, x: sx, y: sy, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        sprite.play(b.peckAnim);
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
    // A startle can interrupt the birdhouse enter/peek beats (#365) mid-shrink/fade —
    // restore full scale/alpha so a flushed bird always reads normally in flight.
    sprite.setScale(WILD_SCALE).setAlpha(1);
    sprite.play(c.bird?.flyAnim ?? 'bird_fly');
    // Leave past the nearer edge of the CURRENT view (#354) and climb as it goes —
    // the old exit tweened to a fixed sky y up at the farm's north end, which sent a
    // bird flushed down in the pasture streaking diagonally across the whole map.
    const exit = exitX(this, sprite.x);
    sprite.setFlipX(exit.toLeft);
    c.tween = this.tweens.add({
      targets: sprite,
      x: exit.x, y: sprite.y - Phaser.Math.Between(100, 220),
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
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife()) this._maybeSpawnHorsePerch();
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

    const b = this._pickBird();
    const sprite = this.add.sprite(startX, startY, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(hy + 1)
      .setFlipX(startX > tx).play(b.flyAnim);

    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, perchHost: horse, bird: b,
                _lastHostX: hx, _lastHostY: hy };
    this._wildCritters.push(c);

    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: Phaser.Math.Between(1200, 1800), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active || c.fleeing) return;
        c.state = 'perched';
        sprite.play(b.peckAnim);
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

  // ─── Raccoon (#181/#191) ─────────────────────────────────────────────────────
  // The raccoon's spawn/rummage/theft flow lives in its own concern mixin
  // (paddock/raccoon.js) — it grew big enough (trash-can rummaging + cosmetic loot)
  // to keep this file under the size budget. Both are composed onto the same scene,
  // so _raccoonScurryOff (called from updateWildlife above) resolves there.
};
