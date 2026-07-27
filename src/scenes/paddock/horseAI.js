// Horse AI — eat/drink seeking, gate-aware pathing and settling. Applied as a
// functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { playEat, playDrink } from '../../audio/sounds.js';
import { CONTENT_DEFS } from '../../data/items.js';
import { reachedGoal } from '../../data/reach.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, GATE_X, GATE_GAP_X0, GATE_GAP_X1, BEG } from './constants.js';

// Hunger restored per grazing mouthful (#86). Deliberately light — grazing keeps a
// horse from getting too hungry but the player's hay (a +35 feed) is still the way
// to top it right up, so feeding stays meaningful.
const GRAZE_RESTORE = 4;

// Offsets (from props.shelter's standing anchor) a horse can take under the
// covered shelter (#319) so several sheltering horses spread out under the roof
// instead of stacking on one spot. Cycled by how many are already there.
const SHELTER_SPOTS = [
  { x: -34, y: 6 }, { x: 34, y: 6 },
  { x: -34, y: -14 }, { x: 34, y: -14 },
  { x: 0, y: 16 }, { x: 0, y: -22 },
];

export const WithHorseAI = (Base) => class extends Base {
  // ─── Horse AI — eat / drink ───────────────────────────────────────────────

  horseTick() {
    if (this.isNight) return;
    // Drives every grazer (horses + the cow): direct an idle/wandering one toward
    // food or water via its behavior list. Named horseTick for back-compat (smoke).
    for (const h of this._grazers()) {
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
      if (i >= points.length) { a.wanderTween = null; onArrive?.(true); return; }
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

  // Did this creature actually get to (tx,ty)? `reached` is the flag moveCreatureTo
  // passes the arrival callback — false when it found no route at all — and the
  // distance check catches the trips that ended somewhere else (a goal cell snapped
  // to the nearest free one, a trip parked at a shut gate). Goal-directed callbacks
  // that apply a care action gate on this so nothing is eaten or drunk through a
  // wall (#346).
  _creatureArrived(a, tx, ty, reached) {
    if (reached === false) return false;
    return a.sprite.active && reachedGoal(a.sprite.x, a.sprite.y, tx, ty);
  }

  // Give up on a goal-directed trip without applying its effect: drop back to idle
  // and let the normal wander chain pick the creature up shortly (#346).
  _abandonTrip(a) {
    a._eatPile = null;
    if (a.eatTimer) { this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    if (!a.sprite.active) return;
    a.sprite.play(`idle_${a.key}`, true);
    a.state = 'idle';
    this.scheduleCreatureWander(a, Phaser.Math.Between(1200, 2600));
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
    a._drinkSpot = null; // gave up on the trough — free the spot it had claimed (#336)
    a.state = 'idle';
    // A horse that hit the shut gate on its way to beg is at the choke point —
    // let it nicker for the player it can see but can't reach.
    if (isHorse) { this._maybeNickerAtPlayer(a); this.scheduleWander(a, Phaser.Math.Between(800, 2000)); }
    else         this.scheduleAnimalWander(a, Phaser.Math.Between(800, 2000));
  }

  // Returns true if the horse committed to eating, false if it bailed (e.g.
  // another horse already claimed this pile) so the caller can wander instead.
  // Despite the name, this is the generic "consume a dropped pile" primitive:
  // it applies whichever care action the pile's content maps to (CONTENT_DEFS
  // `action`, default 'feed') — e.g. a dropped cat-water pile applies `water`
  // (thirst) the same way a hay pile applies `feed` (hunger), #202 refinement.
  horseGoEat(h, pile) {
    // Only one grazer (horse or cow) per food pile
    const alreadyEating = this._grazers().some(o => o !== h && o.state === 'eating' && o._eatPile === pile);
    if (alreadyEating) return false;

    h.state = 'eating';
    h._eatPile = pile;
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    const facingRight = pile.x >= h.sprite.x;
    const tx = pile.x + (facingRight ? -50 : 50);
    const ty = pile.y;

    const action = CONTENT_DEFS[pile.content]?.action ?? 'feed';

    // Pathfind to the hay, around obstacles and through the gate if it's outside.
    this.moveCreatureTo(h, tx, ty, (reached) => {
      if (h.state !== 'eating') return;
      // Only eat if we actually walked up to the pile (#346) — a trip with no route,
      // or one that ended parked at a shut gate, must not feed the horse from afar.
      if (!this._creatureArrived(h, tx, ty, reached)) { this._abandonTrip(h); return; }
      h.sprite.setFlipX(!facingRight);
      h.sprite.play(`eat_${h.key}`, true);

      if (action === 'water') playDrink();
      else playEat(pile.content ?? 'hay'); // crunchy for apple/carrot, munchy for hay (#126)
      h.eatTimer = this.time.delayedCall(1800, () => {
        h.eatTimer = null;
        if (h.state !== 'eating') return;
        this._modelFor(h)?.applyAction(action);
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

  // Returns true if the horse committed to drinking, false if it bailed (every
  // drinking spot taken or unreachable) so the caller can wander instead.
  horseGoDrink(h) {
    const trough = this.props.trough;
    // The trough runs north–south now (#336), with a few standing spots along
    // each long side, so several animals can drink at once instead of the old
    // two-at-the-ends cap. _claimTroughSpot picks the nearest FREE spot this
    // animal can actually get to — a horse penned on one side never claims a spot
    // on the far side of the trough (or of any other obstacle). See data/trough.js.
    const spot = this._claimTroughSpot(h);
    if (!spot) return false;

    h.state = 'drinking';
    h._streamSpot = null; // this horse is at the trough now, not the stream
    h._drinkSpot = spot;  // held while walking over + drinking, so nobody doubles up
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    const facingRight = spot.side === 'west'; // face inward, across the water
    const tx = spot.x, ty = spot.y;

    // Pathfind to the trough, around obstacles and through the gate if outside.
    this.moveCreatureTo(h, tx, ty, (reached) => {
        if (h.state !== 'drinking') return;
        // The whole point of #346: a horse only drinks if it is STANDING AT the
        // trough end. Without this, a horse the pathfinder can't route (e.g. one
        // inside the barn) got the arrival callback anyway and drank through the
        // barn wall — thirst restored, trough level dropped, never having moved.
        // `_abandonTrip` is generic and doesn't know about the trough claim, so
        // release it here before handing off.
        if (!this._creatureArrived(h, tx, ty, reached)) { h._drinkSpot = null; this._abandonTrip(h); return; }
        if (!trough.filled) { h._drinkSpot = null; h.state = 'idle'; this.scheduleWander(h, 500); return; }
        h.sprite.setFlipX(!facingRight);
        h.sprite.play(`eat_${h.key}`, true);

        playDrink();
        let drinksDone = 0;
        h.eatTimer = this.time.addEvent({
          delay: 2500, repeat: 1,
          callback: () => {
            if (h.state !== 'drinking') { if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; } return; }
            playDrink();
            this._modelFor(h)?.water();
            this.game.events.emit(EVENTS.STATS_CHANGED);
            drinksDone++;
            this._setTroughLevel(trough.level - 1); // a sip lowers the water (#103)
            if (drinksDone >= 1) {
              if (h.eatTimer) { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }
              h.sprite.play(`idle_${h.key}`, true);
              h._drinkSpot = null; // release the spot for the next thirsty animal
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
    h._drinkSpot = null;              // at the stream, not the trough (#336)
    const faceLeft = nx > 0;

    this.moveCreatureTo(h, tx, ty, (reached) => {
      if (h.state !== 'drinking') return;
      // Same arrival guard as the trough (#346) — no lapping at a bank you never
      // reached (the stream is fenced off from most of the farm by its own rects).
      if (!this._creatureArrived(h, tx, ty, reached)) { h._streamSpot = null; this._abandonTrip(h); return; }
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
          this._modelFor(h)?.water();
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
    const taken = this._grazers()
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
    const horse = this._modelFor(h);
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

  // Rain sends a horse to the covered shelter (#319) — fully automatic AI pathing,
  // no player placement. Claims the horse immediately (state='sheltering', set
  // BEFORE the walk completes) so horseTick's idle/wandering filter skips it for
  // the whole trip, not just once parked — otherwise every tick mid-walk would
  // re-fire the behavior and restart the path. It stays 'sheltering' (never reset
  // to 'idle' on arrival) until the rain clears, when _releaseSheltering
  // (weather.js, on WEATHER_CHANGE) hands it back to the normal wander chain.
  horseGoToShelter(h) {
    const shelter = this.props.shelter;
    if (!shelter) return false;
    if (h.state === 'sheltering') return true; // already there / already heading over

    h.state = 'sheltering';
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h._begTimer)   { this.time.removeEvent(h._begTimer); h._begTimer = null; }
    if (h.eatTimer)    { this.time.removeEvent(h.eatTimer); h.eatTimer = null; }

    const already = this._grazers().filter(o => o !== h && o.state === 'sheltering').length;
    const spot = SHELTER_SPOTS[already % SHELTER_SPOTS.length];
    const tx = shelter.x + spot.x, ty = shelter.y + spot.y;

    this.moveCreatureTo(h, tx, ty, () => {
      if (h.state !== 'sheltering' || !h.sprite.active) return;
      h.sprite.setFlipX(spot.x > 0);
      h.sprite.play(`idle_${h.key}`, true);
    });
    return true;
  }

};
