// Riding, saddle (equip/remove) and leading. Applied as a functional mixin so
// `this` is the scene.

import Phaser from 'phaser';
import { playBrush } from '../../audio/sounds.js';
import { PLAYER_SPEED, RIDE_SPEED, PLAYER_BOUNDS, S, USE_REACH } from './constants.js';
import { SADDLE_TYPES, DEFAULT_SADDLE_TYPE } from '../../data/items.js';

export const WithRiding = (Base) => class extends Base {
  // ─── Riding ──────────────────────────────────────────────────────────────

  // ─── Saddle (equip/remove) ───────────────────────────────────────────────
  // The saddle is a persistent, visible piece of tack. Riding is gated behind it
  // (see mountHorse). Equipping/removing is independent of mounting (issue #54).
  // #134 follow-up: WHICH saddle gets equipped is now data-driven (SADDLE_TYPES) —
  // the tack rack in the barn (barn.js) picks the active type; the saddle tool
  // itself still just toggles equip/remove, unchanged.

  toggleSaddle(h) {
    if (h.saddled) this.removeSaddle(h);
    else           this.equipSaddle(h);
  }

  // Resolve the active saddle type from the tack rack (HotbarScene owns the
  // persisted `activeSaddleType`, mirroring activeCarrier), falling back to the
  // default if the hotbar isn't ready yet.
  _activeSaddleType() {
    return this.scene.get('HotbarScene')?.getActiveSaddleType?.() ?? DEFAULT_SADDLE_TYPE;
  }

  equipSaddle(h) {
    const typeId = this._activeSaddleType();
    const def = SADDLE_TYPES[typeId] ?? SADDLE_TYPES[DEFAULT_SADDLE_TYPE];

    // Swap/create the saddle overlay image for the chosen type. A bareback pad
    // has no rigid overlay texture (def.overlay is null) — no saddle silhouette
    // shows on the horse, matching its "just a pad" look.
    if (h.saddleImg) { h.saddleImg.destroy(); h.saddleImg = null; }
    if (def.overlay) {
      h.saddleImg = this.add.image(h.sprite.x, h.sprite.y, def.overlay)
        .setScale(S).setOrigin(0.5, 1).setDepth(h.sprite.depth + 1)
        .setFlipX(h.sprite.flipX);
    }
    h.saddleType = typeId;

    if (!h.saddled) {
      h.saddled = true;
      const model = this.registry.get('allHorses')[h.key];
      if (model) { model.saddled = true; model.saddleType = typeId; }
      playBrush();
      this.showIcon(def.icon, h.sprite);
      this._saveHorses();
    } else {
      // Re-equipping while already saddled (switching type mid-game): still
      // persist the new type on the model.
      const model = this.registry.get('allHorses')[h.key];
      if (model) model.saddleType = typeId;
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
    if (this.tiedHorses.includes(h)) this.untieHorse(h);

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

    // Saddle type nudges ride speed (#134 follow-up): english a touch faster,
    // bareback a touch slower, western the baseline. Falls back to 1.0 for an
    // unrecognized/legacy type so an older save never breaks.
    const speedMult = SADDLE_TYPES[h.saddleType]?.rideSpeedMult ?? 1.0;
    const step = RIDE_SPEED * speedMult * (delta / 1000);
    let moving = false;
    if (manual) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      moving = this._moveHorseBy(h, vx * step, vy * step);
      if (vx !== 0) h.sprite.setFlipX(vx < 0);
    } else if (this.rideNav) {
      moving = this._stepRideNav(delta, speedMult);
    }

    h.sprite.play(moving ? `walk_${h.key}` : `idle_${h.key}`, true);

    // A bareback pad has no overlay image (h.saddleImg stays null) — nothing to
    // reposition, matching its "no saddle silhouette" look.
    if (saddleImg) {
      saddleImg.x = h.sprite.x;
      saddleImg.y = h.sprite.y;
      saddleImg.setFlipX(h.sprite.flipX);
      saddleImg.setDepth(h.sprite.y + 1);
    }

    // Position rider on horse's back (saddle is ~55px above horse feet at scale 2)
    const riderXOff = h.sprite.flipX ? 10 : -10;
    this.player.sprite.x = h.sprite.x + riderXOff;
    this.player.sprite.y = h.sprite.y - 55;
    this.player.sprite.setFlipX(h.sprite.flipX);
    this.player.sprite.setDepth(h.sprite.y + 2);

    // Keep player shadow hidden under horse
    this.player.shadow.x = h.sprite.x;
    this.player.shadow.y = h.sprite.y;

    // E / Space or A → dismount
    if (this._interactJustDown() || this.padAJustDown) {
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
  // speedMult (default 1.0) is the active saddle type's rideSpeedMult (#134).
  _stepRideNav(delta, speedMult = 1.0) {
    const s = this.riding.h.sprite;
    let wp = this.rideNav[0];
    while (wp && Phaser.Math.Distance.Between(s.x, s.y, wp.x, wp.y) < 10) {
      this.rideNav.shift();
      wp = this.rideNav[0];
    }
    if (!wp) { this._cancelRideNav(); return false; }

    const dx = wp.x - s.x, dy = wp.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = RIDE_SPEED * speedMult * (delta / 1000);
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
    // Tied horses (#317): repeating Use on a tied horse unties it — that's the
    // only untie action, no separate button.
    if (this.tiedHorses.includes(h)) { this.untieHorse(h); return; }

    // Already being led: tie it here if the player is near a fence rail (any
    // rail — pasture perimeter or the house fence line, #317); otherwise the
    // second Use press just releases it as before.
    if (this.leadHorses.includes(h)) {
      const tiePoint = this._nearestFenceTiePoint(this.player.sprite.x, this.player.sprite.y);
      if (tiePoint) { this.tieHorseToFence(h, tiePoint); return; }
      this.stopLeadingHorse(h);
      return;
    }

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

    // Every led horse leads back to the PLAYER directly — no daisy-chaining off the
    // horse ahead (#135). Each gets its own slot in a fan *behind* the player so the
    // group spreads out instead of stacking on one point, and its own rope to the
    // player. A horse rests once it's within SLACK of its slot, then eases into a
    // walk to catch up, so it trails on its own line rather than looking dragged
    // (#115).
    const GAP     = 88;                        // trailing distance from the player
    const SLACK   = 26;                         // rest once within this of the slot
    const FAN     = 0.5;                         // radians between adjacent horses
    const maxStep = PLAYER_SPEED * 1.25 * dt;  // can outpace the player a touch to keep up

    const px = this.player.sprite.x, py = this.player.sprite.y;
    const ropeAnchorX = px, ropeAnchorY = py - 16;
    // "Behind" the player is the opposite of the way they're facing; the fan is
    // centred there so horses trail behind however the player is moving.
    const behind = { right: Math.PI, left: 0, down: -Math.PI / 2, up: Math.PI / 2 }[this.player.facing]
                   ?? -Math.PI / 2;
    const n = this.leadHorses.length;

    this.leadHorses.forEach((h, i) => {
      const angle = behind + (i - (n - 1) / 2) * FAN;
      const tx = px + Math.cos(angle) * GAP;
      const ty = py + Math.sin(angle) * GAP;

      const fromX = h.sprite.x, fromY = h.sprite.y;
      const dx = tx - h.sprite.x, dy = ty - h.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > SLACK) {
        const pull = Math.min(dist - SLACK, maxStep);
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

      // Rope: player → this horse, a shallow sagging arc (soft rope, not a tow-bar).
      const hx = h.sprite.x, hy = h.sprite.y - 32;
      const ropeLen = Math.hypot(hx - ropeAnchorX, hy - ropeAnchorY);
      const sag = 10 + Phaser.Math.Clamp(GAP - ropeLen, 0, GAP) * 0.5;
      this.leadRope.beginPath();
      this.leadRope.moveTo(ropeAnchorX, ropeAnchorY);
      const SEG = 8;
      for (let s = 1; s <= SEG; s++) {
        const t = s / SEG;
        const x = ropeAnchorX + (hx - ropeAnchorX) * t;
        const y = ropeAnchorY + (hy - ropeAnchorY) * t + Math.sin(Math.PI * t) * sag;
        this.leadRope.lineTo(x, y);
      }
      this.leadRope.strokePath();
    });
  }

  // ─── Tying to a fence (#317) ─────────────────────────────────────────────
  // Any fence rail counts — the pasture perimeter and the house fence line are
  // both tagged `isFence: true` on their collision rects in buildObstacles/
  // buildPastureFence (world.js). Ties at the closest point on the nearest rail
  // within reach of (x,y), nudged toward that side of the rail so the horse
  // stands beside it rather than inside the solid fence.
  _nearestFenceTiePoint(x, y, maxDist = USE_REACH) {
    let best = null, bestD = Infinity;
    for (const f of this.obstacles) {
      if (!f.isFence) continue;
      // #387: fence rects may now be oriented (angle + center x/y), so use
      // the shared helper instead of a plain corner-based clamp.
      const { x: cx, y: cy } = this._nearestPointOnObstacleRect(x, y, f);
      const d = Phaser.Math.Distance.Between(x, y, cx, cy);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    if (!best || bestD > maxDist) return null;

    const MARGIN = 28; // stand this far off the rail, on the player's side
    let dx = x - best.x, dy = y - best.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: best.x + (dx / dist) * MARGIN, y: best.y + (dy / dist) * MARGIN };
  }

  tieHorseToFence(h, point) {
    // Drop out of the leading group (no more pull-toward-player).
    const i = this.leadHorses.indexOf(h);
    if (i !== -1) this.leadHorses.splice(i, 1);
    if (this.leadHorses.length === 0) this.leadRope.clear();

    if (h.wanderTween) { h.wanderTween.stop(); h.wanderTween = null; }
    if (h.eatTimer) { h.eatTimer.remove(); h.eatTimer = null; }
    if (h._begTimer) { this.time.removeEvent(h._begTimer); h._begTimer = null; }

    h.state = 'tied';
    h.tiedTo = { x: point.x, y: point.y };
    this.tiedHorses.push(h);
  }

  untieHorse(h) {
    const i = this.tiedHorses.indexOf(h);
    if (i === -1) return;
    this.tiedHorses.splice(i, 1);
    h.tiedTo = null;
    h.state = 'idle';
    this.scheduleWander(h, 1500);
    if (this.tiedHorses.length === 0) this.tieRope.clear();
  }

  // Walks a tied horse the last little bit to its tie point (it may have been
  // a step away when tied) and draws a short rope from it to the fence. Unlike
  // a led horse, a tied one never follows the player.
  updateTied(delta) {
    if (this.tiedHorses.length === 0) { this.tieRope.clear(); return; }

    const dt = delta / 1000;
    const SLACK = 4;
    const maxStep = PLAYER_SPEED * dt;

    this.tieRope.clear();
    this.tieRope.lineStyle(3, 0xc8a040, 0.85);

    for (const h of this.tiedHorses) {
      const { x: tx, y: ty } = h.tiedTo;
      const fromX = h.sprite.x, fromY = h.sprite.y;
      const dx = tx - h.sprite.x, dy = ty - h.sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > SLACK) {
        const pull = Math.min(dist - SLACK, maxStep);
        const ux = dx / dist, uy = dy / dist;
        const nx = h.sprite.x + ux * pull;
        const ny = h.sprite.y + uy * pull;
        if (!this._collides(nx, h.sprite.y, 16)) h.sprite.x = nx;
        if (!this._collides(h.sprite.x, ny, 16)) h.sprite.y = ny;
      }

      const movedX = h.sprite.x - fromX;
      if (Math.abs(movedX) > 0.2) h.sprite.setFlipX(movedX < 0);
      const moved = Math.hypot(h.sprite.x - fromX, h.sprite.y - fromY);
      h.sprite.play(moved > 0.3 ? `walk_${h.key}` : `idle_${h.key}`, true);

      // Rope: fence post → horse's head.
      const hx = h.sprite.x, hy = h.sprite.y - 32;
      this.tieRope.beginPath();
      this.tieRope.moveTo(tx, ty - 16);
      this.tieRope.lineTo(hx, hy);
      this.tieRope.strokePath();
    }
  }

};
