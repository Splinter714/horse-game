// Fox taming (#266) — the scene-coupled half of "leave food out for the wild fox and it
// warms up to you until it moves in." Self-contained in its OWN mixin (not piled into the
// shared wildlife.js, so the parallel owls agent doesn't collide): it owns the wild-fox
// sprite, the `onFoodPlaced` taming hook, and the commit-to-roster spawn.
//
// The loop mirrors the BUNNY's attract/roster pattern (paddock/bunny.js) but with a
// TAMING COUNTER instead of an instant join:
//   1. The player fills a basket at the fox den and DROPS a fox-food pile (placeFood).
//   2. placeFood fires the generic `onFoodPlaced(content, x, y)` hook, which we own here:
//      for foxFood, a wild fox trots in from the yard edge, gnaws the pile, and the pure
//      `feedWildFox` counter (data/species/fox/index.js) ticks up (persisted via
//      saveFoxTaming so befriending is gradual across sessions).
//   3. On the FOX_TAME_FEEDS-th feed the counter reports `tamed` — we swap the wild fox
//      for a real roster Fox at the same spot (`_commitFox`), exactly the way attractBunny
//      spawns its bunny via the generic `_spawnWorldIndividual`. From then on it's an
//      ordinary cared-for grazer (seeks fox-food piles, can be petted, persists).
//
// Once tamed (the roster has a fox), `onFoodPlaced` no longer summons the wild one — the
// dropped pile just feeds the roster fox through the normal grazing AI. Capped at FOX_CAP
// (one), so there's never a second wild fox after the first is won over.
//
// A returning player's already-tamed fox is restored from the persisted roster on boot
// (buildAnimals walks the `allFoxes` registry like any other world species); this mixin
// only handles the pre-tame wild phase + the commit.

import Phaser from 'phaser';
import { WORLD_W, BOUNDS, S } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';
import { SPECIES } from '../../data/species/index.js';
import { FOX_KEY, FOX_CAP, feedWildFox } from '../../data/species/fox/index.js';
import { Fox } from '../../data/species/fox/model.js';
import { loadFoxTaming, saveFoxTaming } from '../../data/save.js';
import { offscreenX, exitX } from './offscreen.js';

const FOX_SCALE = S / ART_SCALE; // super-sampled art shown at S/ART_SCALE (like the bunny)

export const WithFox = (Base) => class extends Base {
  // Called from create(): set up the fox animations + restore the persisted taming
  // count so a returning player's warm-up carries over. No wild fox is spawned up front
  // — one only trots in when the player drops fox food (onFoodPlaced).
  buildFox() {
    this._foxTameCount = loadFoxTaming();  // pre-tame feed tally (0 until the first feed)
    this._wildFox = null;                  // the active wild-fox sprite record, or null
    // The fox's idle/walk/eat animations, keyed by FOX_KEY. spawnAnimal would create
    // these when a roster fox spawns, but the WILD fox appears BEFORE that, so ensure
    // they exist now. (Idempotent — spawnAnimal guards on idle_ existing.)
    const key = FOX_KEY;
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({ key: `idle_${key}`, frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }], frameRate: 2, repeat: -1 });
      this.anims.create({ key: `walk_${key}`, frames: [{ key: `${key}_walk_0` }, { key: `${key}_walk_1` }, { key: `${key}_walk_2` }, { key: `${key}_walk_3` }], frameRate: 7, repeat: -1 });
      this.anims.create({ key: `eat_${key}`,  frames: [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }], frameRate: 4, repeat: -1 });
    }
  }

  // Is a fox already in the roster? (Tamed — no more wild-phase summoning.)
  _foxRosterFull() {
    return Object.keys(this.registry.get('allFoxes') ?? {}).length >= FOX_CAP;
  }

  // Post-drop hook (placeFood → worldObjects.js dispatches to every registered
  // on<X>FoodPlaced hook, #275). Own-named (not the shared `onFoodPlaced` slot) so a
  // second ground-drop taming species (the duck) can have its own hook without a
  // silent-override collision — see worldObjects.js `_dispatchFoodPlaced`. Reacts only
  // to FOX FOOD. If the fox is already tamed, do nothing — the roster fox eats the pile
  // via the normal grazing AI. Otherwise summon/redirect the wild fox to the pile so it
  // comes over to be fed (the taming beat).
  onFoxFoodPlaced(content, x, y, pile) {
    if (content !== 'foxFood') return;
    if (this._foxRosterFull()) return; // already have our fox — normal grazing takes over
    this._lureWildFox(x, y, pile);
  }

  // Bring the wild fox to the dropped fox-food pile at (x, y): reuse the existing wild-fox
  // sprite if one's already about, else spawn one entering from the nearest yard edge for a
  // "a fox slinks in from the brush" beat. Then trot it to the pile and, on arrival, feed it.
  // `pile` is the actual hayPiles record (#408) so the feed can consume it once eaten.
  _lureWildFox(x, y, pile) {
    if (!this._wildFox || !this._wildFox.sprite.active) this._spawnWildFox(x, y);
    const c = this._wildFox;
    if (!c?.sprite?.active) return;
    if (c.tween) { c.tween.stop(); c.tween = null; }
    // Stand a short hop to the side of the pile, facing it.
    const facingRight = x >= c.sprite.x;
    const tx = x + (facingRight ? -26 : 26), ty = y - 4;
    this._foxTrotTo(c, tx, ty, () => this._feedWildFox(c, x, y, pile));
  }

  // Spawn the wild fox genuinely off-screen (#410 — a small nearby offset still popped
  // it into view) from the nearer side of the current camera view, so it reads as
  // wandering in from outside the frame rather than appearing near the pile. Uses the
  // same FOX_KEY frames the tamed fox will wear, so the look is continuous through the
  // commit.
  _spawnWildFox(x, y) {
    const fromLeft = exitX(this, x, 40).toLeft;
    const fromX = offscreenX(this, fromLeft, 40, x);
    const fromY = Phaser.Math.Clamp(y - Phaser.Math.Between(90, 150), BOUNDS.minY, BOUNDS.maxY);
    const sprite = this.add.sprite(fromX, fromY, `${FOX_KEY}_idle_0`)
      .setOrigin(0.5, 1).setScale(FOX_SCALE).setDepth(fromY).play(`idle_${FOX_KEY}`);
    const shadow = this.add.image(fromX, fromY, 'shadow')
      .setScale(S * (SPECIES.fox.spawn.shadowScale ?? 0.3)).setDepth(fromY - 1);
    this._wildFox = { sprite, shadow, tween: null };
  }

  // Trot the wild fox to (tx, ty): play the walk cycle, face the movement, keep the shadow
  // + depth in step, then onArrive. A light tween (not the full pathfinder — the wild fox
  // roams the open yard where the pile is dropped, no obstacles to weave).
  _foxTrotTo(c, tx, ty, onArrive) {
    if (!c.sprite?.active) return;
    const sprite = c.sprite;
    sprite.setFlipX(tx < sprite.x);
    sprite.play(`walk_${FOX_KEY}`, true);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: Math.max(500, dist * 12), ease: 'Sine.easeInOut',
      onUpdate: () => { sprite.setDepth(sprite.y); c.shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1); },
      onComplete: () => { c.tween = null; onArrive?.(); },
    });
  }

  // The wild fox reached the pile: play the gnaw, tick the pure taming counter, and either
  // (a) commit it to the roster on the taming feed, or (b) leave it to slink off, a little
  // more won over, until the next feed. Persists the running count so it's gradual across
  // reloads.
  _feedWildFox(c, x, y, pile) {
    if (!c.sprite?.active) return;
    c.sprite.play(`eat_${FOX_KEY}`, true);
    this.consumePile(pile); // pile's actually eaten now — destroy it (worldObjects.js, #408)
    const step = feedWildFox(this._foxTameCount, this._foxRosterFull());
    this._foxTameCount = step.count;
    saveFoxTaming(step.count);

    this.time.delayedCall(1600, () => {
      if (step.tamed) {
        this._commitFox(c, x, y); // won over — the wild fox becomes a roster pet, in place
      } else if (c.sprite?.active) {
        // Not yet tamed: amble back off the way it came, a bit friendlier next time.
        c.sprite.play(`idle_${FOX_KEY}`, true);
        this.time.delayedCall(Phaser.Math.Between(600, 1400), () => this._foxSlinkOff(c));
      }
    });
  }

  // Commit the tamed fox: remove the wild-fox sprite and spawn a real roster Fox at the
  // same spot via the generic `_spawnWorldIndividual` (the exact wiring buildAnimals uses),
  // so from now on it's an ordinary cared-for grazer. Adds it to the persisted `allFoxes`
  // roster and saves immediately so it survives a reload even before the autosave tick —
  // directly mirrors attractBunny.
  _commitFox(c, x, y) {
    const at = { x: c?.sprite?.x ?? x, y: c?.sprite?.y ?? y };
    this._despawnWildFox(c);
    if (this._foxRosterFull()) return; // defensive — a fox already committed

    const all = this.registry.get('allFoxes') ?? {};
    const model = new Fox({});
    all[FOX_KEY] = model;
    this.registry.set('allFoxes', all);

    const a = this._spawnWorldIndividual(SPECIES.fox, FOX_KEY, model, { x: at.x, y: at.y });
    // A little celebratory heart so the "it moved in!" beat is legible.
    this.showHeart?.(a.sprite);
    this._saveAnimal(model);
    return a;
  }

  // Slink the wild fox off the nearest edge and despawn — a skittish exit between feeds.
  _foxSlinkOff(c) {
    if (!c?.sprite?.active) { this._despawnWildFox(c); return; }
    const toLeft = c.sprite.x < WORLD_W / 2;
    this._foxTrotTo(c, toLeft ? BOUNDS.minX - 40 : WORLD_W + 40, c.sprite.y, () => this._despawnWildFox(c));
  }

  // Tear down the wild-fox sprite + shadow and clear the slot.
  _despawnWildFox(c) {
    if (c?.tween) { c.tween.stop(); c.tween = null; }
    c?.sprite?.destroy();
    c?.shadow?.destroy();
    if (this._wildFox === c) this._wildFox = null;
  }
};
