import Phaser from 'phaser';
import { EVENTS } from '../data/events.js';
import { applyDpr, dprOf, logicalW, logicalH } from './uiUtils.js';
import { HOUSE_INTERIOR, PLAYER_SPEED as OUTDOOR_PLAYER_SPEED } from './paddock/constants.js';
import { savePantry } from '../data/save.js';
import { addToPantry, takeFromPantry, isPantryStorable } from '../data/pantry.js';
import { CONTENT_DEFS } from '../data/items.js';
import { WithHouseInteriorDecor } from './houseInteriorDecor.js';
import { WithHouseInteriorCooking } from './houseInteriorCooking.js';
import { WithHouseInteriorRecipeBook } from './houseInteriorRecipeBook.js';

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
//   • STOVE & OVEN (#213) — the physical cooking station: object/placement/prompt
//                       are real now; there's no recipe system yet (#41 owns
//                       that). Exposes findIngredient(content, amount), a stub
//                       that checks the pantry then the player's inventory —
//                       the shape #41 will build actual cooking on top of.
//
// FIRST-PASS DRAFT for owner playtest: the interior art (worldArt `houseInterior`) and
// this simple single-room layout are a clean first cut, expect art-direction. The
// scene-vs-cutaway choice (full scene here, cutaway for the barn) is flagged for review.

// Playtest (2026-07-06, #210) found the room felt awkwardly slow next to outdoor
// movement — match the outdoor pace exactly rather than an arbitrary indoor value.
const PLAYER_SPEED = OUTDOOR_PLAYER_SPEED;
const EXIT_COOLDOWN_MS = 400;        // ignore the doorway right after entering
const PROMPT_REACH = 70;             // world px: how close to a station to prompt

export default class HouseInteriorScene extends WithHouseInteriorRecipeBook(WithHouseInteriorCooking(WithHouseInteriorDecor(Phaser.Scene))) {
  constructor() {
    super('HouseInteriorScene');
  }

  create() {
    applyDpr(this); // centred camera (world scene), zoom = DPR

    this._customizing = false;
    this._exiting = false;
    this._enteredAt = this.time.now;

    // Cooking (#41/#214): combo-cycle index + pantry + persisted recipe book, all
    // set up together by the cooking mixin (houseInteriorCooking.js's _initCooking).
    this._initCooking();

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
    this._buildCollision();
    this._buildFishTank();
    this._buildFireplace();
    this._buildPlayer();
    this._buildInput();
    this._buildRecipeBookUI(); // #214: simple toggle-able discovered-recipes panel

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
      // Bed, dresser, pantry (#212), and the stove/oven (#213) are all actionable
      // now — the stove still has no cooking system behind it (#41).
      canAct: true,
    }));
  }

  // Solid furniture footprints (#210 playtest fix — player could walk on the bed).
  // DESIGN-GRID → room-world via the shared `_d` scale helper, like the stations.
  _buildCollision() {
    this._collisionRects = (HOUSE_INTERIOR.collision || []).map((r) => ({
      x0: this._d(r.x0), y0: this._d(r.y0), x1: this._d(r.x1), y1: this._d(r.y1),
    }));
  }

  // Player sprite origin is (0.5,1) — x,y is the feet point, so a point-in-rect test suffices.
  _collidesAt(x, y) {
    for (const r of this._collisionRects) {
      if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
    }
    return false;
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
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R); // #214 recipe book
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
    this._checkRecipeBookInput(); // #214: [R] toggles the discovered-recipes panel
    if (this.recipeBookOpen) return; // panel open — pause movement/prompts underneath
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

    // Gamepad left stick steers too (#321), mirroring paddock/playerMovement.js.
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (raw) {
      const sx = raw.axes[0] ?? 0, sy = raw.axes[1] ?? 0;
      if (Math.abs(sx) > 0.15) vx += sx;
      if (Math.abs(sy) > 0.15) vy += sy;
    }

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
    const nx = Phaser.Math.Clamp(p.sprite.x + (vx / len) * step, 12, this.roomW - 12);
    const ny = Phaser.Math.Clamp(p.sprite.y + (vy / len) * step, 24, this.roomH - 6);
    // Axis-separated furniture collision (#210) — try each axis independently so
    // the player slides along a wall/bed edge instead of stopping dead on contact.
    if (!this._collidesAt(nx, p.sprite.y)) p.sprite.x = nx;
    if (!this._collidesAt(p.sprite.x, ny)) p.sprite.y = ny;
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
    const label = st.action === 'kitchen' ? this._kitchenLabel() : st.label;
    this.prompt.setText(`${key}${label}`).setVisible(true);
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
    else if (st.action === 'kitchen') this._useKitchen();
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

  // ── Kitchen / stove & oven (#213) ───────────────────────────────────────
  // The recipe/cook/feed logic lives in the WithHouseInteriorCooking mixin
  // (houseInteriorCooking.js) — split out to stay under the scene size budget
  // (_kitchenLabel/_useKitchen and their helpers). This file keeps only the shared
  // ingredient-lookup stub + pantry accessors the cooking mixin (and #213 before it)
  // are built on.

  // The ingredient-lookup stub #213 built for #41 to build cooking on top of: resolve how many
  // of `content` are available RIGHT NOW, checking the pantry first, then falling
  // back to the player's active carrier (per #213's "either source" scoping).
  // Returns { source: 'pantry'|'inventory'|null, available }. Pure lookup — takes
  // nothing; a future recipe step would call takePantryIngredient / useActiveCarrier
  // once it actually decides to consume the ingredient.
  findIngredient(content, amount = 1) {
    const inPantry = this.pantryCount(content);
    if (inPantry >= amount) return { source: 'pantry', available: inPantry };
    const hot = this.scene.get('HotbarScene');
    const item = hot?.getActiveItem?.();
    const inInventory = item?.content === content ? (item.count ?? 0) : 0;
    if (inInventory >= amount) return { source: 'inventory', available: inInventory };
    // Neither source alone has enough — report whichever has more (still useful
    // info for a future recipe UI), sourced from pantry if it has anything at all.
    if (inPantry > 0) return { source: 'pantry', available: inPantry };
    if (inInventory > 0) return { source: 'inventory', available: inInventory };
    return { source: null, available: 0 };
  }

  // Brief on-screen confirmation, reusing the existing contextual prompt label so
  // there's no new UI surface for this simple v1 interaction.
  _flashPromptMessage(text) {
    this.prompt.setText(text).setVisible(true);
    this.time.delayedCall(1200, () => {
      if (this.prompt.text === text) this.prompt.setVisible(false);
    });
  }

  // Full-app fade-to-black graphic (#210 playtest fix: the old fade only covered the
  // logical viewport rect at (0,0)-(sw,sh), but this scene's camera keeps a CENTRED
  // origin (required for startFollow) — at DPR>1 (e.g. the owner's iPad, DPR 2) a
  // scrollFactor-0 rect drawn there is zoomed about the viewport centre and no longer
  // lines up with the physical screen edges, leaving a sliver of the room visible
  // during the fade. Rather than hand-deriving the exact centred-zoom offset, draw a
  // generously oversized rect centred on the viewport — comfortably covers the whole
  // physical screen at any DPR without depending on that math being exactly right.
  _buildFullScreenFade() {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(2000);
    const sw = logicalW(this), sh = logicalH(this);
    const pad = Math.max(sw, sh) * 2; // generous margin either side
    return {
      draw: (alpha) => {
        gfx.clear();
        gfx.fillStyle(0x000000, alpha);
        gfx.fillRect(-pad, -pad, sw + pad * 2, sh + pad * 2);
      },
      destroy: () => gfx.destroy(),
    };
  }

  // Bed → sleep. The interior fade is owned by DayNightScene (same EVENTS.SLEEP the
  // world used); we just freeze ourselves for the beat, then resume. DayNightScene is
  // paused while we're up, so we run a tiny local fade here so sleeping still reads.
  _doSleep() {
    if (this._sleeping) return;
    this._sleeping = true;
    this.prompt.setVisible(false);
    const fade = this._buildFullScreenFade();
    const a = { v: 0 };
    const draw = () => fade.draw(a.v);
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
    const fade = this._buildFullScreenFade();
    const a = { v: 0 };
    const draw = () => fade.draw(a.v);
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
