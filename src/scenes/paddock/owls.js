// The ambient NOCTURNAL OWL (issue #271). Owls are ambient wildlife — NOT a cared-for
// roster species (like the songbirds/raccoon, not the horses/chickens): they glide in
// after dark, perch, hoot a couple of times, and glide off, for cozy night atmosphere.
// They register into the ambient-events registry (#253) so a single declared entry
// puts them in both the random rotation AND the dev overlay.
//
// Kept in its OWN mixin (not piled into wildlife.js) so this owl work and a parallel
// foxes agent don't collide on the shared ambient files. Composed onto PaddockScene
// alongside WithWildlife/WithRaccoon, so `this` is the scene and the shared critter
// plumbing (_wildCritters, _despawnCritter) resolves there.
//
// The pure decisions (active phase = night only, appear roll, visit cadence) live in
// data/owls.js so they're Phaser-free and unit-tested; this file wires them to sprites,
// tweens, and the hoot sound. Owls are strictly NIGHT-active (isNight === true) — a
// tighter window than the raccoon's dusk+night "nocturnal".

import Phaser from 'phaser';
import { BOUNDS, S } from './constants.js';
import { offscreenX, exitX } from './offscreen.js';
import { ART_SCALE } from '../../art/_frames.js';
import { playOwlHoot } from '../../audio/sounds.js';
import { shouldOwlAppear, owlVisitDelay } from '../../data/owls.js';
import { owlTexKey, owlAnimKey } from '../../art/owlArt.js';

const OWL_SCALE = S / ART_SCALE; // same on-screen sizing as the other wildlife sprites

export const WithOwls = (Base) => class extends Base {
  // Called once from buildWildlife (via startOwls) to register the owl animations and
  // kick off the first scheduled visit. Safe to call once.
  buildOwls() {
    this._owls = []; // owls currently perched/gliding (subset of the ambient life)
    const anim = (key, frames, frameRate) => {
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate, repeat: -1 });
      }
    };
    // Perched: a slow blink loop. Gliding: a slow silent flap.
    anim(owlAnimKey('perched'), [owlTexKey('perched', 0), owlTexKey('perched', 1)], 1.2);
    anim(owlAnimKey('glide'),   [owlTexKey('glide', 0),   owlTexKey('glide', 1)],   4);

    this._scheduleOwlVisit(Phaser.Math.Between(6000, 16000));
  }

  // Own low-frequency pacing (like the raccoon's), on TOP of the ambient-event rotation
  // that can also fire an owl. Night-only + awake, decided by the pure helper.
  _scheduleOwlVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Rain sends the owl to cover too (#188), matching the other ambient wildlife.
      if (this._weatherAllowsWildlife() &&
          shouldOwlAppear({ phase: this._phase, sleeping: this._sleeping })) {
        this._spawnOwl();
      }
      this._scheduleOwlVisit(owlVisitDelay(this._phase, Phaser.Math.Between));
    });
  }

  // Pick a perch spot high in the scene (up near the tree-line above the play bounds)
  // and glide the owl in from the nearer side to land there, then hoot + blink a few
  // times before gliding off. Only one owl out at a time keeps it a quiet treat.
  _spawnOwl() {
    if (this._owls?.some((c) => c.sprite?.active)) return; // one owl at a time

    // A perch spot: horizontally somewhere across the world, sitting high (a silhouette
    // against the night sky, above the pasture action). FIRST-PASS placement — the
    // owner can redirect the perch band in the live preview.
    const px = Phaser.Math.Between(BOUNDS.minX + 120, BOUNDS.maxX - 120);
    const py = Phaser.Math.Between(80, 200);

    // Glide in from just past whichever side of the CURRENT view is nearer the perch
    // (#354): the old fixed farm-edge x now sits mid-map, so the owl popped into view.
    const fromLeft = exitX(this, px, 40).toLeft;
    const startX = offscreenX(this, fromLeft, 40, px);
    const startY = py - Phaser.Math.Between(40, 90);

    const sprite = this.add.sprite(startX, startY, owlTexKey('glide', 0))
      .setOrigin(0.5, 1).setScale(OWL_SCALE).setDepth(100000)
      .setFlipX(startX > px).play(owlAnimKey('glide'));
    const c = { sprite, kind: 'owl', ground: false, state: 'gliding', tween: null };
    this._owls.push(c);
    this._wildCritters?.push(c); // so rain-clear / scene teardown reach it too

    const dist = Phaser.Math.Distance.Between(startX, startY, px, py);
    c.tween = this.tweens.add({
      targets: sprite, x: px, y: py,
      duration: Math.max(1100, dist * 3), ease: 'Sine.easeIn',
      onComplete: () => {
        if (!sprite.active) return;
        c.state = 'perched';
        sprite.play(owlAnimKey('perched'));
        this._owlHootLoop(c, Phaser.Math.Between(2, 4));
      },
    });
  }

  // Perched: hoot `n` times with a pause between each, then glide off. Bails if the owl
  // is cleared (rain/teardown) mid-loop.
  _owlHootLoop(c, n) {
    if (!c.sprite?.active || c.state !== 'perched') return;
    if (n <= 0) { this._owlGlideOff(c); return; }
    // Hoot only while it's actually night + not asleep (so a phase change mid-perch
    // hushes it). A little head-bob accompanies the call.
    if (shouldOwlAppear({ phase: this._phase, sleeping: this._sleeping })) {
      playOwlHoot();
      this.tweens.add({
        targets: c.sprite, y: c.sprite.y - 3, duration: 160, yoyo: true, ease: 'Quad.easeOut',
      });
    }
    this.time.delayedCall(Phaser.Math.Between(1400, 2800), () => this._owlHootLoop(c, n - 1));
  }

  // Glide off the nearest side and despawn (reuses the shared _despawnCritter cleanup so
  // it drops out of both _owls and _wildCritters).
  _owlGlideOff(c) {
    if (!c.sprite?.active) { this._despawnOwl(c); return; }
    c.state = 'leaving';
    const sprite = c.sprite;
    sprite.play(owlAnimKey('glide'));
    const exit = exitX(this, sprite.x); // leave past the current view edge (#354)
    sprite.setFlipX(exit.toLeft);
    if (c.tween) { c.tween.stop(); c.tween = null; }
    c.tween = this.tweens.add({
      targets: sprite,
      x: exit.x, y: sprite.y - Phaser.Math.Between(40, 120),
      duration: Phaser.Math.Between(1600, 2600), ease: 'Sine.easeIn',
      onComplete: () => this._despawnOwl(c),
    });
  }

  // Remove the owl from BOTH tracking lists and tear its sprite/tween down. Delegates to
  // wildlife.js's _despawnCritter for the _wildCritters list + sprite cleanup so the
  // behaviour matches the other critters exactly.
  _despawnOwl(c) {
    const i = this._owls?.indexOf(c);
    if (i >= 0) this._owls.splice(i, 1);
    this._despawnCritter?.(c);
  }
};
