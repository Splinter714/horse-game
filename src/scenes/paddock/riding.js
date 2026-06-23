// Riding, saddle (equip/remove) and leading. Applied as a functional mixin so
// `this` is the scene.

import Phaser from 'phaser';
import { playBrush } from '../../audio/sounds.js';
import { PLAYER_SPEED, RIDE_SPEED, PLAYER_BOUNDS, S } from './constants.js';

export const WithRiding = (Base) => class extends Base {
  // ─── Riding ──────────────────────────────────────────────────────────────

  // ─── Saddle (equip/remove) ───────────────────────────────────────────────
  // The saddle is a persistent, visible piece of tack. Riding is gated behind it
  // (see mountHorse). Equipping/removing is independent of mounting (issue #54).

  toggleSaddle(h) {
    if (h.saddled) this.removeSaddle(h);
    else           this.equipSaddle(h);
  }

  equipSaddle(h) {
    if (!h.saddleImg) {
      h.saddleImg = this.add.image(h.sprite.x, h.sprite.y, 'saddleOverlay')
        .setScale(S).setOrigin(0.5, 1).setDepth(h.sprite.depth + 1)
        .setFlipX(h.sprite.flipX);
    }
    if (!h.saddled) {
      h.saddled = true;
      const model = this.registry.get('allHorses')[h.key];
      if (model) model.saddled = true;
      playBrush();
      this.showIcon('iconSaddle', h.sprite);
      this._saveHorses();
    }
  }

  removeSaddle(h) {
    if (this.riding?.h === h) return; // can't unsaddle the horse you're riding
    if (h.saddleImg) { h.saddleImg.destroy(); h.saddleImg = null; }
    if (h.saddled) {
      h.saddled = false;
      const model = this.registry.get('allHorses')[h.key];
      if (model) model.saddled = false;
      this._saveHorses();
    }
  }

  mountHorse(h) {
    if (!h.saddled) return; // a saddle is required before you can ride
    if (this.riding) this.dismount();
    if (this.leadHorses.includes(h)) this.stopLeadingHorse(h);

    // Interrupt any current behavior
    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }
    h.state = 'riding';

    // Freeze player on side-view idle frame so they appear to sit
    this.player.sprite.stop();
    this.player.sprite.setTexture('player_side_0');
    this.player.shadow.setVisible(false);
    this._cancelTapMove();
    this.player.moving = false;

    this._cancelRideNav();
    this.riding = { h };
    this.cameras.main.startFollow(h.sprite, true, 0.12, 0.12);
  }

  dismount() {
    if (!this.riding) return;
    const { h } = this.riding;
    // The saddle stays equipped on the horse — dismounting doesn't remove it.

    // Place player next to horse, restore shadow
    const offset = h.sprite.flipX ? 80 : -80;
    this.player.sprite.x = Phaser.Math.Clamp(h.sprite.x + offset, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    this.player.sprite.y = h.sprite.y;
    this.player.sprite.setDepth(this.player.sprite.y);
    this.player.shadow.setVisible(true);

    h.state = 'idle';
    this.riding = null;
    this._cancelRideNav();
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.scheduleWander(h, 2000);
  }

  updateRiding(delta) {
    if (!this.riding) return;
    const { h } = this.riding;
    const saddleImg = h.saddleImg;
    const { cursors, wasd } = this;

    let vx = 0, vy = 0;
    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;
    const pad = this.gamePad;
    if (pad) {
      // Left stick steers the horse; the D-pad is reserved for the hotbar (#121).
      if (Math.abs(pad.leftStick.x) > 0.15) vx += pad.leftStick.x;
      if (Math.abs(pad.leftStick.y) > 0.15) vy += pad.leftStick.y;
    }
    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    const manual = vx !== 0 || vy !== 0;
    if (manual) this._cancelRideNav();

    const step = RIDE_SPEED * (delta / 1000);
    let moving = false;
    if (manual) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      moving = this._moveHorseBy(h, vx * step, vy * step);
      if (vx !== 0) h.sprite.setFlipX(vx < 0);
    } else if (this.rideNav) {
      moving = this._stepRideNav(delta);
    }

    h.sprite.play(moving ? `walk_${h.key}` : `idle_${h.key}`, true);

    saddleImg.x = h.sprite.x;
    saddleImg.y = h.sprite.y;
    saddleImg.setFlipX(h.sprite.flipX);
    saddleImg.setDepth(h.sprite.y + 1);

    // Position rider on horse's back (saddle is ~55px above horse feet at scale 2)
    const riderXOff = h.sprite.flipX ? 10 : -10;
    this.player.sprite.x = h.sprite.x + riderXOff;
    this.player.sprite.y = h.sprite.y - 55;
    this.player.sprite.setFlipX(h.sprite.flipX);
    this.player.sprite.setDepth(h.sprite.y + 2);

    // Keep player shadow hidden under horse
    this.player.shadow.x = h.sprite.x;
    this.player.shadow.y = h.sprite.y;

    // E or A → dismount
    if (Phaser.Input.Keyboard.JustDown(this.eKey) || this.padAJustDown) {
      this.padAJustDown = false;
      this.dismount();
    }
  }

  // Slide the ridden horse by (dx,dy), blocked by fences/gate and clamped to the
  // walkable world. Axis-separated so it slides along walls. Returns true if it
  // actually moved.
  _moveHorseBy(h, dx, dy) {
    const r = 16, s = h.sprite;
    const bx = s.x, by = s.y;
    const nx = Phaser.Math.Clamp(s.x + dx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(s.y + dy, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    if (!this._collides(nx, s.y, r)) s.x = nx;
    if (!this._collides(s.x, ny, r)) s.y = ny;
    return Math.hypot(s.x - bx, s.y - by) > 0.5;
  }

  // Tap-to-ride: route the mounted horse to (tx,ty) around obstacles.
  _rideMoveTo(tx, ty) {
    const s = this.riding.h.sprite;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    const path = this._findPath(s.x, s.y, tx, ty);
    this.rideNav = (path && path.length) ? path : [{ x: tx, y: ty }];
    this._rideStuck = 0;
  }

  _cancelRideNav() { this.rideNav = null; this._rideStuck = 0; }

  // Advance the ridden horse one frame along rideNav; abandons if wedged.
  _stepRideNav(delta) {
    const s = this.riding.h.sprite;
    let wp = this.rideNav[0];
    while (wp && Phaser.Math.Distance.Between(s.x, s.y, wp.x, wp.y) < 10) {
      this.rideNav.shift();
      wp = this.rideNav[0];
    }
    if (!wp) { this._cancelRideNav(); return false; }

    const dx = wp.x - s.x, dy = wp.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = RIDE_SPEED * (delta / 1000);
    const moved = this._moveHorseBy(this.riding.h, (dx / dist) * step, (dy / dist) * step);
    if (Math.abs(dx) > 1) s.setFlipX(dx < 0);

    if (!moved) {
      this._rideStuck += delta;
      if (this._rideStuck > 350) { this._cancelRideNav(); return false; }
    } else {
      this._rideStuck = 0;
    }
    return moved;
  }

  // ─── Leading ─────────────────────────────────────────────────────────────

  toggleLead(h) {
    // Toggle this horse off if already led
    if (this.leadHorses.includes(h)) { this.stopLeadingHorse(h); return; }

    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }
    h.state = 'led';
    this.leadHorses.push(h);
  }

  stopLeadingHorse(h) {
    const i = this.leadHorses.indexOf(h);
    if (i === -1) return;
    this.leadHorses.splice(i, 1);
    h.state = 'idle';
    this.scheduleWander(h, 1500);
    if (this.leadHorses.length === 0) this.leadRope.clear();
  }

  stopLeading() {
    // Release every led horse
    for (const h of [...this.leadHorses]) this.stopLeadingHorse(h);
  }

  updateLeading(delta) {
    if (this.leadHorses.length === 0) { this.leadRope.clear(); return; }

    const dt = delta / 1000;
    this.leadRope.clear();
    this.leadRope.lineStyle(3, 0xc8a040, 0.85);

    // Natural follow-the-leader trailing (#115): the first horse follows the
    // player, each next follows the horse ahead. A horse only closes the gap once
    // the leader pulls more than GAP away — within that it has slack and rests, so
    // it eases *into* a walk and trails behind on its own line rather than being
    // rigidly pinned to a point off the player's facing (which made it look
    // dragged). It heads toward wherever the leader actually is, at a believable
    // angle, and faces the way it travels.
    const GAP     = 88;                        // desired trailing distance
    const maxStep = PLAYER_SPEED * 1.25 * dt;  // can outpace the player a touch to keep up

    let leadX = this.player.sprite.x, leadY = this.player.sprite.y;
    let prevX = this.player.sprite.x, prevY = this.player.sprite.y - 16;

    this.leadHorses.forEach((h) => {
      const dx = leadX - h.sprite.x;
      const dy = leadY - h.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;

      const fromX = h.sprite.x, fromY = h.sprite.y;
      if (dist > GAP) {
        const pull = Math.min(dist - GAP, maxStep);
        const ux = dx / dist, uy = dy / dist;
        // Axis-separated move with collision so a led horse slides along the
        // fence and can only cross the pasture boundary through the open gate.
        const nx = h.sprite.x + ux * pull;
        const ny = h.sprite.y + uy * pull;
        if (!this._collides(nx, h.sprite.y, 16)) h.sprite.x = nx;
        if (!this._collides(h.sprite.x, ny, 16)) h.sprite.y = ny;
      }

      // Face the way it's actually travelling (horses only flip horizontally).
      const movedX = h.sprite.x - fromX;
      if (Math.abs(movedX) > 0.2) h.sprite.setFlipX(movedX < 0);

      // Walk while moving, with a short hysteresis so the trot doesn't flicker to
      // idle during the brief catch-up pauses; settle to idle once truly stopped.
      const moved = Math.hypot(h.sprite.x - fromX, h.sprite.y - fromY);
      if (moved > 0.3) {
        h._ledStillFor = 0;
        h.sprite.play(`walk_${h.key}`, true);
      } else {
        h._ledStillFor = (h._ledStillFor || 0) + delta;
        if (h._ledStillFor > 150 && h.sprite.anims.currentAnim?.key !== `idle_${h.key}`) {
          h.sprite.play(`idle_${h.key}`, true);
        }
      }

      // Rope with a little sag — slack when the horse is bunched up close, taut
      // as it trails at the full gap. Sampled as a shallow arc so the lead reads
      // as a soft rope, not a rigid tow-bar.
      const hx = h.sprite.x, hy = h.sprite.y - 32;
      const sag = 10 + Phaser.Math.Clamp(GAP - dist, 0, GAP) * 0.6;
      this.leadRope.beginPath();
      this.leadRope.moveTo(prevX, prevY);
      const SEG = 8;
      for (let s = 1; s <= SEG; s++) {
        const t = s / SEG;
        const x = prevX + (hx - prevX) * t;
        const y = prevY + (hy - prevY) * t + Math.sin(Math.PI * t) * sag;
        this.leadRope.lineTo(x, y);
      }
      this.leadRope.strokePath();

      // The next link in the chain follows this horse.
      leadX = h.sprite.x; leadY = h.sprite.y;
      prevX = hx; prevY = hy;
    });
  }

};
