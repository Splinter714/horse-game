// Drivable tractor (#264) — a parked farm vehicle the player can walk up to and
// ENTER/EXIT (mirrors riding.js's mountHorse/dismount shape, simplified: no saddle
// gate, no gait/leading). While driving, player input redirects to the tractor
// instead of the player sprite (movePlayer bails early via `this.driving`, same
// pattern updateRiding uses via `this.riding`). A nearby paint stand cycles the
// tractor's body color through a small fixed swatch set (mirrors the barn tack
// rack's cycle-in-place interaction). Driving over the existing garden bed (#242)
// plays a purely COSMETIC tilling flourish — dust puffs + a fading plow-line — no
// new tillable ground, no mechanical effect on the crops.
//
// Applied as a functional mixin so `this` is the scene.

import Phaser from 'phaser';
import { PLAYER_BOUNDS, S, TRACTOR_SPEED } from './constants.js';
import { TRACTOR_COLORS, DEFAULT_TRACTOR_COLOR, tractorColor, buildTractorTextures } from '../../art/tractorArt.js';
import { loadTractorState, saveTractorState } from '../../data/save.js';
import { playTill } from '../../audio/sounds.js';

// Parked near the garden bed (PLOT = {1500, 560} in garden.js) on open ground, so
// driving out over the tilled bed for the cosmetic pass is a short, natural trip.
const TRACTOR_SPAWN = { x: 1580, y: 640 };
// Small sign a few steps from the tractor — a separate interactable so cycling
// paint never competes with the "Enter Tractor" prompt on the vehicle itself.
const PAINT_STAND = { x: TRACTOR_SPAWN.x + 70, y: TRACTOR_SPAWN.y + 10 };


export const WithTractor = (Base) => class extends Base {
  buildTractor() {
    const saved = loadTractorState();
    const colorId = saved.color ?? DEFAULT_TRACTOR_COLOR;
    buildTractorTextures(this, colorId);

    const sprite = this.add.sprite(TRACTOR_SPAWN.x, TRACTOR_SPAWN.y, 'tractor_idle')
      .setOrigin(0.5, 1).setScale(S).setDepth(TRACTOR_SPAWN.y);
    const shadow = this.add.image(TRACTOR_SPAWN.x, TRACTOR_SPAWN.y, 'shadow')
      .setScale(S * 1.3).setDepth(TRACTOR_SPAWN.y - 1);

    this.tractor = {
      x: TRACTOR_SPAWN.x, y: TRACTOR_SPAWN.y, sprite, shadow, colorId,
      moving: false, flipX: false, facing: 'side',
    };
    // Solid parked footprint so animals/player walk around it when not in use.
    // Kept out of `this.obstacles` while being DRIVEN (enter/exitTractor toggle it,
    // mirroring how worldObjects.js's gate obstacle is added/removed) so the
    // tractor doesn't collide with its own parked footprint mid-drive.
    this._tractorObstacle = { x: TRACTOR_SPAWN.x - 34, y: TRACTOR_SPAWN.y - 30, w: 68, h: 30, isTractor: true };
    this.obstacles.push(this._tractorObstacle);

    this.driving = false; // mirrors `this.riding` — set while the player is at the wheel
    this._tillMarks = []; // fading cosmetic plow-line graphics over the garden (#242)
    this._tillPatches = []; // longer-lived dirt-patch trail (#264 playtest follow-up)
  }

  // ─── Enter / exit ────────────────────────────────────────────────────────

  enterTractor() {
    if (this.driving) return;
    if (this.riding) this.dismount(); // can't ride a horse and drive at once
    this._cancelTapMove();
    this.player.moving = false;
    this.player.sprite.setVisible(false);
    this.player.shadow.setVisible(false);
    this.driving = true;
    // Pull the parked footprint out of the shared obstacle list so the tractor
    // doesn't collide with itself while being driven.
    const i = this.obstacles.indexOf(this._tractorObstacle);
    if (i >= 0) this.obstacles.splice(i, 1);
    this.cameras.main.startFollow(this.tractor.sprite, true, 0.12, 0.12);
  }

  exitTractor() {
    if (!this.driving) return;
    const t = this.tractor;
    const offset = t.flipX ? 70 : -70;
    this.player.sprite.x = Phaser.Math.Clamp(t.sprite.x + offset, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    this.player.sprite.y = t.sprite.y;
    this.player.sprite.setDepth(this.player.sprite.y);
    this.player.sprite.setVisible(true);
    this.player.shadow.setVisible(true);
    this.driving = false;
    // Re-park the collision footprint at wherever the tractor came to rest.
    this._tractorObstacle.x = t.sprite.x - 34;
    this._tractorObstacle.y = t.sprite.y - 30;
    if (!this.obstacles.includes(this._tractorObstacle)) this.obstacles.push(this._tractorObstacle);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
  }

  // ─── Driving ─────────────────────────────────────────────────────────────

  updateTractor(delta) {
    if (!this.driving) return;
    const t = this.tractor;
    const { cursors, wasd } = this;

    let vx = 0, vy = 0;
    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;
    const pad = this.gamePad;
    if (pad) {
      if (Math.abs(pad.leftStick.x) > 0.15) vx += pad.leftStick.x;
      if (Math.abs(pad.leftStick.y) > 0.15) vy += pad.leftStick.y;
    }
    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    const step = TRACTOR_SPEED * (delta / 1000);
    const nx = Phaser.Math.Clamp(t.sprite.x + vx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(t.sprite.y + vy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    const R = 26; // the tractor's a bit bigger-bodied than the player for collision
    const beforeX = t.sprite.x, beforeY = t.sprite.y;
    if (!this._collides(nx, t.sprite.y, R)) t.sprite.x = nx;
    if (!this._collides(t.sprite.x, ny, R)) t.sprite.y = ny;
    const moved = Math.hypot(t.sprite.x - beforeX, t.sprite.y - beforeY) > 0.5;
    t.x = t.sprite.x; t.y = t.sprite.y;
    t.moving = moved;
    if (vx !== 0) t.flipX = vx < 0;

    // Facing (#264 playtest follow-up): pick a driving axis like the player's own
    // up/down/side art (playerMovement.js) instead of always reusing the side view.
    // Whichever input axis is stronger wins so a mostly-vertical nudge still reads
    // as "up"/"down" even with a little horizontal drift.
    if (moved) {
      t.facing = Math.abs(vy) > Math.abs(vx) ? (vy < 0 ? 'up' : 'down') : 'side';
    }
    const facing = t.facing || 'side';

    t.sprite.setFlipX(facing === 'side' ? t.flipX : false);
    t.sprite.setDepth(t.sprite.y);
    const bob = moved && (Math.floor(this.time.now / 140) % 2);
    const texture = !moved ? (facing === 'up' ? 'tractor_up_0' : facing === 'down' ? 'tractor_down_0' : 'tractor_idle')
      : facing === 'up' ? (bob ? 'tractor_up_1' : 'tractor_up_0')
      : facing === 'down' ? (bob ? 'tractor_down_1' : 'tractor_down_0')
      : (bob ? 'tractor_drive_1' : 'tractor_drive_0');
    t.sprite.setTexture(texture);
    t.shadow.x = t.sprite.x;
    t.shadow.y = t.sprite.y;
    t.shadow.setDepth(t.sprite.y - 1);

    if (moved) this._maybeTillGarden();

    // E / Space or A → exit.
    if (this._interactJustDown() || this.padAJustDown) {
      this.padAJustDown = false;
      this.exitTractor();
    }
  }

  // ─── Cosmetic garden tilling flourish (#264, no mechanical effect) ────────

  // While driving over the existing garden-bed footprint, drop an occasional
  // fading dust-puff + short plow-line, a longer-lived dirt patch, and a soft
  // scrape sound — purely decorative flavor, no new tillable ground and no
  // effect on planted crops (locked scope per #264).
  //
  // #264 playtest follow-up (2026-07-06): the original puff+line alone read as
  // "no clear feedback" — the puff was offset for a horse's back (wrong height
  // for a ground vehicle) and nothing stuck around to show where you'd been.
  // Now: puffs kick up at wheel height, a dirt-tinted patch stays down as a
  // visible tilled trail (capped so it can't grow unbounded), and a soft scrape
  // plays on a slower cadence than the visual cue.
  _maybeTillGarden() {
    const gd = this.garden;
    if (!gd) return;
    const t = this.tractor;
    const dx = t.sprite.x - gd.x, dy = t.sprite.y - gd.y;
    // Rough bed footprint (mirrors the obstacle box garden.js registers), padded
    // by the tractor's collision radius so the reachable band right up against
    // the solid bed obstacle reliably counts as "tilling", not just a lucky pixel.
    if (Math.abs(dx) > 110 || dy > 40 || dy < -130) return;

    const now = this.time.now;
    if (this._lastTillAt && now - this._lastTillAt < 90) return;
    this._lastTillAt = now;

    this.showDustPuff?.(t.sprite, 0.5, -4); // ground/wheel height, not the horse-back default

    // Persistent dirt patch — a soft dark ellipse that stays put (unlike the puff/
    // line) so a pass over the bed leaves a visible trail. Capped to the most
    // recent N so a long session doesn't accumulate unbounded display objects.
    const patch = this.add.ellipse(t.sprite.x, t.sprite.y - 4, 22, 8, 0x4a3018, 0.3).setDepth(t.sprite.y - 3);
    this._tillPatches.push(patch);
    const MAX_PATCHES = 60;
    while (this._tillPatches.length > MAX_PATCHES) this._tillPatches.shift().destroy();

    const line = this.add.graphics().setDepth(t.sprite.y - 2);
    line.lineStyle(3, 0x5a3f24, 0.55);
    line.beginPath();
    line.moveTo(t.sprite.x - (t.flipX ? -18 : 18), t.sprite.y - 6);
    line.lineTo(t.sprite.x, t.sprite.y - 4);
    line.strokePath();
    this._tillMarks.push(line);
    this.tweens.add({
      targets: line, alpha: 0, duration: 2600, ease: 'Sine.easeOut',
      onComplete: () => { line.destroy(); const i = this._tillMarks.indexOf(line); if (i >= 0) this._tillMarks.splice(i, 1); },
    });

    if (!this._lastTillSoundAt || now - this._lastTillSoundAt > 380) {
      this._lastTillSoundAt = now;
      playTill();
    }
  }

  // ─── Paint stand (color cycle) ───────────────────────────────────────────

  cycleTractorColor() {
    const ids = TRACTOR_COLORS.map(c => c.id);
    const i = ids.indexOf(this.tractor.colorId);
    const next = ids[(i + 1) % ids.length];
    this.tractor.colorId = next;
    buildTractorTextures(this, next); // re-gen the idle/drive textures in place (like reskinHorse)
    saveTractorState({ color: next });
  }

  // ─── World interactables (merged into buildInteractables' list) ──────────

  _tractorInteractables() {
    const t = this.tractor;
    if (!t) return [];
    const enter = {
      x: t.sprite.x, y: t.sprite.y, tapRadius: 90, reachDist: 100, promptOffsetY: 40,
      canAct: !this.driving, label: 'Enter Tractor',
      approach: () => ({ x: t.sprite.x, y: t.sprite.y + 40 }),
      activate: () => this.enterTractor(),
    };
    const paint = {
      x: PAINT_STAND.x, y: PAINT_STAND.y, tapRadius: 60, reachDist: 70, promptOffsetY: 20,
      canAct: !this.driving,
      label: `Paint Tractor: ${tractorColor(t.colorId).label}  •  switch`,
      approach: () => ({ x: PAINT_STAND.x, y: PAINT_STAND.y + 30 }),
      activate: () => this.cycleTractorColor(),
    };
    return this.driving ? [] : [enter, paint];
  }
};
