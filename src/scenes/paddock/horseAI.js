// Horse AI — eat/drink seeking, gate-aware pathing and settling. Applied as a
// functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playEat, playDrink } from '../../audio/sounds.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, GATE_X, GATE_GAP_X0, GATE_GAP_X1 } from './constants.js';

export const WithHorseAI = (Base) => class extends Base {
  // ─── Horse AI — eat / drink ───────────────────────────────────────────────

  horseTick() {
    if (this.isNight) return;
    for (const h of this.horses) {
      if (h.state === 'idle' || h.state === 'wandering') this.horseTickForHorse(h);
    }
  }

  // True if (x, y) is within the gated pasture — horses can only reach food here.
  _inPasture(x, y) {
    const pb = PASTURE_BOUNDS;
    return x >= pb.minX && x <= pb.maxX && y >= pb.minY && y <= pb.maxY;
  }

  // Returns true if horse was directed somewhere; false if it should wander normally.
  horseTickForHorse(h) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[h.key];
    if (!horseData) return false;

    if (horseData.stats.hunger < 95 && this.props.hayPiles.length > 0) {
      const gateOpen = !!this.props.gate?.open;
      let closest = null, closestDist = Infinity;
      for (const pile of this.props.hayPiles) {
        // Hay outside the fence is only reachable when the gate is open
        if (!this._inPasture(pile.x, pile.y) && !gateOpen) continue;
        const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, pile.x, pile.y);
        if (d < closestDist) { closestDist = d; closest = pile; }
      }
      // Only claim the tick if the horse actually started heading to eat.
      // (horseGoEat bails if another horse already took this pile — in which
      // case we must fall through so the horse still wanders, never stranding
      // it idle with no pending move. Same idea for the trough below.)
      if (closest && closestDist < 700 && this.horseGoEat(h, closest)) {
        return true;
      }
    }

    if (horseData.stats.thirst < 95 && this.props.trough?.filled &&
        this._inPasture(this.props.trough.x, this.props.trough.y)) {
      const td = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.props.trough.x, this.props.trough.y);
      if (td < 1000 && this.horseGoDrink(h)) {
        return true;
      }
    }

    // Gate left open + hungry → wander out to come find the player and beg for
    // food, instead of just standing at the open gate. Throttled per horse, and
    // only for horses that bother (not lazy). (issue #26 tweak)
    if (this.props.gate?.open && horseData.stats.hunger < 50 &&
        horseData.temperament !== 'lazy' && this.player) {
      const now = this.time.now;
      if (!h._lastSeek || now - h._lastSeek > 11000) {
        if (this._horseSeekPlayer(h)) { h._lastSeek = now; return true; }
      }
    }

    return false;
  }

  // Hungry horse heads out the open gate toward the player to beg for food, then
  // resumes wandering. Routes via _gatePath so it never clips the fence, and
  // stops a short distance away so the herd doesn't pile onto the player. Returns
  // true if it set off.
  _horseSeekPlayer(h) {
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const dx = h.sprite.x - px, dy = h.sprite.y - py;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 150) return false; // already right by the player

    const stand = 120;
    let tx = px + (dx / dist) * stand;
    let ty = py + (dy / dist) * stand;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    h.state = 'wandering';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    this._runPath(h, this._gatePath(h.sprite.x, h.sprite.y, tx, ty), () => {
      if (!h.sprite.active) return;
      h.wanderTween = null;
      h.sprite.play(`idle_${h.key}`, true);
      h.state = 'idle';
      this._maybeNickerAtPlayer(h);
      this.scheduleWander(h, Phaser.Math.Between(2000, 4000));
    });
    return true;
  }

  // Waypoints from (fromX,fromY) to (tx,ty). If the path crosses the pasture
  // fence, it's routed through the gate opening so movers never clip the fence.
  _gatePath(fromX, fromY, tx, ty) {
    const insideFrom = this._inPasture(fromX, fromY);
    const insideTo   = this._inPasture(tx, ty);
    if (insideFrom === insideTo) return [{ x: tx, y: ty }];

    const gateLine = PASTURE_BOUNDS.minY;        // top fence line
    const inPoint  = { x: GATE_X, y: gateLine + 24 };  // just inside the gate
    const outPoint = { x: GATE_X, y: gateLine - 24 };  // just outside the gate
    return insideFrom
      ? [inPoint, outPoint, { x: tx, y: ty }]    // leaving the pasture
      : [outPoint, inPoint, { x: tx, y: ty }];   // entering the pasture
  }

  // Move any creature (horse or animal) along a list of waypoints with walk
  // tweens, then call onArrive. tweenRate defaults to the horse pace (10).
  // If a leg would carry the creature across the fence line while the gate is
  // shut, the trip is abandoned and the creature settles on its home side — so
  // nobody ever walks through a closed gate (e.g. it's shut mid-crossing).
  _runPath(a, points, onArrive) {
    const rate = a.tweenRate ?? 10;
    const line = PASTURE_BOUNDS.minY;
    const step = (i) => {
      if (!a.sprite.active) return;
      if (i >= points.length) { a.wanderTween = null; onArrive?.(); return; }
      const { x: tx, y: ty } = points[i];
      if ((a.sprite.y - line) * (ty - line) < 0 && !this.props.gate?.open) {
        a.wanderTween = null;
        this._settleAtGate(a);
        return;
      }
      const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, tx, ty);
      a.sprite.setFlipX(tx < a.sprite.x);
      a.sprite.play(`walk_${a.key}`, true);
      a.wanderTween = this.tweens.add({
        targets: a.sprite, x: tx, y: ty,
        duration: Math.max(300, dist * rate),
        ease: 'Sine.easeInOut',
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  // Place a creature just clear of the gate on its home side (horses inside the
  // pasture, other animals in the farm) and return it to normal life. Used when
  // the gate shuts on a mover that was crossing or about to cross.
  _settleAtGate(a) {
    const isHorse = this.horses.includes(a);
    const line = PASTURE_BOUNDS.minY;
    a.sprite.x = Phaser.Math.Clamp(a.sprite.x, GATE_GAP_X0 + 12, GATE_GAP_X1 - 12);
    a.sprite.y = isHorse ? line + 30 : line - 30;
    a.shadow.setPosition(a.sprite.x, a.sprite.y).setDepth(a.sprite.y - 1);
    a.sprite.setDepth(a.sprite.y).play(`idle_${a.key}`, true);
    if (a.eatTimer) { this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    a._eatPile = null;
    a.state = 'idle';
    if (isHorse) this.scheduleWander(a, Phaser.Math.Between(800, 2000));
    else         this.scheduleAnimalWander(a, Phaser.Math.Between(800, 2000));
  }

  // Returns true if the horse committed to eating, false if it bailed (e.g.
  // another horse already claimed this pile) so the caller can wander instead.
  horseGoEat(h, pile) {
    // Only one horse per hay pile
    const alreadyEating = this.horses.some(o => o !== h && o.state === 'eating' && o._eatPile === pile);
    if (alreadyEating) return false;

    h.state = 'eating';
    h._eatPile = pile;
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }

    const facingRight = pile.x >= h.sprite.x;
    const tx = pile.x + (facingRight ? -50 : 50);
    const ty = pile.y;

    // Route through the gate if the hay is on the far side of the fence
    const path = this._gatePath(h.sprite.x, h.sprite.y, tx, ty);

    this._runPath(h, path, () => {
      if (h.state !== 'eating') return;
      h.sprite.setFlipX(!facingRight);
      h.sprite.play(`eat_${h.key}`, true);

      playEat();
      h.eatTimer = this.time.delayedCall(1800, () => {
        h.eatTimer = null;
        if (h.state !== 'eating') return;
        const allHorses = this.registry.get('allHorses');
        allHorses[h.key]?.feed();
        this.game.events.emit(EVENTS.STATS_CHANGED);
        pile.sprite.destroy();
        this.props.hayPiles = this.props.hayPiles.filter(p => p !== pile);
        h._eatPile = null;
        h.sprite.play(`idle_${h.key}`, true);
        h.state = 'idle';
        this.scheduleWander(h, 1500);
      });
    });
    return true;
  }

  // Returns true if the horse committed to drinking, false if it bailed (e.g.
  // the trough is already busy) so the caller can wander instead.
  horseGoDrink(h) {
    const trough = this.props.trough;
    // Limit to 2 horses at the trough at once
    const atTrough = this.horses.filter(o => o !== h && o.state === 'drinking').length;
    if (atTrough >= 2) return false;

    h.state = 'drinking';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }

    // Spread horses along the trough length so they don't stack
    const slot = atTrough; // 0 or 1
    const facingRight = trough.x >= h.sprite.x;
    const spread = (slot === 0 ? -30 : 30);
    const tx = trough.x + spread + (facingRight ? -70 : 70);
    const ty = trough.y;

    // Route through the gate if the horse is currently outside the pasture
    const path = this._gatePath(h.sprite.x, h.sprite.y, tx, ty);

    this._runPath(h, path, () => {
        if (h.state !== 'drinking') return;
        if (!trough.filled) { h.state = 'idle'; this.scheduleWander(h, 500); return; }
        h.sprite.setFlipX(!facingRight);
        h.sprite.play(`eat_${h.key}`, true);

        playDrink();
        let drinksDone = 0;
        h.eatTimer = this.time.addEvent({
          delay: 2500, repeat: 1,
          callback: () => {
            if (h.state !== 'drinking') { if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; } return; }
            playDrink();
            const allHorses = this.registry.get('allHorses');
            allHorses[h.key]?.water();
            this.game.events.emit(EVENTS.STATS_CHANGED);
            drinksDone++;
            trough.drinks = Math.max(0, (trough.drinks ?? 3) - 1);
            if (trough.drinks <= 0) {
              trough.filled = false;
              trough.sprite.setTexture('trough');
            }
            if (drinksDone >= 1) {
              if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
              h.sprite.play(`idle_${h.key}`, true);
              h.state = 'idle';
              this.scheduleWander(h, 1500);
            }
          }
        });
    });
    return true;
  }

};
