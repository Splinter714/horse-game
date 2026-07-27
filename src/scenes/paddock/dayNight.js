// Day/night response: phase changes, dawn roll-over, resting/waking animals,
// chicken roosting, ambient birds. Applied as a functional mixin.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { getSpecies } from '../../data/species/index.js';
import { playBirdChirp, playRoosterCrow, setMusicMode } from '../../audio/sounds.js';
import { CHARM } from './constants.js';
import { dirtMultiplier } from '../../data/weather.js';

// Grooming only ever drops from actions now (#123). A horse gets a touch dirtier
// each time it lies down to rest, and a bit more for a night passing.
const LAY_DOWN_DIRTY = 2;
const OVERNIGHT_DIRTY = 10;

// Species → the scene method that resolves its home-structure entry point (#363).
// Any roster animal of one of these species goes home for the night (_animalGoHome/
// _animalLeaveHome) instead of drifting into the generic herd huddle. Cat is handled
// separately above (it also sometimes curls up outside instead, CHARM.CAT_CURL_CHANCE).
// Deliberately NOT wired for fox/bunny's pre-tame wild phase — the wild fox
// (paddock/fox.js `_wildFox`) and a not-yet-attracted bunny are never added to
// `this.animals` in the first place, so this only ever applies to an already-tamed/
// -attracted roster individual.
const HOME_SPOTS = {
  dog: '_doghouseEntry',
  fox: '_foxDenEntry',
  bunny: '_bunnyHutchEntry',
};

export const WithDayNight = (Base) => class extends Base {
  // ─── Day / Night ─────────────────────────────────────────────────────────

  // Knock a horse's grooming down by `amount` (clamped at 0) and refresh anything
  // watching. No-op for non-horses (they have no grooming stat). Used for the
  // action-based dirtying — lying down and a night passing (#123). Rain dirties
  // horses faster, so the amount is scaled by the current weather (#188).
  _dirtyHorse(key, amount) {
    const horse = this.registry.get('allHorses')?.[key];
    if (horse?.stats?.grooming === undefined) return;
    const scaled = amount * dirtMultiplier(this._weather);
    horse.stats.grooming = Math.max(0, horse.stats.grooming - scaled);
    this.game.events.emit(EVENTS.STATS_CHANGED);
  }

  onPhaseChange({ isNight, phase }) {
    this._phase = phase;
    if (phase === 'Morning') { this._dawnNewDay(); this._crowRoostersAtDawn(); }
    if (isNight && !this.isNight) {
      this.isNight = true;
      this.restAllAnimals();
    } else if (!isNight && this.isNight) {
      this.isNight = false;
      this.wakeAllAnimals();
    }
    if (!this._chickensEntered) {
      this._chickensEntered = true;
      this._enterChickensForStart(isNight, phase);
    }
    setMusicMode(isNight);
  }

  // First phase change after boot: the flock was spawned hidden (see buildAnimals).
  // In the morning they wake up roosting and file out of the coop; if the game
  // opens later in the day they're simply already milling in the yard; at night
  // they stay tucked in the coop (restAllAnimals already roosted them).
  _enterChickensForStart(isNight, phase) {
    if (isNight) return;
    for (const a of this.animals) {
      if (!this._isFlockBird(a)) continue; // hens AND roosters roost/emerge together (#269)
      if (phase === 'Morning') {
        this.chickenLeaveCoop(a);
      } else {
        a.state = 'idle';
        a.sprite.setVisible(true).setAlpha(1);
        a.shadow.setVisible(true);
        this.scheduleAnimalWander(a, Phaser.Math.Between(500, 3000));
      }
    }
  }

  // Each morning is a new care day: a horse that didn't get both fed and watered
  // the day before wakes up grumpy (and recovers as soon as you tend it). The
  // first morning at game start is skipped so nobody starts neglected. (issue #26)
  _dawnNewDay() {
    // A new day means the flock is hungry again — they'll crowd the grain bin
    // until fed. (Reset before the first-morning short-circuit so it always runs.)
    this._chickensFedToday = false;
    if (!this._sawFirstMorning) { this._sawFirstMorning = true; return; }
    // rollNewDay() flags any horse that missed required care yesterday (now
    // including daily love) as neglected, then clears the day's care record. A night
    // passing also leaves a horse a little dirtier (#123) — the steady part of the
    // grooming need now that it no longer decays passively.
    const allHorses = this.registry.get('allHorses');
    for (const h of this.horses) {
      allHorses[h.key]?.rollNewDay();
      this._dirtyHorse(h.key, OVERNIGHT_DIRTY);
    }
    // Breeding (#15): a night passing is when a foal the player has allowed to grow
    // (stayBaby === false) becomes a young horse. growUpFoal is a no-op while stayBaby
    // is on, so a foal the player keeps a baby stays a baby forever.
    for (const key of Object.keys(allHorses)) {
      if (allHorses[key]?.isFoal) this.growUpFoal?.(key);
    }
    // Any spawned animal whose species has a daily-care cycle rolls over too:
    // yesterday's care decides whether it wakes grumpy AND (for the cow) whether
    // she's ready to be milked today (#cow). Generic over species data so a new
    // daily-care animal (the pig, …) needs no edit here — its model is the same
    // instance the registry persists, so rolling it here is what the save records.
    for (const a of this.animals) {
      if (a.model && getSpecies(a.model.species).dailyCare) a.model.rollNewDay();
    }
    // Crops grow a stage each day/night cycle (#242): a night passing (sleeping) is what
    // advances the garden — no real-time timers. Runs after the first-morning skip so a
    // fresh game doesn't jump the plot forward before the player has planted anything.
    this.advanceGarden?.();
  }

  // Dawn crow (#269): every morning the roosters greet the sunrise with a cock-a-
  // doodle-doo. Scheduler-driven (fired by the Morning PHASE_CHANGE), like egg-laying
  // and roosting — NOT a free per-tick decision. Each rooster is armed (`_crowing`)
  // and its behavior list is walked so the pure `crowAtDawn` behavior fires (which
  // calls roosterCrow below); a small stagger keeps two roosters from crowing in
  // perfect unison. Skipped on the very first boot-phase (the flock is still filing
  // out of the coop and _crowRoostersAtDawn would fight the emerge tween).
  _crowRoostersAtDawn() {
    if (!this._sawFirstMorning) return; // set true by _dawnNewDay on the first Morning
    const roosters = this.animals.filter((a) => a.model?.species === 'rooster');
    roosters.forEach((a, i) => {
      this.time.delayedCall(400 + i * 900, () => {
        if (this.isNight || !a.sprite?.active) return;
        a._crowing = true;
        this.runBehaviors(a); // walks the list → crowAtDawn.test fires → roosterCrow(a)
      });
    });
  }

  // The crow primitive the `crowAtDawn` behavior runs: play the head-back crow pose
  // and the cock-a-doodle-doo sound, then drop back to idle and resume wandering. Only
  // interrupts a free-to-move rooster (never yanks one out of roosting / leaving-coop).
  roosterCrow(a) {
    a._crowing = false; // one crow per arming
    if (!['idle', 'wandering', 'following', 'gathering'].includes(a.state)) return;
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    a.state = 'crowing';
    a.sprite.setFlipX(false); // crow facing right (toward the rising sun)
    if (this.anims.exists(`crow_${a.key}`)) a.sprite.play(`crow_${a.key}`, true);
    playRoosterCrow();
    this.time.delayedCall(1100, () => {
      if (!a.sprite?.active || a.state !== 'crowing') return;
      a.state = 'idle';
      a.sprite.play(`idle_${a.key}`, true);
      this.scheduleAnimalWander(a, Phaser.Math.Between(500, 2500));
    });
  }

  restAllAnimals() {
    // The barnyard beds down together (#187, charm.js): horses + other pasture
    // animals settle (the non-horses drift in to join the herd); the cat sometimes
    // curls up outside instead of going into the house; the dog/fox/bunny go home
    // to their own structure (#363), mirroring the cat/chicken pattern.
    for (const h of this.horses) this._settleAnimalForNight(h);
    for (const a of this.animals) {
      const species = a.model?.species;
      if (this._isFlockBird(a)) this.chickenRoost(a); // hens + roosters into the coop (#269)
      else if (a.key === 'cat') {
        if (Math.random() < CHARM.CAT_CURL_CHANCE) this.catCurlUp(a);
        else this.catGoHome(a);
      }
      else if (HOME_SPOTS[species]) this._animalGoHome(a, this[HOME_SPOTS[species]]());
      else this._settleAnimalForNight(a);
    }
    // Send any visiting NPCs away at night
    for (const npc of [...this.npcs]) {
      if (npc.tween) { npc.tween.stop(); npc.tween = null; }
      this._npcLeave(npc);
    }
  }

  // Stop an animal where it stands and bed it down for the night (the old inline
  // stopOne). Extracted so the charm night-settle (charm.js _settleAnimalForNight)
  // can reuse it after walking an animal into the huddle. Also tidies up any
  // in-progress daytime nap visuals (#187).
  _restAnimalInPlace(a) {
    this._endCharmNap?.(a);
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    if (a.eatTimer)    { a.eatTimer.remove?.() ?? this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    if (a._begTimer)   { this.time.removeEvent(a._begTimer); a._begTimer = null; }
    a._eatPile = null;
    a.state = 'resting';
    a.sprite.play(`idle_${a.key}`, true);
    // Schedule random lay-down moments while sleeping
    this._scheduleLayDown(a);
  }

  _scheduleLayDown(a) {
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    if (a.state !== 'resting') return;
    // Creatures without lying-down frames (e.g. the cow) rest standing — never try
    // to play a missing sleep_<key> animation.
    if (!this.anims.exists(`sleep_${a.key}`)) return;

    const delay = Phaser.Math.Between(8000, 16000);
    a._sleepTimer = this.time.delayedCall(delay, () => {
      if (a.state !== 'resting') return;
      a._sleepTimer = null;

      if (Math.random() < 0.5) {
        a.sprite.play(`sleep_${a.key}`, true);
        this._dirtyHorse(a.key, LAY_DOWN_DIRTY); // lying down gets them a touch dirty (#123)
        const layDownTime = Phaser.Math.Between(3000, 7000);
        this.time.delayedCall(layDownTime, () => {
          if (a.state === 'resting') {
            a.sprite.play(`idle_${a.key}`, true);
          }
        });
      }
      this._scheduleLayDown(a);
    });
  }

  wakeAllAnimals() {
    for (const h of this.horses) {
      if (h._sleepTimer) { this.time.removeEvent(h._sleepTimer); h._sleepTimer = null; }
      // 'settling' = still drifting into the night huddle (#187) — stop that walk too.
      if (h.state === 'resting' || h.state === 'settling') {
        if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
        h.state = 'idle'; this.scheduleWander(h, Phaser.Math.Between(500, 3000));
      }
    }
    for (const a of this.animals) {
      if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
      if (this._isFlockBird(a)) { // hens + roosters file out of the coop (#269)
        if (a.state === 'roosting') this.chickenLeaveCoop(a);
      } else if (a.key === 'cat') {
        if (a.state === 'homing') this.catLeaveHome(a);
        else if (a.state === 'curling' || a.state === 'curled') {
          // Curled up outside for the night (#187) — un-curl and resume prowling.
          this._endCharmNap(a);
          if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
          a.state = 'idle'; this.scheduleAnimalWander(a, Phaser.Math.Between(500, 2500));
        }
      } else if (HOME_SPOTS[a.model?.species] && a.state === 'homing') {
        this._animalLeaveHome(a, this[HOME_SPOTS[a.model.species]]());
      } else if (a.state === 'resting' || a.state === 'settling') {
        if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
        a.state = 'idle'; this.scheduleAnimalWander(a, Phaser.Math.Between(500, 3000));
      }
    }
  }

  // Nightfall: walk a chicken to the coop ramp, then up into the pop-door,
  // fading out of view (depth-sorting also tucks it behind the coop body).
  chickenRoost(a) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    if (a.eatTimer)    { a.eatTimer.remove?.() ?? this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    a._eatPile = null;
    a.state = 'roosting';
    for (const n of this.props.nests) if (n.occupant === a) n.occupant = null;

    const coop = this.props.coop;
    a.sprite.setFlipX(coop.rampX < a.sprite.x);
    a.sprite.play(`walk_${a.key}`, true);

    const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, coop.rampX, coop.rampY);
    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: coop.rampX, y: coop.rampY,
      duration: Math.max(500, dist * a.tweenRate),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        a.wanderTween = null;
        if (a.state !== 'roosting' || !a.sprite.active) return;
        a.sprite.setFlipX(false);
        a.shadow.setVisible(false);
        a.wanderTween = this.tweens.add({
          targets: a.sprite, x: coop.doorX, y: coop.doorY, alpha: 0,
          duration: 600, ease: 'Sine.easeIn',
          onComplete: () => {
            a.wanderTween = null;
            if (a.state === 'roosting') a.sprite.setVisible(false);
          },
        });
      },
    });
  }

  // Morning: chicken reappears at the pop-door and hops down the ramp to resume.
  chickenLeaveCoop(a) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    const coop = this.props.coop;
    a.state = 'leaving';
    a.sprite.setPosition(coop.doorX, coop.doorY).setAlpha(0).setVisible(true);
    a.shadow.setPosition(coop.doorX, coop.doorY).setVisible(true);
    a.sprite.setFlipX(true);
    a.sprite.play(`walk_${a.key}`, true);

    a.wanderTween = this.tweens.add({
      targets: a.sprite, x: coop.rampX, y: coop.rampY, alpha: 1,
      duration: 600, ease: 'Sine.easeOut',
      onComplete: () => {
        a.wanderTween = null;
        // Guard against a stale callback firing after something else (a fresh
        // chickenRoost/chickenLeaveCoop call) has already taken over this bird —
        // mirrors chickenRoost's own state guard (fixes a double-apply bug where
        // a stale callback could clobber a freshly-roosted bird).
        if (a.state !== 'leaving' || !a.sprite.active) return;
        a.sprite.setAlpha(1);
        if (this.isNight) { this.chickenRoost(a); return; }
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(300, 2500));
      },
    });
  }

  // The house front-centre, just south of the house's collision box so it's a
  // reachable spot (the box covers the building itself). Used as the home-base
  // anchor: the cat's home, the yard-roamer night huddle, the dog bed-down (#241
  // moved these off the old "barn" — now the HOUSE — onto props.house).
  _houseEntry() {
    const house = this.props.house;
    return { x: house.x, y: house.y + 44 }; // ≈ (240, 294), clear of the house walls
  }

  // The doghouse's front, just south of its collision box (worldObjects.js
  // buildDoghouse — the box already ends 6px above the doghouse's own y, so a
  // small margin below that is clear of the kennel). Used by the dog's go-home (#363).
  _doghouseEntry() {
    const house = this.props.doghouse;
    return { x: house.x, y: house.y + 8 };
  }

  // A world `sources` entry's front, just south of its collision box (world.js
  // `_buildObstacles`: every source's `ob` box ends exactly at the source's own y).
  // Shared by the fox den + bunny hutch go-home entries (#363) — looked up by label
  // rather than hardcoded coordinates, since the dev drag tool can reposition sources.
  _sourceEntry(label) {
    const s = this.props.sources?.find((s) => s.label === label);
    if (!s) return null;
    return { x: s.x, y: s.y + 14 };
  }

  _foxDenEntry() { return this._sourceEntry('Fox Den'); }
  _bunnyHutchEntry() { return this._sourceEntry('Bunny Hutch'); }

  // Nightfall: the cat heads home to the house to sleep (#90), pathing there
  // around obstacles, then slipping inside (fade up + out of view) like the
  // chickens roost in the coop. Curls into its nap pose (#198, catArt.js
  // drawCatNap) for the fade if the species has one — a species without a nap
  // pose falls back to idle, so this stays safe for any future world-roamer.
  catGoHome(a) {
    this._animalGoHome(a, this._houseEntry());
  }

  // Morning: the cat re-emerges from the house and resumes prowling.
  catLeaveHome(a) {
    this._animalLeaveHome(a, this._houseEntry());
  }

  // Generalized go-home-for-the-night (#363, lifted out of the cat-only catGoHome
  // above): stop whatever the animal was doing, path to `entry` (an {x,y} clear of
  // the home structure's collision box — _houseEntry/_doghouseEntry/_sourceEntry),
  // then fade+step up into the structure like the cat/chickens do. `entry` is
  // resolved fresh each call (not cached) so a dev-drag-tool reposition of the home
  // prop takes effect immediately. A no-op if the home spot isn't available yet
  // (e.g. a source that hasn't loaded) — the animal just falls through to the
  // generic herd-settle next time restAllAnimals runs.
  _animalGoHome(a, entry) {
    if (!entry) { this._settleAnimalForNight(a); return; }
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    if (a.eatTimer)    { this.time.removeEvent(a.eatTimer); a.eatTimer = null; } // stop a mid-bowl/pile meal (#202)
    a._eatPile = null;
    a._eatBowl = null;
    a.state = 'homing';

    const { x: ex, y: ey } = entry;
    this.moveCreatureTo(a, ex, ey, () => {
      if (a.state !== 'homing' || !a.sprite.active) return;
      a.shadow.setVisible(false);
      a.sprite.setFlipX(false);
      const napKey = `nap_${a.key}`;
      a.sprite.play(this.anims.exists(napKey) ? napKey : `idle_${a.key}`, true);
      a.wanderTween = this.tweens.add({
        targets: a.sprite, y: ey - 16, alpha: 0, // step up into the home, fading
        duration: 600, ease: 'Sine.easeIn',
        onComplete: () => {
          a.wanderTween = null;
          if (a.state === 'homing') a.sprite.setVisible(false);
        },
      });
    });
  }

  // Morning: re-emerge from the home structure and resume wandering (or go straight
  // back home if night somehow fell again mid-emerge). Mirrors catLeaveHome.
  _animalLeaveHome(a, entry) {
    if (!entry) { a.state = 'idle'; a.sprite.setVisible(true).setAlpha(1); this.scheduleAnimalWander(a, Phaser.Math.Between(300, 2500)); return; }
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    const { x: ex, y: ey } = entry;
    a.state = 'leaving';
    a.sprite.setPosition(ex, ey - 16).setAlpha(0).setVisible(true);
    a.shadow.setPosition(ex, ey).setVisible(true);
    a.sprite.play(`idle_${a.key}`, true);
    a.wanderTween = this.tweens.add({
      targets: a.sprite, y: ey, alpha: 1,
      duration: 600, ease: 'Sine.easeOut',
      onComplete: () => {
        a.wanderTween = null;
        if (!a.sprite.active) return;
        if (this.isNight) { this._animalGoHome(a, entry); return; }
        a.state = 'idle';
        this.scheduleAnimalWander(a, Phaser.Math.Between(300, 2500));
      },
    });
  }

  _scheduleBirds() {
    const delay = Phaser.Math.Between(4000, 12000);
    this.time.delayedCall(delay, () => {
      if (!this.isNight) playBirdChirp();
      this._scheduleBirds();
    });
  }

};
