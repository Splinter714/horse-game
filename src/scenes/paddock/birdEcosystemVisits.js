// Object-anchored ambient wildlife visits for the bird ecosystem (#219 bird bath,
// #240 seed feeder, #226 hummingbirds, #239 bees). These are the flying critters that
// visit the fixed props built by WithBirdEcosystem (birdEcosystem.js) — split out from
// it so that mixin stays focused on the object build + fill/harvest STATE and this one
// holds the tween-driven VISIT behavior, keeping both under the #167 line budget.
//
// They reuse wildlife.js's shared critter plumbing on the same `this`: _pickBird (a
// weighted bird + its keys), _birdTakeOff (flush + despawn), _despawnCritter (cleanup),
// and the _wildCritters list (so updateWildlife depth-sorts perched birds + startles
// them off when the player crowds them, via the c.ground flag), plus WILD_SCALE for
// display size. Kicked off from buildWildlife via startBirdEcosystemVisits.

import Phaser from 'phaser';
import { S, WORLD_W } from './constants.js';
import { WILD_SCALE } from './wildlife.js';

// ── Landing spots on the props (#340) ─────────────────────────────────────────
// Each prop texture is authored at 1× (worldArt.js `gen(scene, key, W, H, …)`) with
// origin (0.5,1) at its base, and displayed at `.setScale(S)`. So a feature drawn at
// texture row `ty` sits `(H - ty) * S` WORLD px above the prop's anchor — the texture
// offset must be multiplied by S. The original offsets were the raw texture numbers
// (bath 26, feeder 28, birdhouse 29), i.e. HALF the real height, which parked every
// visiting bird partway down the pedestal/post instead of on the rim/tray/perch.
//   bird bath   34×40 — water surface at ty≈13  → 27 texture px up
//   seed feeder 28×56 — landing tray top ty=28  → 28 texture px up
//   birdhouse   26×58 — perch dowel top  ty=27  → 31 texture px up
const BATH_PERCH_UP = 27 * S;      // stand in the basin water
const FEEDER_PERCH_UP = 28 * S;    // stand on the landing tray
const BIRDHOUSE_PERCH_UP = 31 * S; // stand on the perch dowel under the hole
// Half-widths of the usable landing surface, likewise in texture px × S.
const BATH_PERCH_SPREAD = 5 * S;      // basin is 24 texture px across
const FEEDER_PERCH_SPREAD = 4 * S;    // tray is 18 texture px across
const BIRDHOUSE_PERCH_SPREAD = 1 * S; // dowel is only 6 texture px across

export const WithBirdEcosystemVisits = (Base) => class extends Base {
  startBirdEcosystemVisits() {
    this._scheduleBirdBathVisit(Phaser.Math.Between(14000, 30000));   // #219 bath splashes
    this._scheduleFeederVisit(Phaser.Math.Between(10000, 22000));     // #240 feeder visits
    this._scheduleHummingbirdVisit(Phaser.Math.Between(20000, 40000)); // #226 hummingbirds
    this._scheduleBirdhouseVisit(Phaser.Math.Between(12000, 26000));   // #218 birdhouse perches
  }

  // ── Bird bath (#219) ── a bird swoops onto the basin rim, bobs and splashes a few
  // times (a water fleck each dip), then flushes. Purely ambient — no water level.
  _scheduleBirdBathVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Daylit, awake, fair weather. Skip while a bath visitor is already splashing.
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() &&
          this.props?.birdBath && !this._wildCritters?.some((c) => c.atBath)) {
        this._spawnBirdBathVisit();
      }
      const morning = this._phase === 'Morning';
      this._scheduleBirdBathVisit(morning ? Phaser.Math.Between(9000, 18000)
                                          : Phaser.Math.Between(18000, 40000));
    });
  }

  _spawnBirdBathVisit() {
    const bath = this.props.birdBath;
    // Land in the basin (see the landing-spot notes at the top of this file).
    const rimX = bath.x + Phaser.Math.Between(-BATH_PERCH_SPREAD, BATH_PERCH_SPREAD);
    const rimY = bath.y - BATH_PERCH_UP;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = this._pickBird();
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, rimY - 200, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(bath.y + 1)
      .setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, bird: b, atBath: true, fixedDepth: true };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > rimX);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, rimX, rimY);
    c.tween = this.tweens.add({
      targets: sprite, x: rimX, y: rimY, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        sprite.play(b.peckAnim);
        this.registerBirdVisit?.('bath', b.type.id, { x: rimX, y: rimY }); // #223 befriending tally
        this._birdBathSplash(c, Phaser.Math.Between(4, 7));
      },
    });
  }

  // Dip + splash `n` times (a droplet each dip), then flush via _birdTakeOff — so the
  // rain/night clear and player-crowd startle all behave like a ground perch.
  _birdBathSplash(c, n) {
    if (!c.sprite.active || c.state !== 'perched') return;
    if (n <= 0) { this._birdTakeOff(c); return; }
    const sprite = c.sprite;
    if (Math.random() < 0.4) sprite.setFlipX(!sprite.flipX);
    c.tween = this.tweens.add({
      targets: sprite, y: sprite.y + 4, duration: 130, yoyo: true, ease: 'Quad.easeIn',
      onStart: () => this._bathDroplet(sprite.x, sprite.y),
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(350, 900),
        () => this._birdBathSplash(c, n - 1)),
    });
  }

  // A tiny water droplet arcing off the basin as a bird splashes — cosmetic sparkle.
  _bathDroplet(x, y) {
    const dx = Phaser.Math.Between(-14, 14);
    const drop = this.add.image(x, y, 'fishRipple')
      .setScale(S * 0.18).setDepth(y + 2).setAlpha(0.85).setTint(0xbfeaff);
    this.tweens.add({
      targets: drop, x: x + dx, y: y - Phaser.Math.Between(6, 14),
      alpha: 0, scaleX: S * 0.05, scaleY: S * 0.05,
      duration: Phaser.Math.Between(350, 550), ease: 'Sine.easeOut',
      onComplete: () => drop.destroy(),
    });
  }

  // ── Birdhouse (#218) ── a songbird flies to the perch dowel below the entrance hole,
  // bobs/looks around a few times (as if checking the nest), then flushes. Purely
  // decorative + ambient — no fill/drain, no naming (that's future #223) — the
  // birdhouse is always "active" so this beat just needs it to exist.
  _scheduleBirdhouseVisit(delay) {
    this.time.delayedCall(delay, () => {
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() &&
          this.props?.birdhouse && !this._wildCritters?.some((c) => c.atBirdhouse)) {
        this._spawnBirdhouseVisit();
      }
      const morning = this._phase === 'Morning';
      this._scheduleBirdhouseVisit(morning ? Phaser.Math.Between(8000, 16000)
                                           : Phaser.Math.Between(16000, 34000));
    });
  }

  _spawnBirdhouseVisit() {
    const bh = this.props.birdhouse;
    // Land on the perch dowel (see the landing-spot notes at the top of this file).
    const px = bh.x + Phaser.Math.Between(-BIRDHOUSE_PERCH_SPREAD, BIRDHOUSE_PERCH_SPREAD);
    const py = bh.y - BIRDHOUSE_PERCH_UP;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = this._pickBird();
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, py - 200, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(bh.y + 1)
      .setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, bird: b, atBirdhouse: true, fixedDepth: true };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > px);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, px, py);
    c.tween = this.tweens.add({
      targets: sprite, x: px, y: py, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        sprite.play(b.peckAnim);
        this.registerBirdVisit?.('birdhouse', b.type.id, { x: px, y: py }); // #223 befriending tally
        this._birdhouseLook(c, Phaser.Math.Between(3, 6));
      },
    });
  }

  // Bob/look around `n` times on the perch (like checking the nest hole), then flush.
  _birdhouseLook(c, n) {
    if (!c.sprite.active || c.state !== 'perched') return;
    if (n <= 0) { this._birdTakeOff(c); return; }
    const sprite = c.sprite;
    if (Math.random() < 0.4) sprite.setFlipX(!sprite.flipX);
    c.tween = this.tweens.add({
      targets: sprite, y: sprite.y - 3, duration: 140, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(400, 1000),
        () => this._birdhouseLook(c, n - 1)),
    });
  }

  // ── Seed feeder (#240) ── when the feeder is STOCKED, songbirds land on its tray to
  // eat (draining one serving each via drainSeedFeeder). An empty feeder attracts none,
  // so refilling it is what brings the birds back.
  _scheduleFeederVisit(delay) {
    this.time.delayedCall(delay, () => {
      const f = this.props?.seedFeeder;
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() &&
          f?.filled && !this._wildCritters?.some((c) => c.atFeeder)) {
        this._spawnFeederVisit();
      }
      const morning = this._phase === 'Morning';
      this._scheduleFeederVisit(morning ? Phaser.Math.Between(6000, 13000)
                                        : Phaser.Math.Between(13000, 28000));
    });
  }

  _spawnFeederVisit() {
    const f = this.props.seedFeeder;
    // Land on the tray (see the landing-spot notes at the top of this file).
    const tx = f.x + Phaser.Math.Between(-FEEDER_PERCH_SPREAD, FEEDER_PERCH_SPREAD);
    const ty = f.y - FEEDER_PERCH_UP;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = this._pickBird();
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, ty - 200, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(f.y + 1)
      .setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, bird: b, atFeeder: true, fixedDepth: true };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > tx);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        this.drainSeedFeeder?.(); // eat one serving
        sprite.play(b.peckAnim);
        this.registerBirdVisit?.('feeder', b.type.id, { x: tx, y: ty }); // #223 befriending tally
        this._feederPeck(c, Phaser.Math.Between(3, 6));
      },
    });
  }

  // Peck `n` times at the tray, then flush (or when startled) — like the ground perch.
  _feederPeck(c, n) {
    if (!c.sprite.active || c.state !== 'perched') return;
    if (n <= 0) { this._birdTakeOff(c); return; }
    const sprite = c.sprite;
    if (Math.random() < 0.4) sprite.setFlipX(!sprite.flipX);
    c.tween = this.tweens.add({
      targets: sprite, y: sprite.y - 4, duration: 130, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(400, 1100),
        () => this._feederPeck(c, n - 1)),
    });
  }

  // ─── Hummingbird (#226) ───────────────────────────────────────────────────────
  // A rare hover-and-dart visitor with a distinct shape from the perching songbirds:
  // it never lands — it hovers in the air near a target (a flower, or the STOCKED
  // nectar feeder), bobbing with its wing-buzz, then DARTS quickly to the next target a
  // few times before zipping off. Attracted BOTH by the nectar feeder (while filled;
  // sipping there drains it) AND by the existing flowers (world.js props.flowers). It's
  // its own critter kind (`hummer`) so updateWildlife leaves it alone — it's airborne,
  // so it isn't depth-sorted to the ground or startled by the player (like a fly-by).

  // A shuffled list of hover targets: every flower, plus the nectar feeder's port when
  // it's stocked (so a filled feeder is one more place it visits, on top of the flowers).
  _hummerTargets() {
    const pts = (this.props.flowers ?? []).map((fl) => ({ x: fl.x, y: fl.y - 6, feeder: false }));
    const nf = this.props.nectarFeeder;
    if (nf?.filled) pts.push({ x: nf.x, y: nf.y - 38, feeder: true }); // hover at the ports
    return pts;
  }

  _scheduleHummingbirdVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Daylit, awake, fair weather. Only when there's somewhere to visit (flowers
      // always exist, so this is effectively always true) and none is already here.
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() &&
          this._hummerTargets().length && !this._wildCritters?.some((c) => c.kind === 'hummer')) {
        this._spawnHummingbird();
      }
      // Rare — a treat, like the rarer bird types. A touch more common in the morning.
      const morning = this._phase === 'Morning';
      this._scheduleHummingbirdVisit(morning ? Phaser.Math.Between(16000, 32000)
                                             : Phaser.Math.Between(28000, 60000));
    });
  }

  _spawnHummingbird() {
    const targets = this._hummerTargets();
    const first = targets[Phaser.Math.Between(0, targets.length - 1)];
    const dir = first.x < WORLD_W / 2 ? 1 : -1; // enter from the nearer side
    const sprite = this.add.sprite(dir === 1 ? -30 : WORLD_W + 30, first.y - 40, 'hummer_0')
      .setOrigin(0.5, 0.5).setScale(WILD_SCALE).setDepth(100000).setFlipX(dir === -1)
      .play('hummer_buzz');
    const c = { sprite, kind: 'hummer', ground: false, state: 'arriving', tween: null };
    this._wildCritters.push(c);
    this._hummerDartTo(c, first, Phaser.Math.Between(3, 6));
  }

  // Dart quickly to `target`, hover-bob there a moment (sipping if it's the feeder),
  // then repeat to another random target `n` more times before zipping off-screen.
  _hummerDartTo(c, target, n) {
    if (!c.sprite.active) return;
    const sprite = c.sprite;
    sprite.setFlipX(target.x < sprite.x); // face the way it's darting
    c.tween = this.tweens.add({
      targets: sprite, x: target.x, y: target.y,
      duration: Phaser.Math.Between(280, 520), ease: 'Sine.easeOut', // fast dart
      onComplete: () => {
        if (!sprite.active) return;
        if (target.feeder) this.drainNectarFeeder?.(); // a sip lowers the feeder
        this._hummerHover(c, n, target);
      },
    });
  }

  // Hover in place with a tiny bob for a beat, then dart on (or leave when out of hops).
  _hummerHover(c, n, target) {
    if (!c.sprite.active) return;
    const sprite = c.sprite;
    c.tween = this.tweens.add({
      targets: sprite, y: sprite.y + Phaser.Math.Between(3, 6),
      duration: 220, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!sprite.active) return;
        if (n <= 0) { this._hummerLeave(c); return; }
        const targets = this._hummerTargets();
        const next = targets[Phaser.Math.Between(0, targets.length - 1)];
        this.time.delayedCall(Phaser.Math.Between(120, 400), () => this._hummerDartTo(c, next, n - 1));
      },
    });
  }

  // Zip off the nearest edge and despawn (reuses wildlife.js _despawnCritter cleanup).
  _hummerLeave(c) {
    if (!c.sprite.active) { this._despawnCritter(c); return; }
    const sprite = c.sprite;
    const toLeft = sprite.x < WORLD_W / 2;
    sprite.setFlipX(toLeft);
    c.tween = this.tweens.add({
      targets: sprite, x: toLeft ? -40 : WORLD_W + 40, y: Phaser.Math.Between(60, 180),
      duration: Phaser.Math.Between(700, 1200), ease: 'Sine.easeIn',
      onComplete: () => this._despawnCritter(c),
    });
  }

  // ─── Bees (#239) ──────────────────────────────────────────────────────────────
  // A benign honeybee drifts out of the hive, meanders between the hive and a couple of
  // nearby flowers with a lazy wandering flight (slower + wider than the hummingbird's
  // sharp darts), then drifts back off. PURELY benign — no sting, no player interaction,
  // no effect on stats; just ambient charm around the hive. Its own critter kind ('bee')
  // so updateWildlife leaves it airborne (not depth-sorted/startled), and rain clears it.

  // Wander points for a bee: the hive plus a few of the nearest flowers to it, so the bee
  // reads as foraging around its own hive rather than teleporting across the whole map.
  _beeTargets() {
    const h = this.props.beehive;
    if (!h) return [];
    const flowers = (this.props.flowers ?? [])
      .map((fl) => ({ x: fl.x, y: fl.y - 6 }))
      .sort((a, b) => Phaser.Math.Distance.Between(h.x, h.y, a.x, a.y) -
                      Phaser.Math.Distance.Between(h.x, h.y, b.x, b.y))
      .slice(0, 5);
    return [{ x: h.x, y: h.y - 22 }, ...flowers];
  }

  _scheduleBeeVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Daylit, awake, fair weather (bees shelter in the rain). Only when the hive exists
      // and there aren't already a couple of bees out.
      const bees = this._wildCritters?.filter((c) => c.kind === 'bee').length ?? 0;
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife() &&
          this._beeTargets().length && bees < 2) {
        this._spawnBeeVisit();
      }
      this._scheduleBeeVisit(Phaser.Math.Between(9000, 22000));
    });
  }

  _spawnBeeVisit() {
    const h = this.props.beehive;
    const sprite = this.add.sprite(h.x + Phaser.Math.Between(-6, 6), h.y - 22, 'bee_0')
      .setOrigin(0.5, 0.5).setScale(WILD_SCALE).setDepth(100000).play('bee_buzz');
    const c = { sprite, kind: 'bee', ground: false, state: 'buzzing', tween: null };
    this._wildCritters.push(c);
    this._beeWanderTo(c, Phaser.Math.Between(4, 8));
  }

  // Meander to a random nearby target with a slow arc; repeat `n` times, then drift home
  // to the hive and despawn. Slower, wider and wobblier than the hummingbird dart.
  _beeWanderTo(c, n) {
    if (!c.sprite.active) return;
    const sprite = c.sprite;
    if (n <= 0) { this._beeLeave(c); return; }
    const targets = this._beeTargets();
    const t = targets[Phaser.Math.Between(0, targets.length - 1)];
    const tx = t.x + Phaser.Math.Between(-14, 14), ty = t.y + Phaser.Math.Between(-12, 12);
    sprite.setFlipX(tx < sprite.x);
    c.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: Phaser.Math.Between(900, 1600), ease: 'Sine.easeInOut', // lazy drift
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(200, 700),
        () => this._beeWanderTo(c, n - 1)),
    });
  }

  // Drift back to the hive entrance and vanish (reuses _despawnCritter cleanup).
  _beeLeave(c) {
    const h = this.props.beehive;
    if (!c.sprite.active || !h) { this._despawnCritter(c); return; }
    c.tween = this.tweens.add({
      targets: c.sprite, x: h.x, y: h.y - 22, alpha: 0,
      duration: Phaser.Math.Between(800, 1400), ease: 'Sine.easeIn',
      onComplete: () => this._despawnCritter(c),
    });
  }
};
