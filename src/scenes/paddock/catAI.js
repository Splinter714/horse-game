// Cat AI — the scene-coupled half of the cat's feeding/fishing behaviors (#163/#202).
// The pure decisions (seekFood/seekWater/catFish `test`) live in data
// (src/data/species/cat/behaviors.js); this mixin holds the context snapshot they
// read and the `run` primitives they trigger.
//
// #202 rework — the cat eats and drinks DIRECTLY from its food + water bowls: a
// hungry/thirsty cat walks to a stocked bowl and consumes a serving from it
// (catEatFromBowl), lowering the bowl's level. The player's job is to keep the bowls
// filled (worldObjects.js fillCatBowl). Only when NO bowl has food does a hungry cat
// fall back to the stream, where it pads to the bank, crouches, and pounces — but it
// NEVER catches anything: each pounce is just a splash and a ripple, so no fish is
// ever harmed (#201) and fishing does NOT feed the cat. Reuses the shared movement
// primitive (moveCreatureTo) and the stream's ripple from WithWildlife (_fishRipple).

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { drainBowlLevel, bowlHasFood } from '../../data/bowls.js';
import { playEat, playDrink } from '../../audio/sounds.js';

const EDGE_OFFSET = 46;  // stand this far down the field normal from the water centreline

export const WithCatAI = (Base) => class extends Base {
  // Context snapshot for the cat's behavior `test`s (dispatched from behaviors.js).
  // #202 rework — seekFood/seekWater now read the distance to the cat's FOOD/WATER
  // BOWL, but only when that bowl is actually STOCKED (level > 0); an empty bowl reads
  // as Infinity so a hungry cat falls through to fishing (food) or just wanders
  // (water) rather than pacing an empty dish. catFish still needs whether a stream is
  // reachable and whether it's night (the cat goes home to sleep then).
  _catContext(a) {
    const cat = a.model;
    const spot = this._nearestStreamSpot(a);
    const streamDist = spot
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, spot.x, spot.y)
      : Infinity;
    return {
      hunger: cat?.stats?.hunger ?? 100,
      thirst: cat?.stats?.thirst ?? 100,
      nearestFoodDist:  this._catBowlDist(a, this.props.catFoodBowl),
      nearestWaterDist: this._catBowlDist(a, this.props.catWaterBowl),
      streamDist,
      isNight: !!this.isNight,
    };
  }

  // Distance from the cat to a bowl, or Infinity if the bowl is missing/empty — an
  // empty bowl is "nothing to seek". Used by seekFood/seekWater's range test.
  _catBowlDist(a, bowl) {
    if (!bowl || !bowlHasFood(bowl.level)) return Infinity;
    return Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, bowl.x, bowl.y);
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

  // run() for seekFood/seekWater (#202 rework): the cat walks up to a stocked bowl
  // and consumes one serving DIRECTLY from it — head down at the bowl's edge, the
  // eat/drink pose + sound, then the matching care action (feed → hunger, water →
  // thirst) and the bowl's level drops by one (empties the dish over several visits).
  // `action` is 'feed' (food bowl) or 'water' (water bowl). Returns true once it
  // claims the cat; false if the bowl vanished/emptied before it committed.
  catEatFromBowl(a, bowl, action) {
    if (!bowl || !bowlHasFood(bowl.level) || !a.sprite.active) return false;

    a.state = 'eating';
    a._eatBowl = bowl;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }

    const facingRight = bowl.x >= a.sprite.x;
    const tx = bowl.x + (facingRight ? -34 : 34);
    const ty = bowl.y - 6; // stand just at the dish's rim

    this.moveCreatureTo(a, tx, ty, () => {
      if (a.state !== 'eating' || !a.sprite.active) return;
      if (!bowlHasFood(bowl.level)) { this._catEatDone(a); return; } // someone/thing emptied it
      a.sprite.setFlipX(!facingRight);
      a.sprite.play(`eat_${a.key}`, true); // head-down eat/drink pose (catArt drawCatEat)
      if (action === 'water') playDrink(); else playEat('catFood');

      a.eatTimer = this.time.delayedCall(1600, () => {
        a.eatTimer = null;
        if (a.state !== 'eating' || !a.sprite.active) return;
        a.model?.applyAction(action);
        this.game.events.emit(EVENTS.STATS_CHANGED);
        this._setCatBowlLevel(bowl, drainBowlLevel(bowl.level)); // a serving eaten empties the dish a bit
        this._catEatDone(a);
      });
    });
    return true;
  }

  // Stand up from the bowl and go back to the prowl.
  _catEatDone(a) {
    if (a.eatTimer) { this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    a._eatBowl = null;
    if (!a.sprite.active) return;
    a.sprite.play(`idle_${a.key}`, true);
    a.state = 'idle';
    this.scheduleAnimalWander(a, Phaser.Math.Between(1200, 2600));
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
