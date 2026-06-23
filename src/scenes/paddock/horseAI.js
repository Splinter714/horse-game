// Horse AI — eat/drink seeking, gate-aware pathing and settling. Applied as a
// functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playEat, playDrink } from '../../audio/sounds.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, GATE_X, GATE_GAP_X0, GATE_GAP_X1, BEG } from './constants.js';

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

    // Hungry → go find the player and beg for food. With the gate open the horse
    // walks all the way out to wherever you are; with it shut it walks to the gate
    // (the choke point) and waits there — same intent, the gate just decides how
    // far it gets. Lazy horses can't be bothered. When the gate's shut we only
    // bother if the player is fairly near, so they read as "here comes breakfast"
    // rather than pressing the fence forever. Throttled per horse. (issue #26)
    if (horseData.stats.hunger < BEG.HUNGER && horseData.temperament !== 'lazy' && this.player) {
      const gateOpen = !!this.props.gate?.open;
      const pd = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.player.sprite.x, this.player.sprite.y);
      if (gateOpen || pd < BEG.NOTICE_DIST) {
        const now = this.time.now;
        if (!h._lastSeek || now - h._lastSeek > BEG.THROTTLE_MS) {
          if (this._horseBeg(h)) { h._lastSeek = now; return true; }
        }
      }
    }

    return false;
  }

  // Hungry horse goes to beg the player for food. If the gate is open it walks all
  // the way out to the player; if the gate is shut and the player is on the far
  // side of the fence it can't reach them, so it walks to the gate gap and waits
  // there instead. Either way it pathfinds around obstacles, stops a short way off
  // so the herd doesn't pile onto the player, and then *lingers* (see _begWait)
  // rather than wandering straight off again. Returns true if it's begging.
  _horseBeg(h) {
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const line = PASTURE_BOUNDS.minY;
    const gateOpen = !!this.props.gate?.open;
    const blocked = !gateOpen && h.sprite.y > line && py < line; // player past a shut fence

    let tx, ty;
    if (blocked) {
      // Already loitering at the gate? Don't restart the trip every tick — just
      // keep the begging loop alive so the stale wander chain can't drag it off.
      if (Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, GATE_X, line + 42) < BEG.AT_GATE) {
        if (!h._begTimer) this._begWait(h);
        return true;
      }
      tx = Phaser.Math.Clamp(GATE_X + Phaser.Math.Between(-30, 30), GATE_GAP_X0 + 14, GATE_GAP_X1 - 14);
      ty = line + Phaser.Math.Between(28, 56);
    } else {
      const dx = h.sprite.x - px, dy = h.sprite.y - py;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < BEG.AT_PLAYER) { // already right by the player
        if (!h._begTimer) this._begWait(h);
        return true;
      }
      const stand = BEG.STANDOFF;
      tx = Phaser.Math.Clamp(px + (dx / dist) * stand, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      ty = Phaser.Math.Clamp(py + (dy / dist) * stand, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    }

    h.state = 'wandering';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    this.moveCreatureTo(h, tx, ty, () => {
      if (!h.sprite.active) return;
      h.sprite.play(`idle_${h.key}`, true);
      h.state = 'idle';
      this._maybeNickerAtPlayer(h);
      this._begWait(h);
    });
    return true;
  }

  // Keep a horse that came to beg loitering and nickering near the player (or the
  // gate) until it's been fed or the player walks off, instead of wandering away a
  // couple seconds after arriving. Re-checks itself on a timer; hands the horse
  // back to the normal wander chain once it's no longer begging. While _begTimer
  // is pending the wander scheduler stands down (see scheduleCreatureWander), so a
  // stale wander can't yank a begging horse away.
  _begWait(h) {
    h._begTimer = null;
    if (h.state !== 'idle' || this.isNight) return; // something else owns it now
    const horse = this.registry.get('allHorses')?.[h.key];
    const stillHungry = horse && horse.stats.hunger < BEG.KEEP_HUNGER;
    const near = this.player &&
      Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, this.player.sprite.x, this.player.sprite.y) < BEG.LINGER_DIST;
    if (stillHungry && near) {
      h.sprite.setFlipX(this.player.sprite.x < h.sprite.x); // face the player
      this._maybeNickerAtPlayer(h);
      h._begTimer = this.time.delayedCall(Phaser.Math.Between(2500, 4200), () => this._begWait(h));
    } else {
      this.scheduleCreatureWander(h, Phaser.Math.Between(1500, 3000));
    }
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
      // Hold a constant pace across a multi-leg path so the creature flows through
      // tight turns (e.g. the gate) instead of easing to a near-stop at every
      // waypoint — the per-leg Sine.easeInOut + 300ms floor was what made horses
      // visibly lurch at the gate. Ease in on the first leg and out on the last
      // for a gentle start/stop; a single straight leg keeps the relaxed amble.
      const single = points.length === 1;
      const ease = single ? 'Sine.easeInOut'
        : i === 0 ? 'Sine.easeIn'
        : i === points.length - 1 ? 'Sine.easeOut'
        : 'Linear';
      a.wanderTween = this.tweens.add({
        targets: a.sprite, x: tx, y: ty,
        duration: Math.max(80, dist * rate),
        ease,
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
    if (a._begTimer) { this.time.removeEvent(a._begTimer); a._begTimer = null; }
    a._eatPile = null;
    a.state = 'idle';
    // A horse that hit the shut gate on its way to beg is at the choke point —
    // let it nicker for the player it can see but can't reach.
    if (isHorse) { this._maybeNickerAtPlayer(a); this.scheduleWander(a, Phaser.Math.Between(800, 2000)); }
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
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    const facingRight = pile.x >= h.sprite.x;
    const tx = pile.x + (facingRight ? -50 : 50);
    const ty = pile.y;

    // Pathfind to the hay, around obstacles and through the gate if it's outside.
    this.moveCreatureTo(h, tx, ty, () => {
      if (h.state !== 'eating') return;
      h.sprite.setFlipX(!facingRight);
      h.sprite.play(`eat_${h.key}`, true);

      playEat();
      h.eatTimer = this.time.delayedCall(1800, () => {
        h.eatTimer = null;
        if (h.state !== 'eating') return;
        const allHorses = this.registry.get('allHorses');
        allHorses[h.key]?.feed();
        this.game.events.emit('stats-changed');
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
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    // Spread horses along the trough length so they don't stack
    const slot = atTrough; // 0 or 1
    const facingRight = trough.x >= h.sprite.x;
    const spread = (slot === 0 ? -30 : 30);
    const tx = trough.x + spread + (facingRight ? -70 : 70);
    const ty = trough.y;

    // Pathfind to the trough, around obstacles and through the gate if outside.
    this.moveCreatureTo(h, tx, ty, () => {
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
            this.game.events.emit('stats-changed');
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
