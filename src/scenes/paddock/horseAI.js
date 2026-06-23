// Horse AI — eat/drink seeking, gate-aware pathing and settling. Applied as a
// functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playEat, playDrink } from '../../audio/sounds.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, GATE_X, GATE_GAP_X0, GATE_GAP_X1, BEG } from './constants.js';

// Hunger restored per grazing mouthful (#86). Deliberately light — grazing keeps a
// horse from getting too hungry but the player's hay (a +35 feed) is still the way
// to top it right up, so feeding stays meaningful.
const GRAZE_RESTORE = 4;

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

  // Decide what a single horse does this tick. The decision is now data-driven:
  // the species' ordered `behaviors` list (seekFood → seekWater → begPlayer) is
  // walked by the generic dispatcher (see WithBehaviors / behaviors.js), which
  // reuses the eat/drink/beg primitives below unchanged. Returns true if the horse
  // was directed somewhere; false if it should wander normally.
  horseTickForHorse(h) {
    return this.runBehaviors(h);
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
    // Settle on the side the mover is *currently* on — never snap it across the
    // fence to the far side (#81). (Previously a horse was always put inside, so a
    // horse caught outside a closing gate teleported into the pasture.)
    const outside = a.sprite.y < line;
    a.sprite.x = Phaser.Math.Clamp(a.sprite.x, GATE_GAP_X0 + 12, GATE_GAP_X1 - 12);
    a.sprite.y = outside ? line - 30 : line + 30;
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

      playEat('hay'); // grazing a hay pile → munchy chew (#126)
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
    // Limit to 2 horses at the trough at once. Stream drinkers also use the
    // 'drinking' state but carry a _streamSpot claim (#108) — exclude them so the
    // trough count (and the opposite-end partner below) only sees trough drinkers.
    const atTrough = this.horses.filter(o => o !== h && o.state === 'drinking' && !o._streamSpot).length;
    if (atTrough >= 2) return false;

    h.state = 'drinking';
    h._streamSpot = null; // this horse is at the trough now, not the stream
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    // Drink from a trough END, level with it — never from a spot south of it
    // that reads as grazing on grass. The old target sat near the trough centre,
    // which is *inside* the trough's own collision box, so the pathfinder bailed
    // at the nearest clear cell (usually south of it). ±106 = half-width (88) +
    // body radius + margin, so the end anchors are actually reachable. Two horses
    // take opposite ends so they never stack; a lone horse takes the nearer end.
    const other = this.horses.find(o => o !== h && o.state === 'drinking' && !o._streamSpot);
    const onWest = other ? other._drinkEnd !== 'west' : h.sprite.x <= trough.x;
    h._drinkEnd = onWest ? 'west' : 'east';
    const facingRight = onWest; // face inward toward the water
    const tx = trough.x + (onWest ? -106 : 106);
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
            this._setTroughLevel(trough.level - 1); // a sip lowers the water (#103)
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

  // Desperately thirsty with no usable trough → drink at the nearest stream bank
  // (#99). Walks to the water's edge, faces it, and laps a couple of times
  // (restoring thirst), then ambles home. The edge anchor — each stream source
  // carries a bank centreline + field-ward normal — stands the horse just
  // field-side of the water facing it, so it doesn't read as head-down over the
  // grassy bank (cf. #76).
  horseGoToStream(h) {
    // Claim a distinct spot along the bank so drinkers spread out (#108) instead
    // of all converging on the single nearest point.
    const source = this._claimStreamSource(h);
    if (!source?.bank) return false;

    h.state = 'drinking';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer)   { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    // Stand ≈48px down the field normal from the water centreline and face the
    // water (which lies opposite the field-ward normal).
    const [bx, by] = source.bank;
    const [nx, ny] = source.nrm;
    const tx = bx + nx * 48, ty = by + ny * 48;
    h._streamSpot = { x: tx, y: ty }; // reserve this anchor while heading there / drinking
    const faceLeft = nx > 0;

    this.moveCreatureTo(h, tx, ty, () => {
      if (h.state !== 'drinking') return;
      h.sprite.setFlipX(faceLeft);
      h.sprite.play(`eat_${h.key}`, true); // head-down drinking pose
      playDrink();

      let sips = 0;
      h.eatTimer = this.time.addEvent({
        delay: 2500, repeat: 1, // two unhurried laps
        callback: () => {
          if (h.state !== 'drinking') {
            if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
            return;
          }
          playDrink();
          this.registry.get('allHorses')?.[h.key]?.water();
          this.game.events.emit(EVENTS.STATS_CHANGED);
          if (++sips >= 2) {
            if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
            h.sprite.play(`idle_${h.key}`, true);
            h.state = 'idle';
            h._streamSpot = null; // release the bank spot for others (#108)
            this.scheduleWander(h, 1500);
          }
        },
      });
    });
    return true;
  }

  // Pick a distinct stream anchor for this horse so drinkers spread out along the
  // bank rather than stacking on the single nearest spot (#108). Each stream
  // source carries a `bank` centreline; the drink anchor is `bank + nrm*48` (see
  // horseGoToStream). We take the nearest reachable anchor that isn't already
  // claimed by another horse currently heading to / drinking at the stream (kept
  // ≈ a body-width apart). If every nearby spot is taken, fall back to the plain
  // nearest so the horse still drinks.
  _claimStreamSource(h) {
    const srcs = this.props.sources?.filter(s => s.content === 'water' && s.bank);
    if (!srcs?.length) return null;
    const gateOpen = this._gateOpen();
    const MIN_SPACING = 96; // ≈ a horse body-width, so anchors don't overlap
    const anchorOf = (s) => ({ x: s.bank[0] + s.nrm[0] * 48, y: s.bank[1] + s.nrm[1] * 48 });
    const taken = this.horses
      .filter(o => o !== h && o.state === 'drinking' && o._streamSpot)
      .map(o => o._streamSpot);
    let closest = null, closestDist = Infinity;
    for (const s of srcs) {
      if (!this._inPasture(s.x, s.y) && !gateOpen) continue;
      const a = anchorOf(s);
      if (taken.some(p => Phaser.Math.Distance.Between(p.x, p.y, a.x, a.y) < MIN_SPACING)) continue;
      const d = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, a.x, a.y);
      if (d < closestDist) { closestDist = d; closest = s; }
    }
    return closest ?? this._nearestReachableWater(h);
  }

  // Ambient grazing (#86): a peckish horse lowers its head and nibbles the grass
  // right where it stands, passively restoring a little hunger over a few unhurried
  // mouthfuls. No walking and no pile needed — the world is grass. Lowest feeding
  // priority (see the `graze` behavior), so a horse still prefers dropped hay or
  // begging when those are available. Always claims the horse (returns true).
  horseGraze(h) {
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return false;

    h.state = 'grazing';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer)   { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    h.sprite.play(`eat_${h.key}`, true); // head-down grazing pose

    let mouthfuls = 0;
    h.eatTimer = this.time.addEvent({
      delay: 1500, repeat: 2, // three unhurried nibbles
      callback: () => {
        if (h.state !== 'grazing') {
          if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
          return;
        }
        horse.stats.hunger = Math.min(100, horse.stats.hunger + GRAZE_RESTORE);
        this.game.events.emit(EVENTS.STATS_CHANGED);
        if (++mouthfuls >= 3) {
          if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
          h.sprite.play(`idle_${h.key}`, true);
          h.state = 'idle';
          this.scheduleWander(h, Phaser.Math.Between(900, 2500));
        }
      },
    });
    return true;
  }

};
