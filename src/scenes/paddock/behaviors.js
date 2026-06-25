// Behavior dispatcher — the generic, data-driven AI tick. Each species declares an
// ordered `behaviors` list (src/data/species/<x>/index.js); the modules themselves
// ({ id, test, run }) live in that species' behaviors.js. This mixin walks the list
// in priority order and lets the first behavior that fires *and* successfully claims
// the agent win — exactly the semantics of the old hand-written if-ladders, just
// driven by data so a new animal composes a list instead of needing new tick code.
//
// The decision is split: `test(ctx)` is pure (unit-tested in the species'
// behaviors.test.js), `run(scene, agent)` reuses the existing movement primitives
// (horseGoEat/horseGoDrink/_horseBeg, chickenGoEat/chickenFollow/chickenGatherAt) —
// those are untouched, so the living-paddock feel is unchanged. `_behaviorContext`
// gathers the same quantities the old ladders computed inline into one plain object.

import Phaser from 'phaser';
import { getSpecies, BEHAVIORS } from '../../data/species/index.js';
import { speciesEatsContent } from '../../data/items.js';
import { BEG, CHICKEN_HUNGRY_FOLLOW_DIST } from './constants.js';

export const WithBehaviors = (Base) => class extends Base {
  // Walk the agent's species behavior list; return true if a behavior claimed it
  // (so the caller skips wandering), false if none did.
  runBehaviors(agent) {
    // _speciesOf (world.js) maps a creature key to its species id: 'horse2' →
    // 'horse', 'chicken0' → 'chicken'.
    const species = this._speciesOf(agent.key);
    const ctx = species === 'chicken' ? this._chickenContext(agent) : this._horseContext(agent);
    const spec = getSpecies(species);
    const registry = BEHAVIORS[species] ?? {};
    for (const id of spec.behaviors ?? []) {
      const b = registry[id];
      // test() gates; run() does the work and may still bail (e.g. pile taken),
      // in which case we fall through to the next behavior — never strand idle.
      if (b && b.test(ctx) && b.run(this, agent)) return true;
    }
    return false;
  }

  // ─── Context snapshots (pure data the behavior `test`s read) ───────────────

  // Shared by every grazer (horse + cow): the dispatcher routes any non-chicken
  // agent here. Reads the agent's model generically via _modelFor, so it works for
  // a horse (allHorses registry) or a cow (its attached model) alike.
  _horseContext(h) {
    const horse = this._modelFor(h);
    if (!horse) {
      return { hunger: 100, thirst: 100, nearestHayDist: Infinity, troughDist: Infinity, streamDist: Infinity, hasPlayer: false };
    }
    const pile = this._nearestReachableHay(h);
    const nearestHayDist = pile
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y)
      : Infinity;

    const t = this.props.trough;
    const troughDist = (t?.filled && this._inPasture(t.x, t.y))
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, t.x, t.y)
      : Infinity;

    const water = this._nearestReachableWater(h);
    const streamDist = water
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, water.x, water.y)
      : Infinity;

    const hasPlayer = !!this.player;
    const playerDist = hasPlayer
      ? Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.player.sprite.x, this.player.sprite.y)
      : Infinity;

    return {
      hunger: horse.stats.hunger,
      thirst: horse.stats.thirst,
      temperament: horse.temperament,
      nearestHayDist,
      troughDist,
      streamDist,
      hasPlayer,
      gateOpen: this._gateOpen(),
      playerDist,
      now: this.time.now,
      lastSeek: h._lastSeek ?? null,
      // Begging tuning is shared with the begging primitive, so it rides in via ctx.
      begHunger: BEG.HUNGER,
      begNoticeDist: BEG.NOTICE_DIST,
      begThrottleMs: BEG.THROTTLE_MS,
    };
  }

  _chickenContext(a) {
    const gateOpen = this._gateOpen();
    const item = this.getActiveItem();
    const grainBin = this._grainBin();
    const playerDist = this.player
      ? Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.player.sprite.x, this.player.sprite.y)
      : Infinity;
    return {
      nearestSeed: this._nearestReachableSeed(a, gateOpen),
      luring: !!this.player && item?.carrier === 'basket' && item.content === 'seed' && item.count > 0,
      // Hungry until actually fed today — NOT until the morning phase ends (#129).
      // An unfed flock keeps anticipating breakfast at the bin all day rather than
      // drifting back to wandering on a clock. Reset at dawn (dayNight.js).
      anticipating: !this._chickensFedToday && !!grainBin,
      // A hungry chicken trails a nearby player even with no seeds out yet (#128).
      playerDist,
      hungryFollowDist: CHICKEN_HUNGRY_FOLLOW_DIST,
      gateOpen,
    };
  }

  // ─── Small shared lookups used by both contexts and behavior `run`s ────────

  _gateOpen() { return !!this.props.gate?.open; }

  _grainBin() { return this.props.sources?.find(s => s.content === 'seed'); }

  // Nearest hay pile this horse can actually reach (hay outside the fence needs the
  // gate open), or null. Mirrors the old horseTickForHorse scan.
  _nearestReachableHay(h) {
    if (!this.props.hayPiles?.length) return null;
    const gateOpen = this._gateOpen();
    // Respect the grazer's diet: a pig walks past hay it won't eat but still goes
    // for apples/carrots (#…). Piles carry their `content`; the horse/cow eat all
    // three, so this is a no-op for them. (A content-less pile is treated as edible
    // for safety, though placeFood always tags one now.)
    const species = this._modelFor(h)?.species ?? 'horse';
    let closest = null, closestDist = Infinity;
    for (const pile of this.props.hayPiles) {
      if (!this._inPasture(pile.x, pile.y) && !gateOpen) continue;
      if (pile.content && !speciesEatsContent(species, pile.content)) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y);
      if (d < closestDist) { closestDist = d; closest = pile; }
    }
    return closest;
  }

  // Nearest stream bank point this horse can actually reach — the stream is the
  // only natural water horses drink from (the well is for buckets, not muzzles),
  // and it's outside the fence so it needs the gate open (#99). Stream sources
  // are the water sources that carry a `bank` drink-anchor. Mirrors
  // _nearestReachableHay; the trough is handled separately (props.trough).
  _nearestReachableWater(h) {
    const srcs = this.props.sources?.filter(s => s.content === 'water' && s.bank);
    if (!srcs?.length) return null;
    const gateOpen = this._gateOpen();
    let closest = null, closestDist = Infinity;
    for (const s of srcs) {
      if (!this._inPasture(s.x, s.y) && !gateOpen) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, s.x, s.y);
      if (d < closestDist) { closestDist = d; closest = s; }
    }
    return closest;
  }
};
