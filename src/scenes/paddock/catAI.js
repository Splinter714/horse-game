// Cat AI — the scene-coupled half of the cat's fishing behavior (#163). The pure
// decision (catFish.test) lives in data (src/data/species/cat/behaviors.js); this
// mixin holds the context snapshot it reads and the `run` primitive it triggers.
//
// A hungry cat pads to the nearest stream bank, crouches, and pounces at the water —
// but it NEVER actually catches anything: each pounce is just a splash and a ripple,
// so no fish is ever harmed (#201). Fishing is purely a charming attempt; it does NOT
// feed the cat. The cat's real hunger/thirst sources are the dropped cat-food/
// cat-water piles from its food/water bowls (#202 refinement) — fishing is just a
// fallback distraction when nothing's out. Reuses the shared movement primitive
// (moveCreatureTo) and the stream's ripple from WithWildlife (_fishRipple).

import Phaser from 'phaser';
import { playDrink } from '../../audio/sounds.js';

const EDGE_OFFSET = 46;  // stand this far down the field normal from the water centreline

export const WithCatAI = (Base) => class extends Base {
  // Context snapshot for the cat's behavior `test`s (dispatched from behaviors.js).
  // What seekFood needs: how hungry it is + distance to the nearest reachable dropped
  // cat-food pile. What seekWater needs: how thirsty it is + distance to the nearest
  // reachable dropped cat-water pile. Both via the shared _nearestReachableHay lookup
  // (species-generic despite the filename), filtered to each content so the cat
  // doesn't confuse its food bowl's pile for its water bowl's (#202 refinement). What
  // catFish needs: whether a stream is reachable and whether it's night (the cat goes
  // home to sleep then, so it shouldn't fish).
  _catContext(a) {
    const cat = a.model;
    const spot = this._nearestStreamSpot(a);
    const streamDist = spot
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, spot.x, spot.y)
      : Infinity;
    const foodPile = this._nearestReachableHay(a, 'catFood');
    const nearestFoodDist = foodPile
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, foodPile.x, foodPile.y)
      : Infinity;
    const waterPile = this._nearestReachableHay(a, 'catWater');
    const nearestWaterDist = waterPile
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, waterPile.x, waterPile.y)
      : Infinity;
    return {
      hunger: cat?.stats?.hunger ?? 100,
      thirst: cat?.stats?.thirst ?? 100,
      nearestFoodDist,
      nearestWaterDist,
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
  // the cat. If pounces remain it lines up another, else it gives up for now. The
  // lunge itself now plays a real crouch→pounce pose (#198, catArt.js drawCatPounce)
  // instead of the plain idle "watching" frame, so the catch attempt reads as an
  // actual pounce, not a static crouch that just slides forward and back.
  _catFishAttempt(a, spot, tries) {
    if (a.state !== 'fishing' || !a.sprite.active) return;
    if (tries <= 0) { this._catFishDone(a); return; }

    this.time.delayedCall(Phaser.Math.Between(700, 1500), () => {
      if (a.state !== 'fishing' || !a.sprite.active) return;
      const [bx, by] = spot.bank;
      // Pounce: a quick lunge toward the water and back.
      const px = a.sprite.x - spot.nrm[0] * 16, py = a.sprite.y - spot.nrm[1] * 16;
      // One-shot pose swap (not a Phaser anim — a single frame is enough to read as
      // "lunging" for the short tween below). Stop the running idle anim first, or
      // its next tick would immediately overwrite the texture we just set. Falls
      // back to whatever's already playing (the idle crouch) if a species has no
      // pounce frame.
      if (this.textures.exists(`${a.key}_pounce_0`)) {
        a.sprite.anims.stop();
        a.sprite.setTexture(`${a.key}_pounce_0`);
      }
      playDrink(); // splash
      this.tweens.add({
        targets: a.sprite, x: px, y: py, duration: 170, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => {
          if (a.state !== 'fishing' || !a.sprite.active) return;
          this._fishRipple(bx, by);                 // always comes up empty — just a ring
          a.sprite.play(`idle_${a.key}`, true);      // back to the crouch-and-watch pose
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
