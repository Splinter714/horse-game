// Cross-animal charm behaviors (#187) — the scene-coupled `run` primitives for the
// little emergent "aww" moments layered on top of the need-driven AI. All purely
// cosmetic (no stat/mood effects) and lower priority than any need, so they never
// get in the way of care. Applied as a functional mixin so `this` is the scene; the
// pure decision tests live in each species' behaviors.js, and the night-settle hooks
// are called from dayNight.js (restAllAnimals / wakeAllAnimals).
//
// Spatial note: the dog & cat roam the north yard (BOUNDS) while the herd is penned
// in the south pasture (PASTURE_BOUNDS), with a fence between. The gate is the only
// crossing — when it's OPEN these behaviors path through it (the dog trots in among
// the sheep; the cat curls up with a resting horse), exactly like a horse heading out
// to the stream. When it's SHUT they stay on the reachable side (the dog postures at
// the fence and the sheep still bunch; the cat curls by the dog/barn). Gate state is
// read via _gateOpen() per bout, so it always matches the player's current setup.

import Phaser from 'phaser';
import { CHARM, BOUNDS, PASTURE_BOUNDS } from './constants.js';

export const WithCharm = (Base) => class extends Base {
  // ─── Shared lookups ────────────────────────────────────────────────────────

  _nearestDog(a) {
    let best = null, bd = Infinity;
    for (const o of this.animals) {
      if (o.model?.species !== 'dog' || !o.sprite.active) continue;
      const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, o.sprite.x, o.sprite.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Active sheep within `range` of agent `a` (the dog). Used by both the dog's
  // behavior context (_dogContext) and its run primitive.
  _sheepNear(a, range) {
    const out = [];
    for (const o of this.animals) {
      if (o.model?.species !== 'sheep' || !o.sprite.active) continue;
      if (Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, o.sprite.x, o.sprite.y) <= range) out.push(o);
    }
    return out;
  }

  // ─── Dog ↔ sheep (#187) ──────────────────────────────────────────────────��─

  // The dog ambles over toward a nearby sheep flock (pulling up at the fence on its
  // own side), gives a little bark-bounce, and the flock bunches up in response,
  // then the dog loses interest and wanders off. Returns true if it claimed the dog.
  dogGoHerd(a) {
    const flock = this._sheepNear(a, CHARM.HERD_RANGE);
    if (!flock.length) return false;
    const cx = flock.reduce((s, o) => s + o.sprite.x, 0) / flock.length;
    const cy = flock.reduce((s, o) => s + o.sprite.y, 0) / flock.length;

    // Head toward the flock, pulling up a little short. When the gate's OPEN the dog
    // can actually trot in among the sheep (moveCreatureTo paths it through the gate
    // gap, the same way a horse heads out to the stream); when it's SHUT, it postures
    // at the fence on its own side of the yard and the sheep still bunch in response.
    const dx = cx - a.sprite.x, dy = cy - a.sprite.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.max(0, d - CHARM.HERD_STANDOFF);
    let tx = a.sprite.x + (dx / d) * reach;
    let ty = a.sprite.y + (dy / d) * reach;
    if (this._gateOpen()) {
      tx = Phaser.Math.Clamp(tx, PASTURE_BOUNDS.minX, PASTURE_BOUNDS.maxX);
      ty = Phaser.Math.Clamp(ty, BOUNDS.minY, PASTURE_BOUNDS.maxY);
    } else {
      tx = Phaser.Math.Clamp(tx, BOUNDS.minX, BOUNDS.maxX);
      ty = Phaser.Math.Clamp(ty, BOUNDS.minY, BOUNDS.maxY);
    }

    a.state = 'herding';
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    this.moveCreatureTo(a, tx, ty, () => {
      if (a.state !== 'herding' || !a.sprite.active) return;
      a.sprite.setFlipX(cx < a.sprite.x);
      a.sprite.play(`idle_${a.key}`, true);
      this.hop?.(a.sprite); // a little bark-bounce
      this._sheepBunch(this._sheepNear(a, CHARM.HERD_RANGE), cx, cy);
      a._lastHerd = this.time.now;
      // Lose interest after a beat and saunter off.
      this.time.delayedCall(Phaser.Math.Between(1200, 2200), () => {
        if (a.state !== 'herding' || !a.sprite.active) return;
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(800, 1800));
      });
    });
    return true;
  }

  // Startled sheep bunch toward the flock centre with a quick hop. Only nudges sheep
  // that are free (idle/wandering) so it never yanks one out of eating or drinking;
  // leaves their state 'idle' so the grazing AI carries on right after.
  _sheepBunch(flock, cx, cy) {
    for (const s of flock) {
      if (!s.sprite.active) continue;
      if (s.state !== 'idle' && s.state !== 'wandering') continue;
      if (s.wanderTween) { s.wanderTween.stop(); s.wanderTween = null; }
      s.state = 'idle';
      const dx = cx - s.sprite.x, dy = cy - s.sprite.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = Phaser.Math.Clamp(s.sprite.x + (dx / d) * CHARM.SHEEP_BUNCH, PASTURE_BOUNDS.minX, PASTURE_BOUNDS.maxX);
      const ny = Phaser.Math.Clamp(s.sprite.y + (dy / d) * CHARM.SHEEP_BUNCH, PASTURE_BOUNDS.minY, PASTURE_BOUNDS.maxY);
      s.sprite.setFlipX(dx < 0);
      s.sprite.play(`walk_${s.key}`, true);
      this.tweens.add({
        targets: s.sprite, x: nx, y: ny, duration: 320, ease: 'Quad.easeOut',
        onComplete: () => { if (s.sprite.active && s.state === 'idle') s.sprite.play(`idle_${s.key}`, true); },
      });
    }
  }

  // ─── Chickens scatter from a passing dog (#187) ─────────────────────────────

  // A chicken bolts a short way directly away from the nearest dog, then settles.
  chickenScatterFrom(a) {
    const dog = this._nearestDog(a);
    if (!dog) return false;
    const dx = a.sprite.x - dog.sprite.x, dy = a.sprite.y - dog.sprite.y;
    const d = Math.hypot(dx, dy) || 1;
    const tx = Phaser.Math.Clamp(a.sprite.x + (dx / d) * CHARM.SCATTER_RUN, BOUNDS.minX, BOUNDS.maxX);
    const ty = Phaser.Math.Clamp(a.sprite.y + (dy / d) * CHARM.SCATTER_RUN, BOUNDS.minY, BOUNDS.maxY);

    a.state = 'fleeing';
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    this.moveCreatureTo(a, tx, ty, () => {
      if (a.state !== 'fleeing' || !a.sprite.active) return;
      a.sprite.play(`idle_${a.key}`, true);
      a.state = 'idle';
      this.scheduleAnimalWander(a, Phaser.Math.Between(600, 1600));
    });
    return true;
  }

  // ─── Pig sunbathe flop (onSettle, wired by the `sunbathes` capability) ───────

  // A daytime onSettle nap, mirroring the horse roll / chicken peck: a content pig
  // occasionally flops for a sunbathe when it finishes a wander. No lying-down art
  // for the pig, so the "flop" reads as a cozy squash + drifting Zzz.
  _maybePigNap(a) {
    if (this.isNight || a.state !== 'idle') return;
    if (Math.random() > CHARM.PIG_NAP_CHANCE) return;
    a.state = 'napping';
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    a.sprite.play(`idle_${a.key}`, true);
    this._charmNap(a);
    this.time.delayedCall(Phaser.Math.Between(CHARM.NAP_MS[0], CHARM.NAP_MS[1]), () => {
      if (a.state !== 'napping' || !a.sprite.active) return;
      this._endCharmNap(a);
      a.state = 'idle';
      this.scheduleAnimalWander(a, Phaser.Math.Between(1500, 3500));
    });
  }

  // ─── Shared nap visuals (pig flop + cat curl) ───────────────────────────────

  // Settle a sprite into a cozy nap: a gentle squash (no lying-down art needed) and
  // a slow loop of drifting Zzz. Reversed by _endCharmNap.
  _charmNap(a) {
    a._napScale = { x: a.sprite.scaleX, y: a.sprite.scaleY };
    a.sprite.setScale(a.sprite.scaleX * 1.1, a.sprite.scaleY * 0.82);
    this._napZzz(a);
    a._napZzzTimer = this.time.addEvent({ delay: 1300, loop: true, callback: () => this._napZzz(a) });
  }

  _endCharmNap(a) {
    if (!a) return;
    if (a._napZzzTimer) { this.time.removeEvent(a._napZzzTimer); a._napZzzTimer = null; }
    if (a._napScale) { a.sprite.setScale(a._napScale.x, a._napScale.y); a._napScale = null; }
  }

  _napZzz(a) {
    if (!a.sprite.active) return;
    const z = this.add.text(a.sprite.x + 14, a.sprite.y - 40, 'z', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(10000).setAlpha(0.85);
    this.tweens.add({
      targets: z, y: z.y - 28, x: z.x + 12, alpha: 0,
      duration: 1400, ease: 'Sine.easeOut', onComplete: () => z.destroy(),
    });
  }

  // ─── Horses head-to-tail fly-swatting (#187) ────────────────────────────────

  // A real tail-swish on the head-to-tail buddy pose: play the baked swish frames
  // (the tail swinging side to side — no body tilt) for a short bout, then settle
  // back to idle. Skipped if the horse has no swish anim (foals) or isn't idle.
  _charmTailSwish(h) {
    if (!h?.sprite?.active || h.state !== 'idle') return;
    if (!this.anims.exists(`swish_${h.key}`)) return;
    h.sprite.play(`swish_${h.key}`, true);
    this.time.delayedCall(Phaser.Math.Between(1600, 2600), () => {
      // Only hand back to idle if nothing else took over (still standing, still idle).
      if (h.sprite.active && h.state === 'idle' &&
          h.sprite.anims.currentAnim?.key === `swish_${h.key}`) {
        h.sprite.play(`idle_${h.key}`, true);
      }
    });
  }

  // ─── Night settling: the barnyard beds down together (#187) ─────────────────

  // Called per animal from restAllAnimals at nightfall. Horses are the herd centre —
  // they bed down where they stand. Other pasture animals (sheep/pig/cow) drift in to
  // join the herd; the dog beds down near the barn. A cozy "settle together" without
  // dragging the whole herd around.
  _settleAnimalForNight(a) {
    this._endCharmNap(a); // tidy up any in-progress daytime nap first
    if (this.horses.includes(a) || Math.random() > CHARM.CLUSTER_CHANCE) {
      this._restAnimalInPlace(a);
      return;
    }
    const anchor = this._nightHuddleAnchor(a);
    const b = a.homeBounds ?? BOUNDS;
    const tx = Phaser.Math.Clamp(anchor.x + Phaser.Math.Between(-60, 60), b.minX, b.maxX);
    const ty = Phaser.Math.Clamp(anchor.y + Phaser.Math.Between(-45, 45), b.minY, b.maxY);
    if (Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty) < 70) {
      this._restAnimalInPlace(a);
      return;
    }
    a.state = 'settling';
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    this.moveCreatureTo(a, tx, ty, () => {
      if (!a.sprite.active) return;
      if (!this.isNight) { a.state = 'idle'; this.scheduleAnimalWander(a, Phaser.Math.Between(300, 1500)); return; }
      this._restAnimalInPlace(a);
    });
  }

  // The cozy huddle centre for animal `a`: pasture animals gather toward the horse-
  // herd centroid; yard roamers (the dog) bed down near the barn.
  _nightHuddleAnchor(a) {
    const b = a.homeBounds ?? BOUNDS;
    if (b === PASTURE_BOUNDS) {
      const hs = this.horses.filter((h) => h.sprite.active);
      if (!hs.length) return { x: a.sprite.x, y: a.sprite.y };
      return {
        x: hs.reduce((s, h) => s + h.sprite.x, 0) / hs.length,
        y: hs.reduce((s, h) => s + h.sprite.y, 0) / hs.length,
      };
    }
    const e = this._barnEntry();
    return { x: e.x, y: e.y + 40 };
  }

  // ─── Cat curls up for the night (#187) ──────────────────────────────────────

  // Instead of slipping into the barn, the cat sometimes curls up outside by the
  // nearest resting companion in its own yard (the dog), or just by the barn — a
  // cozy night beat. Stays curled (squash + Zzz) until morning wake.
  catCurlUp(a) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    a._eatPile = null;

    const buddy = this._nearestRestingCompanion(a);
    let spot;
    if (buddy) {
      const side = buddy.sprite.x < a.sprite.x ? 26 : -26;
      spot = { x: buddy.sprite.x + side, y: buddy.sprite.y + 6 };
    } else {
      const e = this._barnEntry();
      spot = { x: e.x + 34, y: e.y + 16 };
    }

    a.state = 'curling';
    this.moveCreatureTo(a, spot.x, spot.y, () => {
      if (!a.sprite.active) return;
      if (!this.isNight) { a.state = 'idle'; this.scheduleAnimalWander(a, 500); return; }
      a.state = 'curled';
      a.sprite.setFlipX(false);
      a.sprite.play(`idle_${a.key}`, true);
      this._charmNap(a); // squash + drifting Zzz; restored at morning wake (wakeAllAnimals)
    });
  }

  // Nearest animal (or horse) bedding down that the cat can actually reach for a
  // cuddle: anything in its own yard, plus — when the gate's open — a resting horse
  // across in the pasture (the cat pads through the open gate to curl up with the
  // herd). A shut gate keeps it to yard companions (typically the dog).
  _nearestRestingCompanion(a) {
    const gateOpen = this._gateOpen();
    const catYard = a.sprite.y < PASTURE_BOUNDS.minY;
    let best = null, bd = Infinity;
    const consider = (o) => {
      if (o === a || !o.sprite.active) return;
      if (!['resting', 'settling', 'curled'].includes(o.state)) return;
      const oYard = o.sprite.y < PASTURE_BOUNDS.minY;
      if (oYard !== catYard && !gateOpen) return; // across a shut fence — unreachable
      const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, o.sprite.x, o.sprite.y);
      if (d < bd) { bd = d; best = o; }
    };
    for (const o of this.animals) consider(o);
    for (const o of this.horses) consider(o); // a resting horse is a fine cuddle buddy when reachable
    return best;
  }
};
