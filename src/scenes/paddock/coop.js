// Local two-player co-op (#302) — a SECOND playable body in the same world, on
// the same device, sharing one camera and one save. No networking, no server, no
// split-screen, no second save slot: a friend picks up the arrow keys (or a
// second controller) and helps with the animals.
//
// Scope of v1 (deliberate, see the issue comment):
//   • Player 2 walks, pets/loves any animal in reach, and uses the armed hotbar
//     tool — the two real "helping with the animals" verbs.
//   • Player 1 stays the "host": the hotbar, inventory, info panels, menus,
//     riding, driving and tap-to-move are all player 1's. Player 2 has no
//     separate inventory — the farm's tools are shared, so whatever player 1 has
//     armed is what player 2's Use acts with (one farm, one toolbox).
//   • One shared camera follows the MIDPOINT of the two, and a soft leash
//     (tetherPull) drags player 2 along if player 1 wanders — so player 2 can
//     never be stranded off-screen and player 1 is never slowed down.
//   • Joining/leaving is session-only. Nothing about player 2 is persisted.
//
// Pure maths lives in `data/coop.js` (unit-tested); this file is the Phaser glue.

import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_BOUNDS, CARE_DIST, S } from './constants.js';
import {
  COOP_TETHER, COOP_DEADZONE, coopMoveVector, coopFacing, tetherPull,
  coopCameraFocus, nearestWithin,
} from '../../data/coop.js';

// How long the "press P to join" hint sits in the prompt panel at the start of a
// session. Long enough for a kid to spot it, short enough not to be clutter.
const JOIN_HINT_MS = 25000;

// Player 2's tint, so the two farmers read apart instantly at pixel scale.
const P2_TINT = 0x9fd0ff;

export const WithCoop = (Base) => class extends Base {
  // ─── Setup ────────────────────────────────────────────────────────────────

  // Called from create() right after buildPlayer(). Only sets up the join
  // affordance — the second body itself is built lazily on the first join, so a
  // solo session costs nothing but this handful of key objects.
  buildCoop() {
    this.coop = {
      active: false,   // is player 2 in the game right now?
      scheme: null,    // 'keys' (arrow keys) | 'pad' (second gamepad)
      body:   null,    // { sprite, shadow, tag, facing, moving } — same shape as this.player
      prevPad: {},     // edge-trigger state for the second gamepad
      arrows: this.cursors, // the real cursor keys, handed to player 2 on a keyboard join
    };

    // Join/leave key. P for "player 2" — an unused key that isn't near WASD, so
    // player 1 can't fire it by accident while walking.
    this._coopJoinKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    // Player 2's action keys sit under the right hand, next to the arrow keys:
    // Enter = interact/pet (player 1's E), / = use the armed tool (player 1's F).
    this._coopPetKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this._coopUseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH);

    // Invisible camera target. Solo it sits on player 1 (identical framing to
    // before co-op existed); in co-op it tracks the midpoint of the pair.
    this._coopFocus = this.add.zone(this.player.sprite.x, this.player.sprite.y, 1, 1);
  }

  // ─── Join / leave ─────────────────────────────────────────────────────────

  // Poll the two ways in: the P key (keyboard split — player 2 takes the arrow
  // keys, player 1 keeps WASD) and Start on a SECOND connected gamepad. Pressing
  // P again drops player 2 back out.
  _coopPollJoin() {
    // Not while a panel/menu owns the keyboard — a P press there is that menu's
    // business (the info panel dismisses on any key), not a join/leave.
    const busy = this.scene.isActive('InfoPanelScene')
              || !!this.scene.get('HotbarScene')?.invOpen;
    if (busy) { Phaser.Input.Keyboard.JustDown(this._coopJoinKey); return; } // consume

    if (Phaser.Input.Keyboard.JustDown(this._coopJoinKey)) {
      if (this.coop.active) this._coopLeave();
      else                  this._coopJoin('keys');
      return;
    }
    // Second gamepad: Start joins. (Pad 0 belongs to player 1 — see _pollRawPad.)
    const pad = this._coopPad();
    if (!this.coop.active && pad?.btnStart && !this.coop.prevPad.btnStart) {
      this._coopJoin('pad');
    }
  }

  _coopJoin(scheme) {
    if (this.coop.active) return;
    this.coop.active = true;
    this.coop.scheme = scheme;

    // On a keyboard join the arrow keys become player 2's, so player 1 is on
    // WASD only. Rather than thread a flag through movePlayer/riding/tractor,
    // swap this.cursors for an inert stand-in that inherits from the real key
    // set (so anything else it exposes still resolves) with the four direction
    // keys reading as "not pressed". _coopLeave hands them back.
    if (scheme === 'keys') {
      const inert = { isDown: false, isUp: true };
      this.cursors = Object.create(this.coop.arrows, {
        up:    { value: inert }, down:  { value: inert },
        left:  { value: inert }, right: { value: inert },
      });
    }

    this._coopBuildBody();
    this.cameras.main.startFollow(this._coopFocus, true, 0.12, 0.12);
    this._coopToast('Player 2 joined!');
  }

  _coopLeave() {
    if (!this.coop.active) return;
    this.coop.active = false;
    if (this.coop.scheme === 'keys') this.cursors = this.coop.arrows; // arrows back to player 1
    this.coop.scheme = null;
    const b = this.coop.body;
    if (b) { b.sprite.destroy(); b.shadow.destroy(); b.tag.destroy(); }
    this.coop.body = null;
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this._coopToast('Player 2 left');
  }

  // Build player 2's sprite next to player 1, wearing the same procedurally
  // generated farmer art with a cool tint + a "P2" tag so the two read apart.
  _coopBuildBody() {
    const p = this.player.sprite;
    const x = Phaser.Math.Clamp(p.x + 40, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const y = p.y;
    const shadow = this.add.image(x, y, 'shadow').setScale(S).setDepth(y - 1);
    const sprite = this.add.sprite(x, y, 'player_down_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(y).setTint(P2_TINT);
    const tag = this.add.text(x, y - 62, 'P2', {
      fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#dff0ff',
      backgroundColor: '#1c1f2eaa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(y + 2);
    this.coop.body = { sprite, shadow, tag, facing: 'down', moving: false };
  }

  // ─── Per-frame ────────────────────────────────────────────────────────────

  // Driven from PaddockScene.update (after the proximity passes, before the
  // prompts render, so the join hint can join that frame's prompt lines).
  updateCoop(delta) {
    this._coopPollJoin();

    if (!this.coop.active) {
      if (this.time.now < JOIN_HINT_MS) this._pushPrompt(null, '[ P ]  Player 2 join');
      this._coopSyncPadEdges(); // keep pad edges fresh so Start-to-join reads once
      return;
    }

    this._coopMove(delta);
    this._coopActions();

    const b = this.coop.body;
    b.shadow.setPosition(b.sprite.x, b.sprite.y).setDepth(b.sprite.y - 1);
    b.sprite.setDepth(b.sprite.y);
    b.tag.setPosition(b.sprite.x, b.sprite.y - 62).setDepth(b.sprite.y + 2);

    // Shared single camera: look at the midpoint so both farmers stay framed.
    const focus = coopCameraFocus(this.player.sprite, b.sprite);
    this._coopFocus.setPosition(focus.x, focus.y);

    // Last thing each frame: snapshot the pad so the NEXT frame edge-triggers.
    this._coopSyncPadEdges();
  }

  // Walk player 2 with its own scheme, then apply the leash.
  _coopMove(delta) {
    const b = this.coop.body;
    const s = b.sprite;
    const pad = this.coop.scheme === 'pad' ? this._coopPad() : null;
    const keys = this.coop.scheme === 'keys' ? this.coop.arrows : null;
    const { vx, vy } = coopMoveVector({
      up:    !!keys?.up.isDown,    down:  !!keys?.down.isDown,
      left:  !!keys?.left.isDown,  right: !!keys?.right.isDown,
      stickX: pad?.leftStickX ?? 0, stickY: pad?.leftStickY ?? 0,
    });

    if (vx !== 0 || vy !== 0) {
      const step = PLAYER_SPEED * (delta / 1000);
      const nx = Phaser.Math.Clamp(s.x + vx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      const ny = Phaser.Math.Clamp(s.y + vy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
      // Slide against obstacles per-axis, exactly like player 1.
      if (!this._collides(nx, s.y)) s.x = nx;
      if (!this._collides(s.x, ny)) s.y = ny;
    }

    // Soft leash — player 1 is never blocked; player 2 is dragged along instead.
    // A pull that would land inside an obstacle is skipped (player 2 just lags a
    // beat and catches up once the way is clear) rather than shoved through a fence.
    const p = this.player.sprite;
    const pull = tetherPull(s.x, s.y, p.x, p.y, COOP_TETHER);
    if (pull.pulled && !this._collides(pull.x, pull.y)) {
      s.x = Phaser.Math.Clamp(pull.x, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      s.y = Phaser.Math.Clamp(pull.y, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    }

    this._coopAnimate(b, coopFacing(vx, vy));
  }

  // Player 2's walk cycle — the same three animations player 1 uses.
  _coopAnimate(b, facing) {
    if (facing) {
      if (!b.moving || facing !== b.facing) {
        b.facing = facing;
        const anim = facing === 'up'   ? 'player_walk_up'
                   : facing === 'down' ? 'player_walk_down' : 'player_walk_side';
        b.sprite.setFlipX(facing === 'left');
        b.sprite.play(anim, true);
      }
      b.moving = true;
    } else if (b.moving) {
      const idle = b.facing === 'up'   ? 'player_up_0'
                 : b.facing === 'down' ? 'player_down_0' : 'player_side_0';
      b.sprite.setFlipX(b.facing === 'left');
      b.sprite.stop();
      b.sprite.setTexture(idle);
      b.moving = false;
    }
  }

  // ─── Player 2's actions ───────────────────────────────────────────────────

  _coopActions() {
    if (this.scene.get('HotbarScene')?.invOpen) return;
    if (this.scene.isActive('InfoPanelScene')) return;

    const pad = this.coop.scheme === 'pad' ? this._coopPad() : null;
    const prev = this.coop.prevPad;
    const petJust = (this.coop.scheme === 'keys' && Phaser.Input.Keyboard.JustDown(this._coopPetKey))
                 || (!!pad?.btnA && !prev.btnA);
    const useJust = (this.coop.scheme === 'keys' && Phaser.Input.Keyboard.JustDown(this._coopUseKey))
                 || (!!pad?.btnX && !prev.btnX);

    if (petJust) this._coopPet();
    if (useJust) this._coopUse();
  }

  // Pet whatever animal is nearest to PLAYER 2 (independent of player 1's own
  // proximity target — that's the whole point of a second pair of hands). Reuses
  // the shared pet path, so hearts, sounds, happiness, the daily "loved" flag and
  // the save all behave exactly as they do for player 1.
  _coopPet() {
    const t = this._coopNearestPettable();
    if (t) this._petTarget(t);
  }

  // Candidates in player 2's reach, in the {key, sprite, foal} shape _petTarget
  // wants. Saddled horses are skipped (mounting is a player-1 verb) and animals
  // that have nothing left to gain from a pet are filtered out, matching the
  // player-1 rule in _canPetAnimal.
  _coopNearestPettable() {
    const s = this.coop.body.sprite;
    const cands = [];
    for (const h of this.horses) {
      if (h.saddled) continue;
      if (!this._canPetAnimal(this._animalModel(h.key))) continue;
      cands.push({ key: h.key, sprite: h.sprite, x: h.sprite.x, y: h.sprite.y });
    }
    for (const a of this.animals) {
      if (!a.sprite.visible) continue; // tucked in the coop at night
      if (!this._canPetAnimal(a.model)) continue;
      cands.push({ key: a.key, sprite: a.sprite, x: a.sprite.x, y: a.sprite.y });
    }
    for (const f of this.foals) {
      cands.push({ key: f.key, sprite: f.sprite, x: f.sprite.x, y: f.sprite.y, foal: true });
    }
    return nearestWithin(cands, s.x, s.y, CARE_DIST);
  }

  // Use the armed hotbar tool from player 2's position. The tool dispatch is
  // written against `this.player`, so the cleanest reuse (rather than a bespoke
  // second copy of every tool interaction) is to stand player 2's body in as
  // "the player" for the duration of that one synchronous call.
  //
  // Known v1 limitation: while player 1 is riding or driving, useActiveTool
  // early-returns, so player 2's Use does nothing until player 1 gets off. Left
  // as-is on purpose — masking player 1's mount state would let player 2 unsaddle
  // the horse being ridden. Petting still works throughout.
  _coopUse() {
    const saved = this.player;
    this.player = { ...this.coop.body };
    try { this.useActiveTool(); }
    finally { this.player = saved; }
  }

  // ─── Second-gamepad plumbing ──────────────────────────────────────────────

  // Player 1 reads the FIRST connected pad (_pollRawPad); player 2 reads the
  // second, so two controllers on one device are two players.
  _coopPad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const raw = pads[1];
    if (!raw) return null;
    const b = raw.buttons, ax = raw.axes;
    const dz = (v) => (Math.abs(v ?? 0) > COOP_DEADZONE ? v : 0);
    return {
      leftStickX: dz(ax[0]), leftStickY: dz(ax[1]),
      btnA: b[0]?.pressed ?? false, btnB: b[1]?.pressed ?? false,
      btnX: b[2]?.pressed ?? false, btnY: b[3]?.pressed ?? false,
      btnStart: b[9]?.pressed ?? false,
    };
  }

  // Remember this frame's button state so the next frame can edge-trigger.
  _coopSyncPadEdges() {
    const pad = this._coopPad();
    this.coop.prevPad = pad
      ? { btnA: pad.btnA, btnX: pad.btnX, btnY: pad.btnY, btnStart: pad.btnStart }
      : {};
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  // A short screen-centred toast for join/leave, so it's obvious the second
  // farmer arrived (or wandered off) without opening any menu.
  _coopToast(text) {
    const cam = this.cameras.main;
    const t = this.add.text(cam.midPoint.x, cam.midPoint.y - 120, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#fffde0',
      backgroundColor: '#1c1f2edd', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({
      targets: t, y: t.y - 24, alpha: 0, delay: 900, duration: 900,
      ease: 'Quad.easeIn', onComplete: () => t.destroy(),
    });
  }
};
