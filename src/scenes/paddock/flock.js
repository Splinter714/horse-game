// Flock: the chicken-specific behavior split out of creatures.js (#169) — the 2s
// flock driver, seed-pile pecking, following/gathering primitives, egg laying and
// collection. The per-bird AI *decision* is data-driven (the chicken species'
// `behaviors` list, walked by WithBehaviors); these are the movement/animation
// primitives those behaviors reuse. Applied as a functional mixin so `this` is the
// scene; relies on the shared movement helpers in creatures.js (moveCreatureTo,
// scheduleCreatureWander).

import Phaser from 'phaser';
import { playPeck, playGather } from '../../audio/sounds.js';

export const WithFlock = (Base) => class extends Base {
  // The 2s flock driver. The per-bird decision (peck dropped seed → follow a
  // seed-carrying player → crowd the grain bin) is now data-driven: the chicken
  // species' `behaviors` list is walked by the generic dispatcher (WithBehaviors /
  // behaviors.js), which reuses chickenGoEat/chickenFollow/chickenGatherAt below.
  chickenTick() {
    if (this.isNight) return;
    for (const a of this.animals) {
      if (!a.key.startsWith('chicken')) continue;
      // Only redirect a chicken that's free to move — never yank one out of
      // eating, laying, roosting, or leaving the coop.
      if (!['idle', 'wandering', 'following', 'gathering'].includes(a.state)) continue;

      if (this.runBehaviors(a)) continue;

      // Nothing pulling at it anymore — resume ordinary wandering.
      if (a.state === 'following' || a.state === 'gathering') {
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(500, 2000));
      }
    }
  }

  // Nearest seed pile this chicken can actually get to (seed inside the pasture
  // needs the gate open), or null. A pile feeds several birds (`feedsLeft`), so a
  // dropped pile draws a crowd to peck rather than locking to one chicken while the
  // rest trail the player — which read as "ignoring the food" (#128 follow-up).
  _nearestReachableSeed(a, gateOpen) {
    if (!this.props.seedPiles?.length) return null;
    let closest = null, closestDist = Infinity;
    for (const pile of this.props.seedPiles) {
      const eaters = this.animals.filter(o => o !== a && o._eatPile === pile).length;
      if (eaters >= (pile.feedsLeft ?? 1)) continue; // pile's feeds are all spoken for
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
    if (d < 18) { // already at its spot — mill about, with the odd eager peck (#128)
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
      if (a._pecking) return;
      if (Phaser.Math.FloatBetween(0, 1) < 0.25) this.chickenPeck(a);
      else a.sprite.play(`idle_${a.key}`, true);
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

  // A quick ground-peck: dip into the pecking animation with a soft peck sound,
  // then settle back. Occasional liveliness while a chicken waits, unfed, at the
  // grain bin (#128) or pauses between wanders (#130). Never interrupts a walk.
  chickenPeck(a) {
    if (!a.sprite.active || a._pecking || a.wanderTween) return;
    if (a.state !== 'idle' && a.state !== 'gathering') return;
    a._pecking = true;
    a.sprite.play(`eat_${a.key}`, true); // the pecking frames
    // No sound: this is an autonomous/ambient peck (between wanders, idling at the
    // bin). Per #148 only player-initiated care makes noise — the peck still shows
    // visually, and the directed eating peck (chickenGoEat) keeps its sound.
    this.time.delayedCall(Phaser.Math.Between(360, 560), () => {
      a._pecking = false;
      if (a.sprite.active && (a.state === 'idle' || a.state === 'gathering')) {
        a.sprite.play(`idle_${a.key}`, true);
      }
    });
  }

  // onSettle hook for chickens: a low-odds peck when one finishes a wander, so the
  // flock feels alive without pecking constantly (#130). (Horses settle by rolling.)
  _maybeChickenPeck(a) {
    if (Phaser.Math.FloatBetween(0, 1) < 0.35) this.chickenPeck(a);
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

      // Light, repeated peck taps spread across the eating window so it reads
      // by ear. Cleared if the chicken stops eating early.
      a.peckTimer = this.time.addEvent({
        delay: 460, loop: true,
        callback: () => {
          if (a.state !== 'eating') { a.peckTimer?.remove(); a.peckTimer = null; return; }
          playPeck();
        },
      });
      playPeck();

      a.eatTimer = this.time.delayedCall(2200, () => {
        a.eatTimer = null;
        a.peckTimer?.remove();
        a.peckTimer = null;
        if (a.state !== 'eating') return;
        // Take one feed from the pile; only clear it once it's exhausted (it can be
        // shared by several birds now, so one bite needn't empty it).
        pile.feedsLeft = (pile.feedsLeft ?? 1) - 1;
        if (pile.feedsLeft <= 0 && pile.sprite.active) {
          pile.sprite.destroy();
          this.props.seedPiles = this.props.seedPiles.filter(p => p !== pile);
        }
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
      // Settle onto the nest (a brief squat) instead of just standing idle while
      // the egg timer runs (#196), so laying visibly reads as its own beat.
      a.sprite.play(`lay_${a.key}`, true);

      // After a pause, lay the egg
      this.time.delayedCall(2800, () => {
        if (a.state !== 'laying') { nest.occupant = null; return; }
        nest.hasEgg = true;
        nest.occupant = null;
        nest.sprite.setTexture('nestEgg');
        a.sprite.play(`idle_${a.key}`, true); // back up off the nest before wandering off
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
    playGather('egg'); // soft pick-up / gentle clink
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

};
