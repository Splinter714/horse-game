// Bird befriending (#223) — the scene-coupled half of "keep the birdhouse/bath/feeder
// maintained and a specific bird warms up to you." Builds on the already-landed
// bird-ecosystem props (birdEcosystem.js) and their ambient visit beats
// (birdEcosystemVisits.js), which already spawn a `_pickBird()` type at each spot.
// This mixin hooks the SAME visit beats (via a small tap each spot calls on arrival)
// to tick the pure `visitBird` counter (data/birdFriendship.js) per bird TYPE, and once
// a type crosses BIRD_FRIEND_VISITS it commits: that type becomes a NAMED, persistent
// "regular" that periodically flies in on its own schedule to perch near the player
// and lingers — distinct from the untracked ambient birds that just fly through and
// flush off. Capped at BIRD_FRIEND_CAP.
//
// Mirrors the fox-taming shape (paddock/fox.js): a pure counter, a commit moment, a
// small persisted roster, its own module so it doesn't collide with parallel bird work
// (#220 variety, other species agents). Unlike the fox, a befriended bird isn't a
// roster/care Animal — it stays a lightweight ambient individual (it has no needs of
// its own; the player earns its trust by tending the shared props), so there's no new
// species/model — just a name + a distinct behavior loop layered onto the existing
// bird art/animations.

import Phaser from 'phaser';
import { S, WORLD_W, BOUNDS } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';
import { BIRD_TYPES, getBirdType } from '../../data/wildlife.js';
import { birdTexKey, birdAnimKey } from '../../art/wildlifeArt.js';
import { visitBird, isQualifyingVisit, BIRD_FRIEND_CAP } from '../../data/birdFriendship.js';
import { loadBirdFriendship, saveBirdFriendship } from '../../data/save.js';

const FRIEND_SCALE = S / ART_SCALE; // super-sampled bird art, shown at S/ART_SCALE

// A little pool of cozy names handed out in order as birds are won over — keeps a
// befriended bird feeling like a specific named regular without needing player input.
const FRIEND_NAMES = ['Pip', 'Sunny', 'Chirp', 'Berry', 'Willow', 'Marigold', 'Dot', 'Fig'];

export const WithBirdFriendship = (Base) => class extends Base {
  // Called from create(): restore the persisted visit tallies + named roster, then
  // spawn each already-befriended regular so a returning player's birds are there
  // from the start. No new textures/anims needed — reuses the ambient bird set
  // (buildWildlife already creates bird_<type>_fly/peck anims for every BIRD_TYPES id).
  buildBirdFriendship() {
    const state = loadBirdFriendship();
    this._birdFriendCounts = { ...state.counts };   // { [typeId]: visitTally }
    this._birdFriendRoster = [...state.roster];      // [{ typeId, name }] in commit order
    this._friendlyBirds = [];                        // active regular sprites: { sprite, shadow, typeId, name, tween, state }

    for (const entry of this._birdFriendRoster) this._spawnFriendlyBird(entry, true);
    this._scheduleFriendlyBirdVisit(Phaser.Math.Between(9000, 18000));
  }

  // The single entry point the visit beats (birdEcosystemVisits.js) call right as a
  // bird lands at a maintained spot — `spot` is 'birdhouse' | 'bath' | 'feeder',
  // `typeId` is the bird type that landed (from `_pickBird()`), `at` is where it
  // perched (for the little sparkle + so a fresh commit can appear right there).
  registerBirdVisit(spot, typeId, at) {
    if (!typeId) return;
    const feederFilled = !!this.props?.seedFeeder?.filled;
    if (!isQualifyingVisit(spot, { feederFilled })) return;

    const alreadyBefriended = this._birdFriendRoster.some((b) => b.typeId === typeId);
    const rosterFull = this._birdFriendRoster.length >= BIRD_FRIEND_CAP;
    const step = visitBird(this._birdFriendCounts[typeId] ?? 0, { alreadyBefriended, rosterFull });
    this._birdFriendCounts[typeId] = step.count;
    this._saveBirdFriendship();

    if (step.befriended) this._commitFriendlyBird(typeId, at);
  }

  _saveBirdFriendship() {
    saveBirdFriendship({ counts: this._birdFriendCounts, roster: this._birdFriendRoster });
  }

  // A bird type just crossed the visit threshold: name it, add it to the small
  // persisted roster, and spawn it in as a proper regular at the spot that won it
  // over — a little heart + name popup so the moment reads clearly.
  _commitFriendlyBird(typeId, at) {
    if (this._birdFriendRoster.length >= BIRD_FRIEND_CAP) return; // defensive — cap race
    const name = FRIEND_NAMES[this._birdFriendRoster.length % FRIEND_NAMES.length];
    const entry = { typeId, name };
    this._birdFriendRoster.push(entry);
    this._saveBirdFriendship();
    const a = this._spawnFriendlyBird(entry, false, at);
    if (a?.sprite) this.showHeart?.(a.sprite);
    return a;
  }

  // Spawn a named regular's sprite. `settleImmediately` (boot restore) places it
  // idling near its home prop instead of flying in; a fresh commit (`at`) appears
  // right where it was won over. Distinct from an ambient bird: it never fully
  // leaves — it perches, wanders a little, and periodically approaches the player.
  _spawnFriendlyBird(entry, settleImmediately, at) {
    const type = getBirdType(entry.typeId);
    const home = at ?? this._friendHomeSpot();
    const x = settleImmediately ? home.x : home.x, y = settleImmediately ? home.y : home.y - 60;
    const sprite = this.add.sprite(x, y, birdTexKey(type.id, 'peck', 0))
      .setOrigin(0.5, 1).setScale(FRIEND_SCALE).setDepth(y).play(birdAnimKey(type.id, 'peck'));
    const shadow = this.add.image(x, y, 'shadow')
      .setScale(S * 0.18).setDepth(y - 1);
    const rec = { sprite, shadow, typeId: type.id, name: entry.name, tween: null, state: 'perched' };
    this._friendlyBirds.push(rec);
    if (!settleImmediately) {
      // A little settle-in hop so a fresh commit reads as landing, not popping in.
      sprite.y = home.y - 30; shadow.setPosition(home.x, home.y);
      rec.tween = this.tweens.add({
        targets: sprite, x: home.x, y: home.y, duration: 500, ease: 'Sine.easeOut',
        onComplete: () => { rec.tween = null; this._friendlyBirdIdle(rec); },
      });
    } else {
      this.time.delayedCall(Phaser.Math.Between(400, 2000), () => this._friendlyBirdIdle(rec));
    }
    return rec;
  }

  // Somewhere near the bird-ecosystem props to call home — prefers the birdhouse,
  // falls back to the bath/feeder, and finally a fixed yard spot if none exist yet
  // (defensive; buildBirdEcosystem always runs first in create()).
  _friendHomeSpot() {
    const p = this.props ?? {};
    const src = p.birdhouse ?? p.birdBath ?? p.seedFeeder ?? { x: 500, y: 260 };
    return { x: src.x + Phaser.Math.Between(-30, 30), y: src.y + Phaser.Math.Between(10, 30) };
  }

  // Between little visits home, a friendly bird potters near its home spot instead of
  // vanishing like an ambient critter — it's a recognizable regular, not a fly-through.
  _friendlyBirdIdle(rec) {
    if (!rec.sprite?.active || rec.state === 'approaching') return;
    rec.state = 'idle';
    rec.sprite.play(birdAnimKey(rec.typeId, 'peck'), true);
    this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
      if (!rec.sprite?.active || rec.state !== 'idle') return;
      const home = this._friendHomeSpot();
      this._friendlyBirdHop(rec, home.x, home.y, () => this._friendlyBirdIdle(rec));
    });
  }

  _friendlyBirdHop(rec, tx, ty, onArrive) {
    if (!rec.sprite?.active) return;
    const sprite = rec.sprite;
    sprite.setFlipX(tx < sprite.x);
    sprite.play(birdAnimKey(rec.typeId, 'fly'), true);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    rec.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: Math.max(400, dist * 6), ease: 'Sine.easeInOut',
      onUpdate: () => { sprite.setDepth(sprite.y); rec.shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1); },
      onComplete: () => { rec.tween = null; onArrive?.(); },
    });
  }

  // Periodically, a random befriended bird flies over to approach the player and
  // perch nearby for a beat — the "it recognizes you" payoff distinguishing it from
  // the ambient background birds. Purely cosmetic (no stat effect); just charm.
  _scheduleFriendlyBirdVisit(delay) {
    this.time.delayedCall(delay, () => {
      if (!this._sleeping && this._phase !== 'Night' && this._weatherAllowsWildlife?.() !== false) {
        const candidates = this._friendlyBirds.filter((r) => r.sprite?.active && r.state === 'idle');
        if (candidates.length) {
          const rec = candidates[Phaser.Math.Between(0, candidates.length - 1)];
          this._friendlyBirdApproachPlayer(rec);
        }
      }
      this._scheduleFriendlyBirdVisit(Phaser.Math.Between(20000, 42000));
    });
  }

  _friendlyBirdApproachPlayer(rec) {
    if (!rec.sprite?.active || !this.player?.sprite) return;
    rec.state = 'approaching';
    if (rec.tween) { rec.tween.stop(); rec.tween = null; }
    const p = this.player.sprite;
    const tx = Phaser.Math.Clamp(p.x + Phaser.Math.Between(-28, 28), BOUNDS.minX, BOUNDS.maxX);
    const ty = Phaser.Math.Clamp(p.y - Phaser.Math.Between(24, 36), BOUNDS.minY, BOUNDS.maxY);
    this._friendlyBirdHop(rec, tx, ty, () => {
      if (!rec.sprite?.active) return;
      rec.sprite.play(birdAnimKey(rec.typeId, 'peck'), true);
      // Lingers a while near the player (reads as "checking in"), then heads home.
      this.time.delayedCall(Phaser.Math.Between(2500, 5000), () => {
        if (!rec.sprite?.active) return;
        const home = this._friendHomeSpot();
        this._friendlyBirdHop(rec, home.x, home.y, () => this._friendlyBirdIdle(rec));
      });
    });
  }
};
