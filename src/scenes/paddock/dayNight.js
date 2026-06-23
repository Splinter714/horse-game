// Day/night response: phase changes, dawn roll-over, resting/waking animals,
// chicken roosting, ambient birds. Applied as a functional mixin.

import Phaser from 'phaser';
import { playBirdChirp, setMusicMode } from '../../audio/sounds.js';

export const WithDayNight = (Base) => class extends Base {
  // ─── Day / Night ─────────────────────────────────────────────────────────

  onPhaseChange({ isNight, phase }) {
    this._phase = phase;
    if (phase === 'Morning') this._dawnNewDay();
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
      if (!a.key.startsWith('chicken')) continue;
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
    const allHorses = this.registry.get('allHorses');
    for (const h of this.horses) allHorses[h.key]?.rollNewDay();
  }

  restAllAnimals() {
    const stopOne = (a) => {
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
      if (a.eatTimer)    { a.eatTimer.remove?.() ?? this.time.removeEvent(a.eatTimer); a.eatTimer = null; }
      if (a._begTimer)   { this.time.removeEvent(a._begTimer); a._begTimer = null; }
      a._eatPile = null;
      a.state = 'resting';
      a.sprite.play(`idle_${a.key}`, true);
      // Schedule random lay-down moments while sleeping
      this._scheduleLayDown(a);
    };
    for (const h of this.horses) stopOne(h);
    for (const a of this.animals) {
      if (a.key.startsWith('chicken')) this.chickenRoost(a);
      else stopOne(a);
    }
    // Send any visiting NPCs away at night
    for (const npc of [...this.npcs]) {
      if (npc.tween) { npc.tween.stop(); npc.tween = null; }
      this._npcLeave(npc);
    }
  }

  _scheduleLayDown(a) {
    if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
    if (a.state !== 'resting') return;

    const delay = Phaser.Math.Between(8000, 16000);
    a._sleepTimer = this.time.delayedCall(delay, () => {
      if (a.state !== 'resting') return;
      a._sleepTimer = null;

      if (Math.random() < 0.5) {
        a.sprite.play(`sleep_${a.key}`, true);
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
      if (h.state === 'resting') { h.state = 'idle'; this.scheduleWander(h, Phaser.Math.Between(500, 3000)); }
    }
    for (const a of this.animals) {
      if (a._sleepTimer) { this.time.removeEvent(a._sleepTimer); a._sleepTimer = null; }
      if (a.key.startsWith('chicken')) {
        if (a.state === 'roosting') this.chickenLeaveCoop(a);
      } else if (a.state === 'resting') {
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
        if (!a.sprite.active) return;
        a.sprite.setAlpha(1);
        if (this.isNight) { this.chickenRoost(a); return; }
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
