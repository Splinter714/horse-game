// Bunny attraction (#224, reworked #283) — the scene-coupled half of "keep the bunny
// bowl stocked, a bunny hops in and joins." The pure cap/coat logic lives in data
// (data/species/bunny/index.js `nextBunny`, cap = one per coat colour); this mixin
// builds the bunny's food + water bowls by the hutch and, when the FOOD BOWL is
// refilled (the generic pet-bowl `onFill` hook), attracts a new Bunny if the roster
// has room. #283 replaced the old gather-food-and-drop-a-pile-on-the-ground flow: the
// player now pours bunny food into a bowl the bunnies eat from directly (like the cat
// bowls, #202), and it's that refill — not a ground pile — that lures a wild bunny in.
//
// A returning player's already-attracted bunnies are restored from the persisted
// roster on boot (buildAnimals walks the `allBunnies` registry the same as any other
// world species); this mixin only handles NEW arrivals during play.

import Phaser from 'phaser';
import { SPECIES } from '../../data/species/index.js';
import { nextBunny, BUNNY_CAP } from '../../data/species/bunny/index.js';
import { Bunny } from '../../data/species/bunny/model.js';

export const WithBunny = (Base) => class extends Base {
  // Bunny food + water bowl (#283, combined into one prop #311) — the bunny's
  // counterpart to the cat's dish, tucked by the hutch in the north yard. Built
  // through the shared pet-bowl primitive (worldObjects.js _addPetBowl) so
  // fill/consume are the same machinery as the cat's. The FOOD side carries an
  // `onFill` hook: stocking it lures a wild bunny (attractBunny), so attraction
  // lives on refilling the bowl rather than dropping a pile on the ground.
  buildBunnyBowl() {
    this._addPetBowl({
      x: 565, y: 340, tex: 'bunnyBowl', foodContent: 'bunnyFood', waterContent: 'water',
      propKey: 'bunnyBowl', onFillFood: (bowl) => this.attractBunny(bowl.x, bowl.y),
    });
  }

  // The bunny food bowl was refilled near (x, y): if the roster isn't already full
  // (one bunny per coat colour, cap BUNNY_CAP), attract a new bunny. Its coat is chosen
  // randomly among the colours not yet taken (nextBunny), it's added to the persisted
  // roster, and it spawns a short hop away from the bowl so it visibly comes over to it.
  // Full roster ⇒ nothing happens (the bowl still feeds the bunnies already here).
  attractBunny(x, y) {
    const all = this.registry.get('allBunnies') ?? {};
    if (Object.keys(all).length >= BUNNY_CAP) return null; // roster full — no new bunny

    // Pick the next free coat slot (random among the still-available colours).
    const takenCoats = Object.values(all).map((b) => b.coat);
    const pick = nextBunny(takenCoats);
    if (!pick) return null; // defensive — cap already reached

    // Create the model. `coat` is the colour id; the registry key (`bunny<i>`) matches
    // the pre-built coat texture (art/index.js bunny builder), so no runtime art build.
    const model = new Bunny({ coat: pick.coat });
    all[pick.key] = model;
    this.registry.set('allBunnies', all);

    // Spawn it a little way off from the bowl so it hops over to eat, entering from
    // the edge of the yard for a "wild bunny wandered in" beat. Clamp into play bounds.
    const from = this._bunnyEntryPoint(x, y);
    const spec = SPECIES.bunny;
    const a = this._spawnWorldIndividual(spec, pick.key, model, { x: from.x, y: from.y });
    // Nudge it awake toward the bowl straight away (its seekBunnyFood behavior takes
    // over once it's hungry; a fresh bunny starts full, so give it an initial amble
    // toward the dish so the arrival reads as "drawn in by the food").
    this.time.delayedCall(200, () => {
      if (a?.sprite?.active) this.moveCreatureTo(a, x, y + 24, () => {
        if (a.sprite.active) { a.sprite.play(`idle_${a.key}`, true); a.state = 'idle'; }
      });
    });

    // Persist the new arrival immediately so it survives a reload even before the
    // 15s autosave tick.
    this._saveAnimal(model);
    return a;
  }

  // Where a freshly-attracted bunny appears: just off the nearest play-area edge from
  // the bowl, so it reads as hopping in from outside rather than popping into being on
  // top of the dish. Falls back to a small offset if bounds are unavailable.
  _bunnyEntryPoint(x, y) {
    const b = this.player?.homeBounds ?? null;
    // Enter from a random nearby offset (a bunny emerging from the brush), clamped
    // into the walkable area so it isn't stuck in an obstacle or off-screen.
    const ox = x + Phaser.Math.Between(-90, 90);
    const oy = y - Phaser.Math.Between(70, 130); // come in from "above" (the yard edge)
    return { x: ox, y: oy };
  }
};
