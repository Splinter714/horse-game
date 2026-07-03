// Tier-2 bird-ecosystem world objects (#219 bird bath, #240 seed feeder,
// #226 hummingbird sugar-water feeder, #239 beehive). These are the fixed,
// decorative-plus-ambient props that the flying wildlife (paddock/wildlife.js) and
// the bees/hummingbirds hook onto. Kept in their own concern mixin (not world.js)
// so the family of related objects lives together and world.js stays under its
// line budget (#167). Composed onto PaddockScene like the other WithX mixins.
//
// Each builder places a sprite, records a `this.props.<name>` descriptor, and pushes
// any solid footprint into `this.birdEcosystemObstacles` — buildObstacles (world.js)
// spreads that array into this.obstacles, mirroring doghouseObstacles/barnObstacles.

import Phaser from 'phaser';
import { S, WORLD_W } from './constants.js';
import { WILD_SCALE } from './wildlife.js';
import { FEEDER_CAP, fillFeederLevel, drainFeederLevel, feederHasSeed } from '../../data/feeder.js';
import { playSplash } from '../../audio/sounds.js';

export const WithBirdEcosystem = (Base) => class extends Base {
  // One entry point buildWorld calls after the yard props are down. Accumulates the
  // footprints for every bird-ecosystem object into one array world.js spreads.
  buildBirdEcosystem() {
    this.birdEcosystemObstacles = [];
    this.buildBirdBath();   // #219
    this.buildSeedFeeder(); // #240
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
    this.add.image(x, y, 'birdBath').setScale(S).setDepth(y).setOrigin(0.5, 1);
    this.props.birdBath = { x, y };
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
  // FIRST-PASS spot (330, 360) — just east of the house, flagged for the owner to
  // redirect in the live preview.
  buildSeedFeeder() {
    const x = 330, y = 360;
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

  // ─── Object-anchored bird visits (#219 bath, #240 feeder) ─────────────────────
  // These beats are birds visiting THIS mixin's props, so they live here rather than in
  // wildlife.js (which owns the generic critters). They reuse wildlife.js's shared bird
  // plumbing on the same `this`: _pickBird (a random weighted bird + its keys),
  // _birdTakeOff (flush toward the nearest edge + despawn) and the _wildCritters list
  // (so updateWildlife depth-sorts them and startles them off if the player crowds them,
  // via the c.ground flag), plus WILD_SCALE for their display size. Kicked off from
  // buildWildlife via startBirdEcosystemVisits so the timers start with the rest.

  startBirdEcosystemVisits() {
    this._scheduleBirdBathVisit(Phaser.Math.Between(14000, 30000)); // #219 bath splashes
    this._scheduleFeederVisit(Phaser.Math.Between(10000, 22000));   // #240 feeder visits
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
    // Land on the front rim. Sprite 34×40 at S (origin 0.5,1) → water ~26px up.
    const rimX = bath.x + Phaser.Math.Between(-6, 6);
    const rimY = bath.y - 26;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = this._pickBird();
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, rimY - 200, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(bath.y + 1)
      .setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, bird: b, atBath: true };
    this._wildCritters.push(c);

    sprite.setFlipX(sprite.x > rimX);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, rimX, rimY);
    c.tween = this.tweens.add({
      targets: sprite, x: rimX, y: rimY, duration: Math.max(900, dist * 4), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.ground = true; c.state = 'perched';
        sprite.play(b.peckAnim);
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
    // Land on the tray. Sprite 28×56 at S (origin 0.5,1) → tray ~28px up.
    const tx = f.x + Phaser.Math.Between(-8, 8);
    const ty = f.y - 28;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = this._pickBird();
    const sprite = this.add.sprite(dir === 1 ? -40 : WORLD_W + 40, ty - 200, b.tex)
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(f.y + 1)
      .setFlipX(dir === -1).play(b.flyAnim);
    const c = { sprite, kind: 'bird', ground: false, state: 'descending',
                tween: null, fleeing: false, bird: b, atFeeder: true };
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
};
