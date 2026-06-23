// Creatures: generic animal + chicken behavior, foals, and horse spawning +
// wandering/need-driven movement/rolling. Applied as a functional mixin so `this`
// is the scene. (Data-driven behavior-registry generalization is a later phase.)

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playNicker, playSqueal } from '../../audio/sounds.js';
import { BOUNDS, PASTURE_BOUNDS, S } from './constants.js';

export const WithCreatures = (Base) => class extends Base {
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
      const a = this.spawnAnimal(cx + ox, cy + oy, `chicken${i}`, 0.25, 8, 10, cx, cy, 180, 6, chickenModel);
      // Hold the flock hidden until the first phase change decides how they enter:
      // out of the coop in the morning, or already milling in the yard otherwise.
      // (Avoids a one-frame flash in the yard before they emerge from the coop.)
      a.state = 'roosting';
      a.sprite.setVisible(false);
      a.shadow.setVisible(false);
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    });

    this.time.addEvent({ delay: 2000, loop: true, callback: this.chickenTick, callbackScope: this });
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
                homeBounds: BOUNDS, bodyR: 11, wanderMin: 4000, wanderMax: 10000, tick: null,
                _eatPile: null, eatTimer: null, model };
    this.animals.push(a);
    this.scheduleCreatureWander(a, Phaser.Math.Between(500, 3000));
    return a;
  }

  // ─── Shared creature movement & wandering ────────────────────────────────
  // Every animal — horses, chickens, and anything spawned later — moves through
  // these helpers, so they all share the same obstacle avoidance, gate handling,
  // and pathfinding the player uses. Per-creature differences (body size, home,
  // pace, goals) live as fields on the creature object, set at spawn.

  // Walk a creature to (tx,ty), steering around obstacles via the A* pathfinder
  // (the same one tap-to-move uses), then call onArrive. The creature's own
  // obstacle list is used, so it ignores its own home (e.g. a chicken's coop).
  moveCreatureTo(a, tx, ty, onArrive) {
    a._pathTarget = { x: tx, y: ty };
    const path = this._findPath(a.sprite.x, a.sprite.y, tx, ty,
      { R: a.bodyR ?? 16, obstacles: this._obstaclesFor(a.key) });
    this._runPath(a, (path && path.length) ? path : [{ x: tx, y: ty }], onArrive);
  }

  // Pick a wander destination for a creature, returning { x, y, nicker? }. A
  // need-driven creature (a horse via _needTarget) biases toward whatever it
  // currently wants — food at the gate, the trough, a buddy. Otherwise: a clear
  // spot within its home radius if it has one (chickens stay near the coop), or
  // anywhere in its home bounds (horses roam the whole pasture).
  _pickWanderTarget(a) {
    const obsList = this._obstaclesFor(a.key);
    const b = a.homeBounds ?? BOUNDS;

    const pref = a.needTarget ? a.needTarget(a) : null;
    if (pref) {
      return {
        x: Phaser.Math.Clamp(pref.tx, b.minX, b.maxX),
        y: Phaser.Math.Clamp(pref.ty, b.minY, b.maxY),
        nicker: !!pref.nicker,
      };
    }

    if (a.homeX != null && a.wanderRadius != null) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * a.wanderRadius;
        const cx = Phaser.Math.Clamp(a.homeX + Math.cos(angle) * r, b.minX, b.maxX);
        const cy = Phaser.Math.Clamp(a.homeY + Math.sin(angle) * r, b.minY, b.maxY);
        if (!this._collides(cx, cy, 18, obsList)) return { x: cx, y: cy };
      }
      return { x: a.homeX, y: a.homeY };
    }
    const { tx, ty } = this._safeTarget(b.minX, b.maxX, b.minY, b.maxY,
                                        obsList, a.sprite.x, a.sprite.y);
    return { x: tx, y: ty };
  }

  // Queue a creature's next wander. On firing, give its optional goal-tick a
  // chance to redirect it (horses head for hay/water); otherwise it wanders.
  scheduleCreatureWander(a, delay) {
    this.time.delayedCall(delay, () => {
      if (this.isNight || a.state !== 'idle' || a._begTimer) return;
      if (a.tick && a.tick(a)) return;
      this.creatureWander(a);
    });
  }

  creatureWander(a) {
    if (!a.sprite.active || a.state !== 'idle') return;
    a.state = 'wandering';
    const target = this._pickWanderTarget(a);
    this.moveCreatureTo(a, target.x, target.y, () => {
      if (!a.sprite.active) return;
      a.sprite.play(`idle_${a.key}`, true);
      a.state = 'idle';
      // On arrival: greet the player if this was a "wait to be fed" trip,
      // otherwise let the creature settle (a relaxed horse may roll in the dirt).
      if (target.nicker) this._maybeNickerAtPlayer(a);
      else a.onSettle?.(a);
      this.scheduleCreatureWander(a, Phaser.Math.Between(a.wanderMin ?? 4000, a.wanderMax ?? 10000));
    });
  }

  // Back-compat aliases — older call sites still say schedule(Animal)Wander.
  scheduleAnimalWander(a, delay) { this.scheduleCreatureWander(a, delay); }
  scheduleWander(h, delay)       { this.scheduleCreatureWander(h, delay); }


  chickenTick() {
    if (this.isNight) return;
    const gateOpen = !!this.props.gate?.open;

    // A basket with seed in the active hand lures the whole flock — they trail
    // the player around hoping to be fed.
    const item = this.getActiveItem();
    const luring = !!this.player && item?.carrier === 'basket' &&
                   item.content === 'seed' && item.count > 0;

    // Fresh-morning anticipation: until they've been fed today, the chickens
    // crowd the grain bin waiting for breakfast.
    const grainBin = this.props.sources?.find(s => s.content === 'seed');
    const anticipating = this._phase === 'Morning' && !this._chickensFedToday && !!grainBin;

    for (const a of this.animals) {
      if (!a.key.startsWith('chicken')) continue;
      // Only redirect a chicken that's free to move — never yank one out of
      // eating, laying, roosting, or leaving the coop.
      if (!['idle', 'wandering', 'following', 'gathering'].includes(a.state)) continue;

      // Dropped seed on the ground always wins — go peck it.
      const pile = this._nearestReachableSeed(a, gateOpen);
      if (pile) { this.chickenGoEat(a, pile); continue; }

      // Otherwise follow a seed-carrying player, or crowd the bin in the morning.
      if (luring)            { this.chickenFollow(a); continue; }
      if (anticipating)      { this.chickenGatherAt(a, grainBin); continue; }

      // Nothing pulling at it anymore — resume ordinary wandering.
      if (a.state === 'following' || a.state === 'gathering') {
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(500, 2000));
      }
    }
  }

  // Nearest unclaimed seed pile this chicken can actually get to (seed inside the
  // pasture needs the gate open), or null.
  _nearestReachableSeed(a, gateOpen) {
    if (!this.props.seedPiles?.length) return null;
    let closest = null, closestDist = Infinity;
    for (const pile of this.props.seedPiles) {
      if (this.animals.some(o => o !== a && o._eatPile === pile)) continue; // 1 chicken per pile
      if (this._inPasture(pile.x, pile.y) && !gateOpen) continue;
      const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, pile.x, pile.y);
      if (d < closestDist) { closestDist = d; closest = pile; }
    }
    return closest;
  }

  // Trail along just behind the player. Each bird sits at its own angle so the
  // flock spreads into a loose cluster instead of stacking on one point. Only
  // re-paths when it has fallen behind, so a chicken keeping pace pecks in place.
  chickenFollow(a) {
    const p = this.player.sprite;
    const idx = a.key.charCodeAt(a.key.length - 1) || 0;
    const angle = idx * 1.3;
    const tx = p.x + Math.cos(angle) * 46;
    const ty = p.y + 30 + Math.sin(angle) * 22;

    a.state = 'following';
    const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, p.x, p.y);
    if (d < 70) { // close enough — settle and peck rather than re-path every tick
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
      a.sprite.play(`idle_${a.key}`, true);
      return;
    }
    // Don't restart an in-progress walk unless the player (and thus the target
    // spot) has drifted meaningfully — restarting every tick causes a lurch.
    if (a.wanderTween && a._pathTarget &&
        Phaser.Math.Distance.Between(a._pathTarget.x, a._pathTarget.y, tx, ty) < 24) return;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    this.moveCreatureTo(a, tx, ty, () => {
      if (a.state === 'following') a.sprite.play(`idle_${a.key}`, true);
    });
  }

  // Drift over to the grain bin and wait there in a loose arc. Each bird targets
  // a fixed spot, so once parked it stays put (no per-tick re-pathing) until it's
  // fed or the morning ends.
  chickenGatherAt(a, bin) {
    const idx = a.key.charCodeAt(a.key.length - 1) || 0;
    const angle = Math.PI * (0.2 + idx * 0.16);
    const r = 36 + (idx % 3) * 12;
    const tx = bin.x + Math.cos(angle) * r;
    const ty = bin.y + 20 + Math.sin(angle) * (r * 0.45);

    a.state = 'gathering';
    const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty);
    if (d < 18) { // already at its spot — just mill about
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
      a.sprite.play(`idle_${a.key}`, true);
      return;
    }
    // Already walking to this fixed spot — let the tween finish instead of
    // restarting it every tick (the restart is what made the flock lurch).
    if (a.wanderTween && a._pathTarget &&
        Phaser.Math.Distance.Between(a._pathTarget.x, a._pathTarget.y, tx, ty) < 4) return;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    this.moveCreatureTo(a, tx, ty, () => {
      if (a.state === 'gathering') a.sprite.play(`idle_${a.key}`, true);
    });
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
        this._chickensFedToday = true; // breakfast served — stop crowding the bin
        a._eatPile = null;
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(1000, 3000));
      });
    };

    // Pathfind to the seed, steering around obstacles and through the gate.
    this.moveCreatureTo(a, tx, ty, startPecking);
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

    // Pathfind to the nest. Nests are tagged home:'chicken', so they're absent
    // from the chicken's obstacle list — it can settle right onto the nest.
    this.moveCreatureTo(a, nest.x, nest.y, () => {
      if (a.state !== 'laying') { nest.occupant = null; return; }
      a.sprite.play(`idle_${a.key}`, true);

      // After a pause, lay the egg
      this.time.delayedCall(2800, () => {
        if (a.state !== 'laying') { nest.occupant = null; return; }
        nest.hasEgg = true;
        nest.occupant = null;
        nest.sprite.setTexture('nestEgg');
        a.state = 'idle';
        this.scheduleCreatureWander(a, Phaser.Math.Between(2000, 5000));
      });
    });
  }

  collectEgg(nest) {
    if (!nest.hasEgg) return;
    const item = this.getActiveItem();
    if (item?.carrier !== 'basket') return;
    // Strict contents: a basket already holding something else (or full) refuses.
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier('egg', 1) ?? 0;
    if (added <= 0) return;
    nest.hasEgg = false;
    nest.sprite.setTexture('nest');

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

    // Dust-splotch overlay — same transform as the sprite, alpha driven by the
    // grooming stat in depthSort() so a dirty horse visibly shows it. (issue #26)
    const dustOverlay = this.add.image(startX, startY, 'dustSplotches')
      .setOrigin(0.5, 1).setScale(S).setDepth(startY).setAlpha(0);
    // Wavy "stink" lines that float above a very dirty horse's back.
    const stinkOverlay = this.add.image(startX, startY - 66, 'stinkLines')
      .setOrigin(0.5, 1).setScale(S).setDepth(startY).setAlpha(0);

    const model = this.registry.get('allHorses')[key];
    // Horses share the same movement/wander helpers as every other animal; their
    // "home" is the whole pasture (no fixed point), and they get a goal-tick that
    // sends them to hay/water before falling back to a plain wander.
    const h = { sprite, shadow, key, state: 'idle', wanderTween: null, eatTimer: null,
                dustOverlay, stinkOverlay, _stinkPhase: Math.random() * 6.28,
                saddled: model?.saddled ?? false, saddleImg: null,
                homeX: null, homeY: null, wanderRadius: null, homeBounds: PASTURE_BOUNDS,
                bodyR: 16, tweenRate: 11, wanderMin: 2000, wanderMax: 5000,
                needTarget: (c) => this._needTarget(c),
                onSettle:   (c) => this._maybeRoll(c),
                tick:       (c) => this.horseTickForHorse(c) };
    this.horses.push(h);
    this.scheduleCreatureWander(h, wanderDelay);
    return h;
  }

  // ── Need-driven behavior (issue #26) ──────────────────────────────────────

  // Pick a wander target reflecting the horse's dominant current need, or null
  // to wander randomly. Returns { tx, ty, nicker? }. These signals fire whether
  // or not food/water is actually out — an expectant horse at an empty trough or
  // the gate is exactly the cue that tells the player to go provision.
  _needTarget(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return null;
    const pb = PASTURE_BOUNDS;

    // Neglected → sulk off alone in a corner, away from the herd.
    if (horse.neglected) {
      const leftSide = h.key.charCodeAt(h.key.length - 1) % 2 === 0;
      return {
        tx: leftSide ? pb.minX + 50 : pb.maxX - 50,
        ty: pb.maxY - Phaser.Math.Between(30, 70),
      };
    }

    // Hunger no longer biases the wander target: a hungry horse actively goes to
    // beg the player / gather at the gate via horseTickForHorse → _horseBeg, which
    // can path beyond the fence and lingers once it arrives. Keeping it out of the
    // wander target means an idle hungry horse no longer drifts to the gate on its
    // own when the player's nowhere near.

    // Thirsty with no water out → linger expectantly at the (empty) trough.
    // (When the trough is filled, horseTickForHorse already routes them to drink.)
    if (horse.stats.thirst < 45 && !this.props.trough?.filled && this.props.trough) {
      const t = this.props.trough;
      return { tx: t.x + Phaser.Math.Between(-55, 55), ty: t.y + Phaser.Math.Between(18, 40) };
    }

    // Content + bonded → hang out near a buddy (the herd look).
    if (horse.stats.happiness >= 70) {
      const buddy = this._nearestOtherHorse(h);
      if (buddy && Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? -1 : 1;
        return {
          tx: buddy.sprite.x + side * Phaser.Math.Between(45, 75),
          ty: buddy.sprite.y + Phaser.Math.Between(-18, 18),
        };
      }
    }

    return null;
  }

  _nearestOtherHorse(h) {
    let best = null, bestD = Infinity;
    for (const o of this.horses) {
      if (o === h || !o.sprite.active) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, o.sprite.x, o.sprite.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  // Friendly nicker when a horse reaches the gate hoping for food and the player
  // is nearby (throttled). Shy horses tend to stay quiet.
  _maybeNickerAtPlayer(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse || !this.player) return;
    const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.player.sprite.x, this.player.sprite.y);
    if (d > 360) return;
    const now = this.time.now;
    if (h._lastNicker && now - h._lastNicker < 6000) return;
    if (horse.temperament === 'shy' && Math.random() < 0.6) return;
    h._lastNicker = now;
    playNicker();
  }

  // ── Rolling in the dirt (issue #26) ───────────────────────────────────────
  // A relaxed horse occasionally flops for a roll — real horses self-groom this
  // way, and it's what leaves them dusty afterward. Rolls regardless of current
  // cleanliness (a dirty horse can still roll), so it stays a visible, recurring
  // behavior instead of stopping once a horse gets dirty.
  _maybeRoll(h) {
    if (this.isNight || h.state !== 'idle') return;
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return;
    const temp = horse.temperament;
    const chance = temp === 'spirited' ? 0.16 : temp === 'lazy' ? 0.14 : 0.07;
    if (Math.random() > chance) return;
    this._rollInDirt(h, horse);
  }

  _rollInDirt(h, horse) {
    h.state = 'rolling';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    const sprite = h.sprite;

    // Lie down (reusing the existing sleep / lying-down frames) and rock side to
    // side as if rolling, kicking up dust, then get back up. (issue #26 tweak)
    sprite.play(`sleep_${h.key}`, true);
    const baseAngle = sprite.angle;
    const rock = this.tweens.add({
      targets: sprite,
      angle: baseAngle + 8,
      duration: 240, yoyo: true, repeat: 4, ease: 'Sine.easeInOut',
    });

    // Dust thrown up across the roll.
    this._dustPuff(sprite.x, sprite.y);
    this.time.delayedCall(450, () => { if (h.state === 'rolling') this._dustPuff(sprite.x, sprite.y); });
    this.time.delayedCall(900, () => { if (h.state === 'rolling') this._dustPuff(sprite.x, sprite.y); });

    // Get back up.
    this.time.delayedCall(1300, () => {
      rock.stop();
      sprite.angle = baseAngle;
      if (h.state === 'rolling') {
        sprite.play(`idle_${h.key}`, true);
        h.state = 'idle';
        this.scheduleWander(h, Phaser.Math.Between(1500, 3500));
      }
    });

    // Rolling makes the horse dirtier → the dust overlay visibly darkens.
    horse.stats.grooming = Math.max(0, horse.stats.grooming - 18);
    this.game.events.emit(EVENTS.STATS_CHANGED);
  }

  _dustPuff(x, y) {
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(x + Phaser.Math.Between(-24, 24), y - Phaser.Math.Between(0, 18), 'dustPuff')
        .setScale(S * 0.6).setDepth(10000).setAlpha(0.85);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-18, 18),
        y: p.y - Phaser.Math.Between(10, 30),
        alpha: 0, scale: S,
        duration: Phaser.Math.Between(500, 850), ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // Greeting when the player engages a horse: a grumpy squeal + anger mark if it
  // was neglected (clears the moment you tend it), or a soft nicker otherwise.
  greetHorse(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return;
    if (horse.neglected) {
      playSqueal();
      this.showIcon('iconGrumpy', h.sprite);
      this._shake(h.sprite);
      return;
    }
    const now = this.time.now;
    if (h._lastNicker && now - h._lastNicker < 4000) return;
    h._lastNicker = now;
    playNicker();
  }

  _shake(sprite) {
    if (sprite._shaking) return;
    sprite._shaking = true;
    const x0 = sprite.x;
    this.tweens.add({
      targets: sprite, x: x0 + 6, duration: 60,
      yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
      onComplete: () => { sprite.x = x0; sprite._shaking = false; },
    });
  }

};
