import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { applyDpr, dprOf, logicalW, logicalH } from './uiUtils.js';
import { HOUSE_INTERIOR } from './paddock/constants.js';
import { loadPantry, savePantry } from '../data/save.js';
import { addToPantry, takeFromPantry, isPantryStorable } from '../data/pantry.js';
import { CONTENT_DEFS } from '../data/items.js';

// The enterable house interior (#56) — a small standalone room scene the player
// walks INTO from the paddock's house door, does home-base things in, and walks
// back OUT of. It's a full scene (not the barn's in-world cutaway, #35): entering
// pauses PaddockScene/HotbarScene and starts this on top; walking onto the south
// doorway exits back to the world. See scenes/paddock/houseEntry.js for the wiring.
//
// v1 stations (data-driven off HOUSE_INTERIOR.stations in paddock/constants.js):
//   • BED (#210)     — interact to sleep until morning (same EVENTS.SLEEP the world
//                       used; the bed now REPLACES the outdoor "sleep at the house").
//   • DRESSER/MIRROR (#211) — opens the EXISTING PlayerCustomizerScene (reused, not
//                       rebuilt); we pause here while it's up, resume on its close.
//   • PANTRY (#212)  — a NEW, separate indoor storage pool (keyed quantity map,
//                       own localStorage key) for food/crops/animal products,
//                       distinct from the farm-stand stock and carried inventory.
//                       v1 interaction: deposit the active carrier's whole load.
//   • KITCHEN (#41)  — the cooking surface is PLACED but inert (a passive hint prompt);
//                       the cooking system is a future issue.
//
// FIRST-PASS DRAFT for owner playtest: the interior art (worldArt `houseInterior`) and
// this simple single-room layout are a clean first cut, expect art-direction. The
// scene-vs-cutaway choice (full scene here, cutaway for the barn) is flagged for review.

const PLAYER_SPEED = 150;            // a touch slower than the field — it's a small room
const EXIT_COOLDOWN_MS = 400;        // ignore the doorway right after entering
const PROMPT_REACH = 70;             // world px: how close to a station to prompt

export default class HouseInteriorScene extends Phaser.Scene {
  constructor() {
    super('HouseInteriorScene');
  }

  create() {
    applyDpr(this); // centred camera (world scene), zoom = DPR

    this._customizing = false;
    this._exiting = false;
    this._enteredAt = this.time.now;

    // Pantry storage (#212): a separate stockpile from the farm-stand stock and
    // carried carrier inventory. Loaded fresh each time the house is entered
    // (small enough to just re-read from localStorage; no need to keep it live
    // in the registry while outside).
    this.pantry = loadPantry();

    const HI = HOUSE_INTERIOR;
    const sc = HI.scale;
    this.roomW = HI.dw * sc;
    this.roomH = HI.dh * sc;
    // Design-grid → room-world helpers (room origin at 0,0, top-left).
    this._d = (n) => n * sc;

    // Backdrop behind the room so any letterboxing reads as cozy dark, not raw canvas.
    this.cameras.main.setBackgroundColor('#2a2018');

    // The room floor plan, laid down at (0,0). Everything else sits on top by depth.
    this.add.image(0, 0, 'houseInterior').setOrigin(0, 0).setScale(sc).setDepth(-100);

    // Soft interior vignette / warm lamp glow — a big low-alpha radial-ish wash so the
    // room feels lit from within (cheap: a couple of translucent rects, canvas-safe).
    const glow = this.add.graphics().setDepth(-90);
    glow.fillStyle(0xffe6b0, 0.06); glow.fillRect(0, 0, this.roomW, this.roomH);
    glow.fillStyle(0x000000, 0.10);
    glow.fillRect(0, 0, this.roomW, 8 * sc);                      // top edge shade
    glow.fillRect(0, this.roomH - 6 * sc, this.roomW, 6 * sc);    // bottom edge shade

    this._buildStations();
    this._buildPlayer();
    this._buildInput();

    // Prompt label — screen-fixed, bottom-centre, like a contextual hint.
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px', fontStyle: 'bold',
      color: '#ffffff', backgroundColor: '#000000bf',
      padding: { x: 12, y: 7 }, align: 'center',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000).setVisible(false);

    // A little "◀ Doorway — walk out to leave" hint near the exit strip.
    this.exitHint = this.add.text(this._d(HI.exit.x), this._d(HI.exit.y - 6), 'Doorway ▾', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      color: '#f0e0c0', backgroundColor: '#00000080', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setDepth(900);

    this._layoutFixed();
    this.scale.on('resize', this._layoutFixed, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._layoutFixed, this);
    });
  }

  // ── Stations (bed / dresser / kitchen), data-driven off HOUSE_INTERIOR ──────
  _buildStations() {
    const HI = HOUSE_INTERIOR;
    this.stations = Object.entries(HI.stations).map(([id, s]) => ({
      id,
      x: this._d(s.x), y: this._d(s.y),
      standX: this._d(s.standX), standY: this._d(s.standY),
      label: s.label, action: s.action,
      // Bed, dresser, and pantry (#212) are actionable; the kitchen is a passive
      // placeholder until #213.
      canAct: s.action !== 'kitchen',
    }));
  }

  _buildPlayer() {
    const makeAnim = (key, frames, rate) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames, frameRate: rate, repeat: -1 });
    };
    makeAnim('player_walk_down', [
      { key: 'player_down_0' }, { key: 'player_down_1' },
      { key: 'player_down_2' }, { key: 'player_down_3' },
    ], 8);
    makeAnim('player_walk_up', [
      { key: 'player_up_0' }, { key: 'player_up_1' },
      { key: 'player_up_2' }, { key: 'player_up_3' },
    ], 8);
    makeAnim('player_walk_side', [
      { key: 'player_side_0' }, { key: 'player_side_1' },
      { key: 'player_side_2' }, { key: 'player_side_3' },
    ], 8);

    const sx = this._d(HOUSE_INTERIOR.spawn.x);
    const sy = this._d(HOUSE_INTERIOR.spawn.y);
    const shadow = this.add.image(sx, sy, 'shadow').setScale(2).setDepth(sy - 1);
    const sprite = this.add.sprite(sx, sy, 'player_up_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(sy);
    this.player = { sprite, shadow, facing: 'up' };

    this.cameras.main.setBounds(0, 0, this.roomW, this.roomH);
    this.cameras.main.startFollow(sprite, true, 0.15, 0.15);
  }

  _buildInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Tap-to-walk: tap a spot (or a station) to walk there; a station tap acts on arrival.
    this.input.on('pointerdown', this._onTap, this);
  }

  // Convert a raw pointer (physical/buffer px) to this scene's world coords.
  _pointerWorld(pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  _onTap(pointer) {
    if (this._customizing || this._exiting) return;
    const w = this._pointerWorld(pointer);
    // Tapping near a station walks to it and activates on arrival.
    const st = this._nearestStation(w.x, w.y, 90);
    if (st && st.canAct) {
      this._walkTo(st.standX, st.standY, () => this._activate(st));
      return;
    }
    this._walkTo(w.x, w.y, null);
  }

  _walkTo(x, y, onArrive) {
    this._navTarget = {
      x: Phaser.Math.Clamp(x, 12, this.roomW - 12),
      y: Phaser.Math.Clamp(y, 24, this.roomH - 6),
      onArrive,
    };
  }

  _nearestStation(x, y, radius) {
    let best = null, bestD = Infinity;
    for (const st of this.stations) {
      const d = Phaser.Math.Distance.Between(x, y, st.x, st.y);
      if (d <= radius && d < bestD) { bestD = d; best = st; }
    }
    return best;
  }

  update(_time, delta) {
    if (this._customizing || this._exiting) return;
    this._move(delta);
    this._checkExit();
    this._checkStationPrompt();
  }

  _move(delta) {
    const p = this.player;
    let vx = 0, vy = 0;
    const c = this.cursors, k = this.wasd;
    if (c.left.isDown || k.left.isDown) vx -= 1;
    if (c.right.isDown || k.right.isDown) vx += 1;
    if (c.up.isDown || k.up.isDown) vy -= 1;
    if (c.down.isDown || k.down.isDown) vy += 1;

    const manual = vx !== 0 || vy !== 0;
    if (manual) this._navTarget = null; // keyboard cancels tap-nav

    if (!manual && this._navTarget) {
      const dx = this._navTarget.x - p.sprite.x;
      const dy = this._navTarget.y - p.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        const cb = this._navTarget.onArrive;
        this._navTarget = null;
        this._setMoving(false);
        if (cb) cb();
        return;
      }
      vx = dx / dist; vy = dy / dist;
    }

    if (vx === 0 && vy === 0) { this._setMoving(false); return; }
    const len = Math.hypot(vx, vy) || 1;
    const step = PLAYER_SPEED * (delta / 1000);
    p.sprite.x = Phaser.Math.Clamp(p.sprite.x + (vx / len) * step, 12, this.roomW - 12);
    p.sprite.y = Phaser.Math.Clamp(p.sprite.y + (vy / len) * step, 24, this.roomH - 6);
    p.sprite.setDepth(p.sprite.y);
    p.shadow.setPosition(p.sprite.x, p.sprite.y).setDepth(p.sprite.y - 1);

    // Facing + walk animation.
    let facing = p.facing;
    if (Math.abs(vx) > Math.abs(vy)) { facing = 'side'; p.sprite.setFlipX(vx < 0); }
    else facing = vy < 0 ? 'up' : 'down';
    const animKey = facing === 'up' ? 'player_walk_up'
      : facing === 'down' ? 'player_walk_down' : 'player_walk_side';
    p.facing = facing;
    p.sprite.play(animKey, true);
    p._moving = true;
  }

  _setMoving(moving) {
    const p = this.player;
    if (moving || !p._moving) return;
    p._moving = false;
    p.sprite.stop();
    const idle = p.facing === 'up' ? 'player_up_0'
      : p.facing === 'down' ? 'player_down_0' : 'player_side_0';
    p.sprite.setTexture(idle);
  }

  // Walking onto the south doorway strip leaves the house (once past the entry grace).
  _checkExit() {
    if (this.time.now - this._enteredAt < EXIT_COOLDOWN_MS) return;
    const HI = HOUSE_INTERIOR;
    const ex = this._d(HI.exit.x), halfW = this._d(HI.exit.w) / 2;
    const p = this.player.sprite;
    if (Math.abs(p.x - ex) < halfW && p.y > this.roomH - this._d(6)) {
      this._exit();
    }
  }

  _checkStationPrompt() {
    const p = this.player.sprite;
    const st = this._nearestStation(p.x, p.y, PROMPT_REACH);
    if (!st) { this.prompt.setVisible(false); this._proxStation = null; return; }
    this._proxStation = st;
    const key = st.canAct ? '[E] ' : '';
    this.prompt.setText(`${key}${st.label}`).setVisible(true);
    // Keyboard interact.
    if (st.canAct && (Phaser.Input.Keyboard.JustDown(this.eKey) ||
                      Phaser.Input.Keyboard.JustDown(this.spaceKey))) {
      this._activate(st);
    }
  }

  _activate(st) {
    if (st.action === 'sleep') this._doSleep();
    else if (st.action === 'customize') this._openCustomizer();
    else if (st.action === 'pantry') this._usePantry();
    // kitchen: inert placeholder (#41 future via #213) — no-op.
  }

  // ── Pantry (#212) ────────────────────────────────────────────────────────
  // v1 interaction: deposit the ACTIVE carrier's whole load into the pantry's
  // storage pool (a keyed quantity map, separate from the farm-stand stock and
  // the carrier itself). Simple "stock the pantry" — matches the scoped issue's
  // v1 ask (cooking, #41, isn't built yet so there's no reason for a fussier UI).
  // Non-storable / empty carriers show a brief "nothing to stock" hint instead.
  _usePantry() {
    const hot = this.scene.get('HotbarScene');
    const item = hot?.getActiveItem?.();
    const content = item?.content;
    const count = item?.count ?? 0;
    if (!content || count <= 0 || !isPantryStorable(content)) {
      this._flashPromptMessage('Nothing to stock');
      return;
    }
    const label = CONTENT_DEFS[content]?.label ?? content;
    this.pantry = addToPantry(this.pantry, content, count);
    savePantry(this.pantry);
    hot.useActiveCarrier?.(count); // empty the carrier — its load moved into the pantry
    this._flashPromptMessage(`Stocked ${count} ${label} in the pantry`);
  }

  // Read-only lookup other systems (the stove, #213) can call: how much of a
  // content the pantry currently holds.
  pantryCount(content) {
    return this.pantry?.[content] ?? 0;
  }

  // Take up to `amount` of `content` out of the pantry, persisting the change.
  // Returns how many were actually taken (0 if none in stock). Exposed for the
  // stove's ingredient-lookup stub (#213) and any future cooking system (#41).
  takePantryIngredient(content, amount = 1) {
    const { pantry, taken } = takeFromPantry(this.pantry, content, amount);
    if (taken > 0) { this.pantry = pantry; savePantry(this.pantry); }
    return taken;
  }

  // Brief on-screen confirmation, reusing the existing contextual prompt label so
  // there's no new UI surface for this simple v1 interaction.
  _flashPromptMessage(text) {
    this.prompt.setText(text).setVisible(true);
    this.time.delayedCall(1200, () => {
      if (this.prompt.text === text) this.prompt.setVisible(false);
    });
  }

  // Bed → sleep. The interior fade is owned by DayNightScene (same EVENTS.SLEEP the
  // world used); we just freeze ourselves for the beat, then resume. DayNightScene is
  // paused while we're up, so we run a tiny local fade here so sleeping still reads.
  _doSleep() {
    if (this._sleeping) return;
    this._sleeping = true;
    this.prompt.setVisible(false);
    const fade = this.add.graphics().setScrollFactor(0).setDepth(2000);
    const a = { v: 0 };
    const sw = logicalW(this), sh = logicalH(this);
    const draw = () => { fade.clear(); fade.fillStyle(0x000000, a.v); fade.fillRect(0, 0, sw, sh); };
    this.tweens.add({
      targets: a, v: 1, duration: 600, ease: 'Sine.easeIn', onUpdate: draw,
      onComplete: () => {
        // Advance the (paused) day/night clock to morning via the global sleep event;
        // DayNightScene.doSleep resets its clock even while paused-then-resumed.
        this.game.events.emit(EVENTS.SLEEP);
        this.time.delayedCall(400, () => {
          this.tweens.add({
            targets: a, v: 0, duration: 700, ease: 'Sine.easeOut', onUpdate: draw,
            onComplete: () => { fade.destroy(); this._sleeping = false; },
          });
        });
      },
    });
  }

  // Dresser/mirror → the EXISTING player customizer (#211/#44). We don't pause this
  // scene (the customizer's shell only pauses/hides scenes it finds ACTIVE — the
  // paddock is already paused, so it's a no-op there). Instead we gate our own update/
  // input via _customizing and hide the room while the editor is up, then restore when
  // the customizer scene shuts down (it stops itself on Done/Esc/B). The editor draws
  // its own full-screen backdrop above us, so nothing of the room bleeds through.
  _openCustomizer() {
    if (this._customizing) return;
    this._customizing = true;
    this.prompt.setVisible(false);
    this.exitHint.setVisible(false);
    this._setMoving(false);
    this.scene.launch('PlayerCustomizerScene');
    this.scene.bringToTop('PlayerCustomizerScene');
    const cust = this.scene.get('PlayerCustomizerScene');
    cust.events.once(Phaser.Scenes.Events.SHUTDOWN, this._onCustomizerClosed, this);
  }

  _onCustomizerClosed() {
    this._customizing = false;
    this.exitHint.setVisible(true);
    // The player's look may have changed — the customizer rebuilt the player_* textures
    // in place, so our sprite already reflects it. Re-assert our layer order.
    this.scene.bringToTop();
  }

  _exit() {
    if (this._exiting) return;
    this._exiting = true;
    this.prompt.setVisible(false);
    const fade = this.add.graphics().setScrollFactor(0).setDepth(2000);
    const a = { v: 0 };
    const sw = logicalW(this), sh = logicalH(this);
    const draw = () => { fade.clear(); fade.fillStyle(0x000000, a.v); fade.fillRect(0, 0, sw, sh); };
    this.tweens.add({
      targets: a, v: 1, duration: 260, ease: 'Sine.easeIn', onUpdate: draw,
      onComplete: () => {
        this.game.events.emit(EVENTS.EXIT_HOUSE);
        this.scene.stop();
      },
    });
  }

  // ── Screen-fixed layout ─────────────────────────────────────────────────────
  _layoutFixed() {
    const sw = logicalW(this), sh = logicalH(this);
    // Centred-camera scrollFactor-0 overlays need the DPR offset (see uiUtils). Anchor
    // the contextual prompt at logical bottom-centre.
    const k = (dprOf(this) - 1) / 2;
    this.prompt?.setPosition(sw / 2 + sw * k, sh - 24 + sh * k);
  }
}
