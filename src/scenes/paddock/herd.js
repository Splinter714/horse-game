// Herd: the horse-specific need-driven wandering, herd dynamics, rolling, and
// greeting split out of creatures.js (#169). These layer on top of the shared
// movement primitives in creatures.js — a horse's goal-tick (_needTarget) and
// settle hook (_maybeRoll) are wired in spawnHorse. Applied as a functional mixin
// so `this` is the scene.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playNicker, playSqueal } from '../../audio/sounds.js';
import { PASTURE_BOUNDS, S, HERD } from './constants.js';

export const WithHerd = (Base) => class extends Base {
  // ── Need-driven behavior (issue #26) ──────────────────────────────────────

  // Pick a wander target reflecting the horse's dominant current need, or null
  // to wander randomly. Returns { tx, ty, nicker? }. These signals fire whether
  // or not food/water is actually out — an expectant horse at an empty trough or
  // the gate is exactly the cue that tells the player to go provision.
  _needTarget(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return null;
    // (A grumpy/neglected horse no longer sulks off to a corner away from the player
    // — it wanders normally and just voices its grumpiness on approach/interact, #150.)

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

    // Content + bonded → go stand head-to-tail with a buddy (the classic herd
    // "fly-swatting" pose). Pull up close alongside, just fore or aft for a bit
    // of depth offset; the opposite facing is applied on arrival in creatureWander
    // → _faceHeadToTail. Stands just outside HERD.SEP_MIN so the gentle idle
    // separation doesn't immediately tease the pair back apart.
    if (horse.stats.happiness >= HERD.HAPPY_AT) {
      const buddy = this._nearestOtherHorse(h);
      if (buddy && buddy.sprite.active && Math.random() < HERD.PAIR_CHANCE) {
        const aft = Math.random() < 0.5 ? -1 : 1;
        return {
          tx: buddy.sprite.x + Phaser.Math.Between(-14, 14),
          ty: buddy.sprite.y + aft * Phaser.Math.Between(HERD.STAND_GAP, HERD.STAND_GAP + 10),
          pairWith: buddy,
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

  // Arrived alongside a buddy → turn to face the opposite way so the two stand
  // nose-to-tail. Bail quietly if the buddy wandered off while we were walking up.
  _faceHeadToTail(h, buddy) {
    if (!buddy.sprite.active) return;
    h.sprite.setFlipX(!buddy.sprite.flipX);
    // (The head-to-tail pose is the moment; an added angle-wobble "tail swish"
    // tilted the whole bottom-origin sprite and read as teetering, so it was
    // removed (#187). A real tail-swish needs separated tail art.)
  }

  // Keep idle horses from collapsing into one overlapping blob: any two standing
  // closer than HERD.SEP_MIN drift apart by a tiny capped step, so a resting
  // cluster reads as several distinct horses. Only nudges horses that are actually
  // standing still (no active tween) so it never fights a walk/eat/drink trip;
  // a horse mid-move holds its line and its idle neighbour gives way. Buddies
  // standing head-to-tail sit just outside SEP_MIN, so the herd pose survives.
  separateHorses() {
    const { SEP_MIN, SEP_PUSH } = HERD;
    const free = (h) => h.sprite.active && !h.wanderTween &&
      (h.state === 'idle' || h.state === 'resting');
    for (let i = 0; i < this.horses.length; i++) {
      const a = this.horses[i];
      if (!a.sprite.active) continue;
      for (let j = i + 1; j < this.horses.length; j++) {
        const b = this.horses[j];
        if (!b.sprite.active) continue;
        let dx = a.sprite.x - b.sprite.x;
        let dy = a.sprite.y - b.sprite.y;
        let d = Math.hypot(dx, dy);
        if (d >= SEP_MIN) continue;
        const aFree = free(a), bFree = free(b);
        if (!aFree && !bFree) continue; // both busy → leave them to their tweens
        if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy) || 1; }
        const step = Math.min((SEP_MIN - d) * 0.5, SEP_PUSH);
        const ux = (dx / d) * step, uy = (dy / d) * step;
        // Whoever's free moves; if only one is free it takes the whole step.
        if (aFree && bFree) { this._nudgeHorse(a, ux, uy); this._nudgeHorse(b, -ux, -uy); }
        else if (aFree)     { this._nudgeHorse(a, ux * 2, uy * 2); }
        else                { this._nudgeHorse(b, -ux * 2, -uy * 2); }
      }
    }
  }

  _nudgeHorse(h, dx, dy) {
    const R = h.bodyR ?? 16;
    const nx = Phaser.Math.Clamp(h.sprite.x + dx, PASTURE_BOUNDS.minX, PASTURE_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(h.sprite.y + dy, PASTURE_BOUNDS.minY, PASTURE_BOUNDS.maxY);
    if (!this._collides(nx, h.sprite.y, R)) h.sprite.x = nx;
    if (!this._collides(h.sprite.x, ny, R)) h.sprite.y = ny;
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
    const roll = this._movementFor(horse.species).roll ?? {};
    const chance = roll[horse.temperament] ?? roll.default ?? 0;
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

  // Greeting when the player engages a horse: a sad squeal + a little shake if it
  // was neglected (clears the moment you tend it), or a soft nicker otherwise.
  greetHorse(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return;
    if (horse.neglected) {
      playSqueal();
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
