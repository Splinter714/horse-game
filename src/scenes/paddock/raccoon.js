// The ambient raccoon (#181 + #191 mischief). Split out of wildlife.js so that file
// stays under the size budget once the trash-can rummaging and cosmetic theft landed.
// Applied as a functional mixin composed onto PaddockScene alongside WithWildlife, so
// `this` is the scene and the shared critter list / despawn helpers resolve there.
//
// Behaviour: a raccoon scurries in from a side at dusk/night (nocturnal), ambles
// between the farm's props rummaging at each — and, when it reaches the trash can,
// tips the lid off, strews some rubbish, digs a beat, then tidies up. Sometimes it
// scurries off clutching a morsel (cosmetic "theft" — it takes NOTHING real: no farm
// stand stock, no money). Skittish: bolts the instant the player crowds it.
//
// The pure decisions (active phase, spawn roll, bolt, rummage/loot gates) live in
// data/wildlife.js so they're Phaser-free and unit-tested; this file wires them to
// sprites and tweens.

import Phaser from 'phaser';
import { WORLD_W, BOUNDS, S } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';
import {
  isRaccoonActivePhase, shouldRaccoonSpawn, raccoonVisitDelay,
  shouldRummageTrash, shouldGrabLoot,
} from '../../data/wildlife.js';

const WILD_SCALE = S / ART_SCALE; // same on-screen size as the other wildlife sprites

export const WithRaccoon = (Base) => class extends Base {
  _scheduleRaccoonVisit(delay) {
    this.time.delayedCall(delay, () => {
      // Rain sends the raccoon to cover too (#188) — it only comes out in fair weather.
      if (this._weatherAllowsWildlife() &&
          shouldRaccoonSpawn({ phase: this._phase, sleeping: this._sleeping, roll: Math.random() })) {
        this._spawnRaccoon();
      }
      this._scheduleRaccoonVisit(raccoonVisitDelay(this._phase, Phaser.Math.Between));
    });
  }

  _spawnRaccoon() {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -30 : WORLD_W + 30;
    const y = Phaser.Math.Between(BOUNDS.minY + 60, BOUNDS.maxY);
    const sprite = this.add.sprite(x, y, 'raccoon_idle_0')
      .setOrigin(0.5, 1).setScale(WILD_SCALE).setDepth(y).setFlipX(!fromLeft).play('raccoon_run');
    const c = { sprite, kind: 'raccoon', ground: true, state: 'darting', tween: null, fleeing: false, loot: null };
    this._wildCritters.push(c);
    // First dash brings it on-screen, then it potters between a few spots.
    const inX = fromLeft ? Phaser.Math.Between(200, 500) : WORLD_W - Phaser.Math.Between(200, 500);
    this._raccoonDartTo(c, inX, y, () => this._raccoonDart(c, Phaser.Math.Between(2, 4)));
  }

  // Quick dash to (tx,ty): play the run cycle, face the movement, then onArrive.
  // A held loot sprite (if any) rides along on the tween.
  _raccoonDartTo(c, tx, ty, onArrive) {
    if (!c.sprite.active) return;
    const sprite = c.sprite;
    sprite.setFlipX(tx < sprite.x);
    sprite.play('raccoon_run', true);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    // ms-per-pixel of travel (higher = slower). A calm amble — slower than a horse
    // (~11), not a blur (tuned down twice on owner feedback, #181).
    const targets = c.loot ? [sprite, c.loot] : sprite;
    c.tween = this.tweens.add({
      targets, x: tx, y: ty, duration: Math.max(700, dist * 9), ease: 'Sine.easeInOut',
      onUpdate: () => { if (c.loot) { c.loot.x = sprite.x; c.loot.y = sprite.y - 10; c.loot.setDepth(sprite.y + 1); } },
      onComplete: () => { c.tween = null; onArrive?.(); },
    });
  }

  // Potter: amble to a nearby prop, rummage a beat, repeat `n` times, then leave.
  _raccoonDart(c, n) {
    if (!c.sprite.active || c.fleeing) return;
    if (n <= 0) { this._raccoonScurryOff(c); return; }
    const t = this._raccoonNextTarget(c);
    this._raccoonDartTo(c, t.x, t.y, () => {
      if (!c.sprite.active || c.fleeing) return;
      if (t.trash && shouldRummageTrash({ atTrashCan: true, hasTrashCan: true, roll: Math.random() })) {
        this._raccoonRummageTrash(c, n);
      } else {
        c.sprite.play('raccoon_idle', true); // pause and rummage at the prop
        this.time.delayedCall(Phaser.Math.Between(1000, 3000), () => this._raccoonDart(c, n - 1));
      }
    });
  }

  // Trash-can mischief (#191): tip the lid off, strew a bit of rubbish, dig for a
  // few beats (idle bobs), then tidy up (lid back on, spill cleared) and, sometimes,
  // slink off with a cosmetic morsel. Nothing real is consumed.
  _raccoonRummageTrash(c, n) {
    const can = this.props.trashCan;
    if (!can?.sprite?.active) { this._raccoonDart(c, n - 1); return; }
    can.open = true;
    can.sprite.setTexture('trashCanOpen');
    if (!can.spill) {
      can.spill = this.add.image(can.x + 22, can.y - 6, 'trashSpill')
        .setScale(S).setDepth(can.y + 1).setOrigin(0.5, 0.5);
    }
    c.sprite.play('raccoon_idle', true);
    this.time.delayedCall(Phaser.Math.Between(1600, 3200), () => {
      if (!c.sprite.active) { this._tidyTrash(can); return; }
      // Grab a cosmetic morsel to carry off (if not fleeing and not already holding).
      if (!c.fleeing && !c.loot && shouldGrabLoot({ roll: Math.random() })) {
        c.loot = this.add.image(c.sprite.x, c.sprite.y - 10, 'raccoonLoot')
          .setScale(S).setDepth(c.sprite.y + 1).setOrigin(0.5, 0.5);
      }
      this._tidyTrash(can);
      if (c.fleeing) return; // a bolt during the dig already handled the exit
      this._raccoonDart(c, n - 1);
    });
  }

  // Restore the trash can to tidy (lid on, spill cleared).
  _tidyTrash(can) {
    if (!can) return;
    can.open = false;
    if (can.sprite?.active) can.sprite.setTexture('trashCan');
    if (can.spill) { can.spill.destroy(); can.spill = null; }
  }

  // Choose the raccoon's next stop: a *nearby* prop (so it ambles prop-to-prop
  // rather than teleporting), with jitter so it stands beside — not on — the prop.
  // Falls back to a random clear spot if none are reachable.
  _raccoonNextTarget(c) {
    const near = this._raccoonPropTargets()
      .map((t) => ({ ...t, d: Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, t.x, t.y) }))
      .filter((t) => t.d > 50)          // don't re-pick the spot it's already at
      .sort((a, b) => a.d - b.d);
    if (near.length) {
      const base = near[Phaser.Math.Between(0, Math.min(3, near.length - 1))]; // one of the closest few
      const jx = Phaser.Math.Clamp(base.x + Phaser.Math.Between(-24, 24), BOUNDS.minX, BOUNDS.maxX);
      const jy = Phaser.Math.Clamp(base.y + Phaser.Math.Between(-16, 16), BOUNDS.minY, BOUNDS.maxY);
      const jittered = this._collides(jx, jy, 16, this.obstacles) ? { x: base.x, y: base.y } : { x: jx, y: jy };
      return { ...jittered, trash: !!base.trash };
    }
    // Fallback: a random nearby clear point.
    let tx = c.sprite.x, ty = c.sprite.y;
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2, r = Phaser.Math.Between(120, 320);
      tx = Phaser.Math.Clamp(c.sprite.x + Math.cos(ang) * r, BOUNDS.minX, BOUNDS.maxX);
      ty = Phaser.Math.Clamp(c.sprite.y + Math.sin(ang) * r, BOUNDS.minY + 40, BOUNDS.maxY);
      if (!this._collides(tx, ty, 16, this.obstacles)) break;
    }
    return { x: tx, y: ty, trash: false };
  }

  // Grass spots just in front of the farm's props for the raccoon to rummage at —
  // south of each so it stands clear of the prop's own collision footprint. The
  // trash can is flagged `trash` so it triggers the richer rummage animation.
  _raccoonPropTargets() {
    const p = this.props, out = [];
    if (p.house) out.push({ x: p.house.x + 40, y: p.house.y + 80 });
    if (p.barn) out.push({ x: p.barn.x + 40, y: p.barn.y + 80 });
    if (p.coop) out.push({ x: p.coop.x, y: p.coop.y + 48 });
    if (p.trashCan) out.push({ x: p.trashCan.x - 34, y: p.trashCan.y + 8, trash: true }); // beside the can
    for (const s of (p.sources ?? [])) out.push({ x: s.x, y: s.y + 36 }); // hay/gardens/grain/well
    for (const nst of (p.nests ?? [])) out.push({ x: nst.x, y: nst.y + 24 }); // after the eggs…
    if (this.farmStand) out.push({ x: this.farmStand.x, y: this.farmStand.y + 42 });
    return out
      .map((t) => ({ ...t, x: Phaser.Math.Clamp(t.x, BOUNDS.minX, BOUNDS.maxX), y: Phaser.Math.Clamp(t.y, BOUNDS.minY, BOUNDS.maxY) }))
      .filter((t) => !this._collides(t.x, t.y, 16, this.obstacles));
  }

  // Bolt off the nearest side and despawn — carrying any loot with it, tidying any
  // trash can it left open. Skittish exit; also the finish of a normal potter.
  _raccoonScurryOff(c) {
    if (c.fleeing || !c.sprite.active) return;
    c.fleeing = true; c.state = 'leaving';
    if (this.props.trashCan?.open) this._tidyTrash(this.props.trashCan);
    if (c.tween) { c.tween.stop(); c.tween = null; }
    const toLeft = c.sprite.x < WORLD_W / 2;
    this._raccoonDartTo(c, toLeft ? -40 : WORLD_W + 40, c.sprite.y, () => {
      if (c.loot) { c.loot.destroy(); c.loot = null; }
      this._despawnCritter(c);
    });
  }
};
