// Duck taming (#275) — the scene-coupled half of "leave food out for the wild duck and
// it warms up to you until it moves in." Self-contained in its OWN mixin (mirrors
// paddock/fox.js exactly, just swapped for duck food/DUCK_KEY): it owns the wild-duck
// sprite, the `onDuckFoodPlaced` taming hook, and the commit-to-roster spawn.
//
// The loop mirrors the FOX's attract/roster pattern with a TAMING COUNTER:
//   1. The player fills a basket at the duck feeder (by the stream) and DROPS a
//      duck-food pile (placeFood).
//   2. placeFood fires every registered on<X>FoodPlaced hook (worldObjects.js
//      `_dispatchFoodPlaced`, #275 — a second ground-drop taming species alongside the
//      fox, so the dispatch fans out instead of a single overridable slot); ours is
//      `onDuckFoodPlaced(content, x, y)`: for duckFood, a wild duck waddles in from the
//      stream, pecks the pile, and the pure `feedWildDuck` counter (data/species/duck/
//      index.js) ticks up (persisted via saveDuckTaming so befriending is gradual
//      across sessions).
//   3. On the DUCK_TAME_FEEDS-th feed the counter reports `tamed` — we swap the wild
//      duck for a real roster Duck at the same spot (`_commitDuck`), exactly the way
//      `_commitFox` spawns its fox via the generic `_spawnWorldIndividual`. From then on
//      it's an ordinary cared-for grazer (seeks duck-food piles, can be petted,
//      persists) PLUS it swims — the generic swimStream behavior (../../data/species/
//      swim.js, #231) picks it up automatically via its `swims` capability, no extra
//      code here.
//
// Once tamed (the roster has a duck), `onDuckFoodPlaced` no longer summons the wild
// one — the dropped pile just feeds the roster duck through the normal grazing AI.
// Capped at DUCK_CAP (one), so there's never a second wild duck after the first is won
// over.
//
// A returning player's already-tamed duck is restored from the persisted roster on
// boot (buildAnimals walks the `allDucks` registry like any other world species); this
// mixin only handles the pre-tame wild phase + the commit.

import Phaser from 'phaser';
import { WORLD_W, BOUNDS, S } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';
import { SPECIES } from '../../data/species/index.js';
import { DUCK_KEY, DUCK_CAP, feedWildDuck } from '../../data/species/duck/index.js';
import { Duck } from '../../data/species/duck/model.js';
import { loadDuckTaming, saveDuckTaming } from '../../data/save.js';

const DUCK_SCALE = S / ART_SCALE; // super-sampled art shown at S/ART_SCALE (like the fox)

export const WithDuck = (Base) => class extends Base {
  // Called from create(): set up the duck animations + restore the persisted taming
  // count so a returning player's warm-up carries over. No wild duck is spawned up
  // front — one only waddles in when the player drops duck food (onFoodPlaced).
  buildDuck() {
    this._duckTameCount = loadDuckTaming(); // pre-tame feed tally (0 until the first feed)
    this._wildDuck = null;                  // the active wild-duck sprite record, or null
    // The duck's idle/walk/eat animations, keyed by DUCK_KEY. spawnAnimal would create
    // these when a roster duck spawns, but the WILD duck appears BEFORE that, so ensure
    // they exist now. (Idempotent — spawnAnimal guards on idle_ existing.)
    const key = DUCK_KEY;
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({ key: `idle_${key}`, frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }], frameRate: 2, repeat: -1 });
      this.anims.create({ key: `walk_${key}`, frames: [{ key: `${key}_walk_0` }, { key: `${key}_walk_1` }, { key: `${key}_walk_2` }, { key: `${key}_walk_3` }], frameRate: 7, repeat: -1 });
      this.anims.create({ key: `eat_${key}`,  frames: [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }], frameRate: 4, repeat: -1 });
    }
  }

  // Is a duck already in the roster? (Tamed — no more wild-phase summoning.)
  _duckRosterFull() {
    return Object.keys(this.registry.get('allDucks') ?? {}).length >= DUCK_CAP;
  }

  // Post-drop hook (placeFood → worldObjects.js dispatches to every registered
  // on<X>FoodPlaced hook, #275). Own-named (not the shared `onFoodPlaced` slot the fox
  // uses) so both ground-drop taming species can coexist without a silent-override
  // collision — see worldObjects.js `_dispatchFoodPlaced`. Reacts only to DUCK FOOD. If
  // the duck is already tamed, do nothing — the roster duck eats the pile via the
  // normal grazing AI. Otherwise summon/redirect the wild duck to the pile so it comes
  // over to be fed (the taming beat).
  onDuckFoodPlaced(content, x, y, pile) {
    if (content !== 'duckFood') return;
    if (this._duckRosterFull()) return; // already have our duck — normal grazing takes over
    this._lureWildDuck(x, y, pile);
  }

  // Bring the wild duck to the dropped duck-food pile at (x, y): reuse the existing
  // wild-duck sprite if one's already about, else spawn one entering from the nearest
  // stream-ward edge for a "a duck waddles in from the water" beat. Then waddle it to
  // the pile and, on arrival, feed it. `pile` is the actual hayPiles record (#408) so
  // the feed can consume it once eaten.
  _lureWildDuck(x, y, pile) {
    if (!this._wildDuck || !this._wildDuck.sprite.active) this._spawnWildDuck(x, y);
    const c = this._wildDuck;
    if (!c?.sprite?.active) return;
    if (c.tween) { c.tween.stop(); c.tween = null; }
    // Stand a short hop to the side of the pile, facing it.
    const facingRight = x >= c.sprite.x;
    const tx = x + (facingRight ? -24 : 24), ty = y - 4;
    this._duckWaddleTo(c, tx, ty, () => this._feedWildDuck(c, x, y, pile));
  }

  // Spawn the wild duck just off the nearest play-area edge from (x, y) so it reads as
  // waddling in rather than popping into being on the pile. Uses the same DUCK_KEY
  // frames the tamed duck will wear, so the look is continuous through the commit.
  _spawnWildDuck(x, y) {
    const fromX = Phaser.Math.Clamp(x + Phaser.Math.Between(-120, 120), BOUNDS.minX, BOUNDS.maxX);
    const fromY = Phaser.Math.Clamp(y - Phaser.Math.Between(90, 150), BOUNDS.minY, BOUNDS.maxY);
    const sprite = this.add.sprite(fromX, fromY, `${DUCK_KEY}_idle_0`)
      .setOrigin(0.5, 1).setScale(DUCK_SCALE).setDepth(fromY).play(`idle_${DUCK_KEY}`);
    const shadow = this.add.image(fromX, fromY, 'shadow')
      .setScale(S * (SPECIES.duck.spawn.shadowScale ?? 0.24)).setDepth(fromY - 1);
    this._wildDuck = { sprite, shadow, tween: null };
  }

  // Waddle the wild duck to (tx, ty): play the walk cycle, face the movement, keep the
  // shadow + depth in step, then onArrive. A light tween (not the full pathfinder — the
  // wild duck roams the stream edge where the pile is dropped, no obstacles to weave).
  _duckWaddleTo(c, tx, ty, onArrive) {
    if (!c.sprite?.active) return;
    const sprite = c.sprite;
    sprite.setFlipX(tx < sprite.x);
    sprite.play(`walk_${DUCK_KEY}`, true);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: Math.max(500, dist * 14), ease: 'Sine.easeInOut',
      onUpdate: () => { sprite.setDepth(sprite.y); c.shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1); },
      onComplete: () => { c.tween = null; onArrive?.(); },
    });
  }

  // The wild duck reached the pile: play the peck, tick the pure taming counter, and
  // either (a) commit it to the roster on the taming feed, or (b) leave it to paddle
  // off, a little more won over, until the next feed. Persists the running count so
  // it's gradual across reloads.
  _feedWildDuck(c, x, y, pile) {
    if (!c.sprite?.active) return;
    c.sprite.play(`eat_${DUCK_KEY}`, true);
    this.consumePile(pile); // pile's actually eaten now — destroy it (worldObjects.js, #408)
    const step = feedWildDuck(this._duckTameCount, this._duckRosterFull());
    this._duckTameCount = step.count;
    saveDuckTaming(step.count);

    this.time.delayedCall(1600, () => {
      if (step.tamed) {
        this._commitDuck(c, x, y); // won over — the wild duck becomes a roster pet, in place
      } else if (c.sprite?.active) {
        // Not yet tamed: paddle back off the way it came, a bit friendlier next time.
        c.sprite.play(`idle_${DUCK_KEY}`, true);
        this.time.delayedCall(Phaser.Math.Between(600, 1400), () => this._duckWaddleOff(c));
      }
    });
  }

  // Commit the tamed duck: remove the wild-duck sprite and spawn a real roster Duck at
  // the same spot via the generic `_spawnWorldIndividual` (the exact wiring buildAnimals
  // uses), so from now on it's an ordinary cared-for grazer that also swims. Adds it to
  // the persisted `allDucks` roster and saves immediately so it survives a reload even
  // before the autosave tick — directly mirrors `_commitFox`.
  _commitDuck(c, x, y) {
    const at = { x: c?.sprite?.x ?? x, y: c?.sprite?.y ?? y };
    this._despawnWildDuck(c);
    if (this._duckRosterFull()) return; // defensive — a duck already committed

    const all = this.registry.get('allDucks') ?? {};
    const model = new Duck({});
    all[DUCK_KEY] = model;
    this.registry.set('allDucks', all);

    const a = this._spawnWorldIndividual(SPECIES.duck, DUCK_KEY, model, { x: at.x, y: at.y });
    // A little celebratory heart so the "it moved in!" beat is legible.
    this.showHeart?.(a.sprite);
    this._saveAnimal(model);
    return a;
  }

  // Paddle the wild duck off the nearest edge and despawn — a skittish exit between
  // feeds.
  _duckWaddleOff(c) {
    if (!c?.sprite?.active) { this._despawnWildDuck(c); return; }
    const toLeft = c.sprite.x < WORLD_W / 2;
    this._duckWaddleTo(c, toLeft ? BOUNDS.minX - 40 : WORLD_W + 40, c.sprite.y, () => this._despawnWildDuck(c));
  }

  // Tear down the wild-duck sprite + shadow and clear the slot.
  _despawnWildDuck(c) {
    if (c?.tween) { c.tween.stop(); c.tween = null; }
    c?.sprite?.destroy();
    c?.shadow?.destroy();
    if (this._wildDuck === c) this._wildDuck = null;
  }
};
