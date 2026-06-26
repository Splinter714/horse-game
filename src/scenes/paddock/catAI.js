// Cat AI — the scene-coupled half of the cat's fishing behavior (#163). The pure
// decision (catFish.test) lives in data (src/data/species/cat/behaviors.js); this
// mixin holds the context snapshot it reads and the `run` primitive it triggers.
//
// A hungry cat has no farmer food, so it feeds itself: it pads to the nearest stream
// bank, crouches, and pounces at the water — sometimes catching a fish (restoring
// hunger, with a little catch flourish), sometimes missing (just a splash) — then
// resumes its prowl. Reuses the shared movement primitive (moveCreatureTo) and the
// stream's fish art/ripple from WithWildlife (_fishRipple, the `fish_0` texture).

import Phaser from 'phaser';
import { S } from './constants.js';
import { EVENTS } from '../../data/events.js';
import { playDrink } from '../../audio/sounds.js';

const EDGE_OFFSET = 46;  // stand this far down the field normal from the water centreline
const CATCH_CHANCE = 0.7; // odds a pounce lands a fish (misses add charm)
const CATCH_RESTORE = 38; // hunger restored by a caught fish

export const WithCatAI = (Base) => class extends Base {
  // Context snapshot for the cat's behavior `test`s (dispatched from behaviors.js).
  // Only what catFish needs: how hungry it is, whether a stream is reachable, and
  // whether it's night (the cat goes home to sleep then, so it shouldn't fish).
  _catContext(a) {
    const cat = a.model;
    const spot = this._nearestStreamSpot(a);
    const streamDist = spot
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, spot.x, spot.y)
      : Infinity;
    return {
      hunger: cat?.stats?.hunger ?? 100,
      streamDist,
      isNight: !!this.isNight,
    };
  }

  // The nearest stream bank the cat can fish from. Unlike the horses' drink anchor
  // (_nearestReachableWater, gated behind the pasture fence), the cat roams the open
  // field on the *same* side as the stream, so there's no gate gating — just the
  // closest water source carrying a bank centreline. Returns { x, y, bank, nrm } where
  // (x,y) is the standing spot at the grassy edge, or null if there's no stream.
  _nearestStreamSpot(a) {
    const srcs = this.props.sources?.filter((s) => s.content === 'water' && s.bank);
    if (!srcs?.length) return null;
    let best = null, bestD = Infinity;
    for (const s of srcs) {
      const x = s.bank[0] + s.nrm[0] * EDGE_OFFSET, y = s.bank[1] + s.nrm[1] * EDGE_OFFSET;
      const d = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, x, y);
      if (d < bestD) { bestD = d; best = { x, y, bank: s.bank, nrm: s.nrm }; }
    }
    return best;
  }

  // run() for catFish: claim the cat, walk it to the bank, then fish. Returns true
  // unless there's somehow no stream (then a lower behavior / wander gets a turn).
  catGoFish(a) {
    const spot = this._nearestStreamSpot(a);
    if (!spot) return false;

    a.state = 'fishing';
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }

    const faceLeft = spot.nrm[0] > 0; // the water lies opposite the field-ward normal
    this.moveCreatureTo(a, spot.x, spot.y, () => {
      if (a.state !== 'fishing' || !a.sprite.active) return;
      a.sprite.setFlipX(faceLeft);
      a.sprite.play(`idle_${a.key}`, true); // crouch and watch the water
      this._catFishAttempt(a, spot, 2);     // up to two pounces this trip
    });
    return true;
  }

  // One watch-then-pounce cycle. On a hit: catch a fish and finish; on a miss: a
  // splash and (if any tries remain) line up another pounce, else give up for now.
  _catFishAttempt(a, spot, tries) {
    if (a.state !== 'fishing' || !a.sprite.active) return;
    if (tries <= 0) { this._catFishDone(a); return; }

    this.time.delayedCall(Phaser.Math.Between(700, 1500), () => {
      if (a.state !== 'fishing' || !a.sprite.active) return;
      const [bx, by] = spot.bank;
      // Pounce: a quick lunge toward the water and back.
      const px = a.sprite.x - spot.nrm[0] * 16, py = a.sprite.y - spot.nrm[1] * 16;
      playDrink(); // splash
      this.tweens.add({
        targets: a.sprite, x: px, y: py, duration: 170, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => {
          if (a.state !== 'fishing' || !a.sprite.active) return;
          if (Math.random() < CATCH_CHANCE) {
            this._catCatchFish(a, bx, by);
            this._catFishDone(a);
          } else {
            this._fishRipple(bx, by); // missed — just a ring on the water
            this._catFishAttempt(a, spot, tries - 1);
          }
        },
      });
    });
  }

  // A successful catch: restore the cat's hunger, ripple the water, and flip a little
  // fish up from the surface toward the cat before it vanishes, with a happy heart.
  _catCatchFish(a, bx, by) {
    const cat = a.model;
    if (cat?.stats) {
      cat.stats.hunger = Math.min(100, (cat.stats.hunger ?? 0) + CATCH_RESTORE);
      this.game.events.emit(EVENTS.STATS_CHANGED);
    }
    this._fishRipple(bx, by);
    const fish = this.add.image(bx, by, 'fish_0')
      .setScale(S).setDepth(a.sprite.depth + 1).setAlpha(0.95).setFlipX(a.sprite.x < bx);
    this.tweens.add({
      targets: fish, x: a.sprite.x, y: a.sprite.y - 16, angle: 220,
      duration: 420, ease: 'Sine.easeOut',
      onComplete: () => this.tweens.add({ targets: fish, alpha: 0, duration: 220, onComplete: () => fish.destroy() }),
    });
    this.showHeart?.(a.sprite);
  }

  // Back to the prowl: stand up and schedule the next wander (which will send the cat
  // fishing again if it's still hungry).
  _catFishDone(a) {
    if (!a.sprite.active) return;
    a.sprite.play(`idle_${a.key}`, true);
    a.state = 'idle';
    this.scheduleAnimalWander(a, Phaser.Math.Between(1200, 2600));
  }
};
