// Tier-2 bird-ecosystem world objects (#219 bird bath, #240 seed feeder,
// #226 hummingbird sugar-water feeder, #239 beehive, #218 birdhouse). These are the fixed,
// decorative-plus-ambient props that the flying wildlife (paddock/wildlife.js) and
// the bees/hummingbirds hook onto. Kept in their own concern mixin (not world.js)
// so the family of related objects lives together and world.js stays under its
// line budget (#167). Composed onto PaddockScene like the other WithX mixins.
//
// Each builder places a sprite, records a `this.props.<name>` descriptor, and pushes
// any solid footprint into `this.birdEcosystemObstacles` — buildObstacles (world.js)
// spreads that array into this.obstacles, mirroring doghouseObstacles/barnObstacles.

import Phaser from 'phaser';
import { S } from './constants.js';
import { FEEDER_CAP, fillFeederLevel, drainFeederLevel, feederHasSeed } from '../../data/feeder.js';
import { HONEY_CAP, ripenHoney, honeyReady, harvestHoney } from '../../data/hive.js';
import { playSplash, playGather } from '../../audio/sounds.js';

export const WithBirdEcosystem = (Base) => class extends Base {
  // One entry point buildWorld calls after the yard props are down. Accumulates the
  // footprints for every bird-ecosystem object into one array world.js spreads.
  buildBirdEcosystem() {
    this.birdEcosystemObstacles = [];
    this.buildBirdBath();     // #219
    this.buildSeedFeeder();   // #240
    this.buildNectarFeeder(); // #226
    this.buildBeehive();      // #239
    this.buildBirdhouse();    // #218
  }

  // ─── Bird bath (#219) ────────────────────────────────────────────────────────
  // A decorative pedestal bath in the north yard where the ambient birds already
  // visit (near the flowers / cat / coop). Purely scenery + an ambient beat: birds
  // fly in to splash and drink (paddock/wildlife.js `_scheduleBirdBathVisit`). No
  // refilling or upkeep — it's fixed scenery, not a fillable resource.
  //
  // FIRST-PASS spot (620, 470) — flagged for the owner to redirect in the live
  // preview if a different yard corner reads better. Registers a small solid
  // pedestal footprint so the player and grazers path around it.
  buildBirdBath() {
    const x = 620, y = 470;
    const sprite = this.add.image(x, y, 'birdBath').setScale(S).setDepth(y).setOrigin(0.5, 1);
    // `sprite` kept so the dev drag tool (#330) can move the visible bath, not
    // just this record's numbers.
    this.props.birdBath = { x, y, sprite };
    // Sprite 34×40 at S (origin 0.5,1); the solid part is the pedestal foot ≈ 20px
    // wide at the base → ~44×20 footprint, bottom a touch above y so a bird landing
    // on the near rim still reads as "on" the bath.
    this.birdEcosystemObstacles.push({ x: x - 22, y: y - 20, w: 44, h: 18 });
  }

  // ─── Seed bird feeder (#240) ─────────────────────────────────────────────────
  // A fixed hopper feeder on a post near the HOUSE. Refillable with the existing
  // `seed` resource (gathered at the grain bin) through the gather-and-fill carrier
  // loop — the fill interactable lives in interactables.js (like the trough/pet
  // bowls). It holds a numeric seed `level` (0..FEEDER_CAP): birds feeding at it
  // nibble it down (drainSeedFeeder, called from the wildlife feeder-visit beat),
  // and an empty feeder attracts no birds. The sprite swaps stocked↔empty as the
  // level crosses zero. Starts empty so the first chore is to stock it.
  //
  // Placement pass (#316): the original first-pass spot (330, 360) sat right on
  // the house→junction worn path (fromHouse passes ~28px away, inside the path's
  // stroke width) and hugged the yard fence line. Moved to (394, 374) — clear of
  // the path (~65px), the fence, the fox den, and the doghouse/nectar-feeder
  // cluster, while staying in the same "east of the house" yard pocket.
  buildSeedFeeder() {
    const x = 394, y = 374;
    const sprite = this.add.image(x, y, 'seedFeederEmpty')
      .setScale(S).setDepth(y).setOrigin(0.5, 1);
    this.props.seedFeeder = { x, y, sprite, level: 0, filled: false, fillContent: 'seed' };
    // Sprite 28×56 at S (origin 0.5,1); the solid part is the slim post foot → a
    // narrow ~24×16 footprint at the base so the player can walk right up to it.
    this.birdEcosystemObstacles.push({ x: x - 12, y: y - 16, w: 24, h: 14 });
  }

  // Set the feeder's seed level (clamped), keep `filled` in sync, and swap the sprite
  // between the stocked and empty texture as it crosses zero. The single owner of
  // feeder-level changes — both refilling (fillSeedFeeder) and birds feeding
  // (drainSeedFeeder) go here.
  _setSeedFeederLevel(level) {
    const f = this.props.seedFeeder;
    if (!f) return;
    f.level  = Phaser.Math.Clamp(level, 0, FEEDER_CAP);
    f.filled = feederHasSeed(f.level);
    f.sprite.setTexture(f.filled ? 'seedFeeder' : 'seedFeederEmpty');
  }

  // Pour the active seed basket into the feeder, topping it up to FEEDER_CAP. Mirrors
  // fillTrough/fillPetBowl: consumes one carrier unit and refills the whole hopper.
  // Refills a stocked-but-not-full feeder too, so you can top it off any time.
  fillSeedFeeder() {
    const f = this.props.seedFeeder;
    if (!f || f.level >= FEEDER_CAP) return; // already full
    const item = this.getActiveItem();
    if (!item || item.content !== 'seed' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(1); // spend one seed unit to refill
    this._setSeedFeederLevel(fillFeederLevel());
    playSplash(); // a soft "poured" cue, reused from the trough/bowl fill
  }

  // A bird feeds at the feeder: nibble the seed level down by one. Called from the
  // ambient feeder-visit beat (paddock/wildlife.js) when a bird lands to eat, so the
  // feeder gradually empties as the birds it attracts consume it (#240).
  drainSeedFeeder() {
    const f = this.props.seedFeeder;
    if (!f || !f.filled) return;
    this._setSeedFeederLevel(drainFeederLevel(f.level));
  }

  // ─── Hummingbird nectar feeder (#226) ────────────────────────────────────────
  // A fixed hanging nectar feeder near the house. Refillable with its OWN resource —
  // `nectar` (sugar water), gathered at the nectar station and distinct from the seed
  // feeder's seed (#240) — through the gather-and-fill carrier loop (fillNectarFeeder).
  // It holds a numeric nectar `level` (0..FEEDER_CAP): hummingbirds sipping at it drain
  // it (drainNectarFeeder), and an empty feeder draws no hummingbirds to it (they'll
  // still visit the flowers). The sprite swaps stocked↔empty as the level crosses zero.
  // Starts empty so the first chore is to stock it.
  //
  // Placement pass (#316): the original first-pass spot (250, 420) actually
  // overlapped the doghouse's collision box once the doghouse moved to (260, 460)
  // for #237 — the two solid footprints intersected. Moved to (242, 394): still
  // right by the nectar station it's filled from (~50px, same "gather then pour
  // nearby" pairing as the bunny hutch/bowl), clear of the doghouse, cat bowl,
  // house, and the worn path.
  buildNectarFeeder() {
    const x = 242, y = 394;
    const sprite = this.add.image(x, y, 'nectarFeederEmpty')
      .setScale(S).setDepth(y).setOrigin(0.5, 1);
    this.props.nectarFeeder = { x, y, sprite, level: 0, filled: false, fillContent: 'nectar' };
    // Sprite 24×52 at S (origin 0.5,1); it hangs, so only a small foot footprint.
    this.birdEcosystemObstacles.push({ x: x - 10, y: y - 14, w: 20, h: 12 });
  }

  _setNectarFeederLevel(level) {
    const f = this.props.nectarFeeder;
    if (!f) return;
    f.level  = Phaser.Math.Clamp(level, 0, FEEDER_CAP);
    f.filled = feederHasSeed(f.level);
    f.sprite.setTexture(f.filled ? 'nectarFeeder' : 'nectarFeederEmpty');
  }

  // Pour the active nectar bucket into the feeder, topping it to FEEDER_CAP. Mirrors
  // fillSeedFeeder but for the nectar resource (a bucket liquid, so one pour = one fill).
  fillNectarFeeder() {
    const f = this.props.nectarFeeder;
    if (!f || f.level >= FEEDER_CAP) return; // already full
    const item = this.getActiveItem();
    if (!item || item.content !== 'nectar' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(item.count); // empty the bucket
    this._setNectarFeederLevel(fillFeederLevel());
    playSplash();
  }

  // A hummingbird sips at the feeder: drain one serving. Called from the hummingbird
  // visit beat when it hovers at the feeder ports (#226).
  drainNectarFeeder() {
    const f = this.props.nectarFeeder;
    if (!f || !f.filled) return;
    this._setNectarFeederLevel(drainFeederLevel(f.level));
  }

  // ─── Beehive + honey (#239) ──────────────────────────────────────────────────
  // A beehive placed like the birdhouse (a FIXED world object). Honey ripens on a slow
  // timer up to HONEY_CAP; once ripe the sprite swaps to the honey-glowing variant and a
  // basket can harvest the whole batch (harvestBeehive), resetting it. Bees buzz benignly
  // around the hive + nearby flowers — no sting, purely cosmetic (spawnBeeVisit). Honey
  // sells at the farm stand and is a future cooking ingredient. FIRST-PASS spot (760, 300)
  // near the flowers/carrot garden the bees also visit.
  buildBeehive() {
    const x = 760, y = 300;
    const sprite = this.add.image(x, y, 'beehive').setScale(S).setDepth(y).setOrigin(0.5, 1);
    this.props.beehive = { x, y, sprite, honey: 0, ready: false };
    // Sprite 30×44 at S (origin 0.5,1); solid box body ≈ 26 wide, lower ~30px → footprint.
    this.birdEcosystemObstacles.push({ x: x - 13, y: y - 30, w: 26, h: 28 });
    // Honey ripens slowly (mirrors the egg-lay timer cadence). Kept generous so it's a
    // gentle passive income, not a chore — a balance lever to tune at playtest.
    this.time.addEvent({ delay: 60_000, loop: true, callback: this._ripenHoneyTick, callbackScope: this });
    // A benign bee or two buzzing about, kicked off on its own timer.
    this._scheduleBeeVisit(Phaser.Math.Between(6000, 14000));
  }

  // Set the hive's honey level (clamped), keep `ready` in sync, and swap the sprite to
  // the honey-glowing variant when ripe. Single owner of hive-level changes.
  _setHoneyLevel(level) {
    const h = this.props.beehive;
    if (!h) return;
    h.honey = Phaser.Math.Clamp(level, 0, HONEY_CAP);
    h.ready = honeyReady(h.honey);
    h.sprite.setTexture(h.ready ? 'beehiveReady' : 'beehive');
  }

  // Slow production tick: ripen one jar (up to the cap).
  _ripenHoneyTick() {
    const h = this.props.beehive;
    if (!h) return;
    this._setHoneyLevel(ripenHoney(h.honey));
  }

  // Harvest the ripe honey batch into the active basket (like collecting eggs). Yields
  // the whole ripened amount and resets the hive; no-op if it isn't ripe or the carrier
  // won't take it. A basket-only, bare produce harvest — honey isn't dropped or gathered
  // from a source, it's produced here over time.
  harvestBeehive() {
    const h = this.props.beehive;
    if (!h || !h.ready) return;
    const item = this.getActiveItem();
    if (item?.carrier !== 'basket') return;
    const { yield: amount } = harvestHoney(h.honey);
    if (amount <= 0) return;
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier('honey', amount) ?? 0;
    if (added <= 0) return; // basket already holds something else / is full
    this._setHoneyLevel(0);
    playGather('honey');
    this.showIcon?.('iconHoney', this.player.sprite);
  }

  // ─── Birdhouse (#218) ────────────────────────────────────────────────────────
  // A decorative post-mounted nesting box in the north yard, near the house — purely
  // an ambient bird attractor (mirrors the bird bath #219 / seed feeder #240 pattern),
  // NOT the naming/befriending mechanic (that's future #223, which builds on top of
  // this). No fill/drain — it's fixed scenery, always "active"; songbirds just perch
  // on the roof/entrance more often when it's around (see _scheduleBirdhouseVisit in
  // birdEcosystemVisits.js).
  //
  // FIRST-PASS spot (500, 260) — north yard, east of the house/doghouse cluster and
  // clear of the bird bath (620,470) / seed feeder (394,374) / beehive (760,300) /
  // doghouse (260,460) [#316: coords refreshed after the #237 doghouse move and the
  // #316 seed-feeder move — this spot itself is unchanged, still clear of both], so
  // it reads as its own distinct feature. Flagged for the owner to redirect in the
  // live preview if a different yard corner reads better.
  buildBirdhouse() {
    const x = 500, y = 260;
    const sprite = this.add.image(x, y, 'birdhouse').setScale(S).setDepth(y).setOrigin(0.5, 1);
    // `sprite` kept so the dev drag tool (#330) can move the visible birdhouse,
    // not just this record's numbers.
    this.props.birdhouse = { x, y, sprite };
    // Sprite 26×58 at S (origin 0.5,1); the solid part is the slim post foot → a
    // narrow ~22×16 footprint at the base so the player can walk right up to it.
    this.birdEcosystemObstacles.push({ x: x - 11, y: y - 16, w: 22, h: 14 });
  }

};
