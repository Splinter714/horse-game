// Cat AI — the scene-coupled half of the cat's fishing behavior (#163). The pure
// decision (catFish.test) lives in data (src/data/species/cat/behaviors.js); this
// mixin holds the context snapshot it reads and the `run` primitive it triggers.
//
// A hungry cat pads to the nearest stream bank, crouches, and pounces at the water —
// but it NEVER actually catches anything: each pounce is just a splash and a ripple,
// so no fish is ever harmed (#201). Fishing is now purely a charming attempt; it does
// NOT feed the cat. Fishing was the cat's only food source, so until a real feeding
// mechanic lands (follow-up #202) the cat has nothing to restore its hunger — it'll
// sit low and the cat keeps trying at the stream by design. Reuses the shared movement
// primitive (moveCreatureTo) and the stream's ripple from WithWildlife (_fishRipple).

import Phaser from 'phaser';
import { playDrink } from '../../audio/sounds.js';

const EDGE_OFFSET = 46;  // stand this far down the field normal from the water centreline

export const WithCatAI = (Base) => class extends Base {
  // Context snapshot for the cat's behavior `test`s (dispatched from behaviors.js).
  // What seekFood needs: how hungry it is + distance to the nearest reachable dropped
  // fish pile (#202, via the shared _nearestReachableHay lookup — species-generic
  // despite the filename). What catFish needs: whether a stream is reachable and
  // whether it's night (the cat goes home to sleep then, so it shouldn't fish).
  _catContext(a) {
    const cat = a.model;
    const spot = this._nearestStreamSpot(a);
    const streamDist = spot
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, spot.x, spot.y)
      : Infinity;
    const pile = this._nearestReachableHay(a);
    const nearestFishDist = pile
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, pile.x, pile.y)
      : Infinity;
    return {
      hunger: cat?.stats?.hunger ?? 100,
      nearestFishDist,
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

  // One watch-then-pounce cycle. The cat always comes up empty (#201): a splash and a
  // ripple, never a caught fish — so nothing is ever harmed and fishing doesn't feed
  // the cat. If pounces remain it lines up another, else it gives up for now.
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
          this._fishRipple(bx, by);                 // always comes up empty — just a ring
          this._catFishAttempt(a, spot, tries - 1);
        },
      });
    });
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
