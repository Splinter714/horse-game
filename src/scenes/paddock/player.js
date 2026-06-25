// Player: build, input (tap/hold/keyboard/gamepad), pathfinding/navigation, and
// world interactables + gathering. Applied as a functional mixin.

import Phaser from 'phaser';
import { CONTENT_DEFS, foodDemand } from '../../data/items.js';
import { EVENTS } from '../../data/events.js';
import { playGather } from '../../audio/sounds.js';
import { WORLD_W, WORLD_H, CARE_DIST, PLAYER_SPEED, HOLD_MS, HOLD_DRAG_PX, PLAYER_BOUNDS, PASTURE_BOUNDS, S, STAND_DEFS, TROUGH_CAP } from './constants.js';
import { loadDevSettings } from '../../data/save.js';
import { dprOf, logicalH, worldUiOffset } from '../uiUtils.js';

// In-place reach for using a tool on a horse (brush/saddle/lead). Use never
// walks you anywhere — the horse has to already be within this range.
const USE_REACH = 110;

// Named boot-spawn points for the "Start at" dev tool (pause menu). Each is a
// walkable spot next to that landmark; an unset/unknown pick falls back to Barn.
const START_SPAWNS = {
  Barn:         { x: 300,  y: 420 },  // default: in front of the barn (NW)
  Pasture:      { x: 960,  y: 1180 }, // middle of the paddock, among the horses
  Gate:         { x: 960,  y: 850 },  // just NORTH of the pasture gate (farm-yard side)
  'Farm stand': { x: 1600, y: 840 },  // at the farm-stand counter (E edge)
  Coop:         { x: 900,  y: 470 },  // by the chicken coop + nests
};

export const WithPlayer = (Base) => class extends Base {
  // ─── Player ──────────────────────────────────────────────────────────────

  buildPlayer() {
    const makeAnim = (key, frames, rate) => {
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames, frameRate: rate, repeat: -1 });
      }
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

    // Start in front of the barn (NW corner) so there's a walk-up approach down
    // to the pasture gate at (960, 910) rather than spawning right on top of it.
    // The "Start at" dev tool (pause menu) can override the boot spawn to another
    // landmark for quicker testing; an unset pick uses the barn default.
    const spawn = START_SPAWNS[loadDevSettings().startLocation] || START_SPAWNS.Barn;
    const startX = spawn.x;
    const startY = spawn.y;

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, 'player_down_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(startY);

    this.player    = { sprite, shadow, facing: 'down', moving: false };
    // Tap-to-move walks the player along navPath, sliding against obstacles each
    // frame (so the gate/fence can't be walked through). navOnArrive fires once
    // the last waypoint is reached.
    this.navPath     = null;
    this.navOnArrive = null;
    this._navStuck   = 0;

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(sprite, true, 0.12, 0.12);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    // F = use the currently-armed hotbar tool (interact stays on tap/click/E).
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.fKey.on('down', () => { this._useKeyboard(); this.useActiveTool(); });
    // C = open the info panel for the animal in reach. Interact (E) always pets
    // now (#79), so info is its own key (gamepad Y / double-tap on touch).
    this.cKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.cKey.on('down', () => { this._useKeyboard(); this.openProxInfo(); });

    this.input.on('pointerdown', this.handleTap, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    // Hold-to-move state: while the pointer is held, movement keeps re-targeting
    // the live pointer position so you steer continuously instead of re-tapping.
    this._pointerDown    = false;
    this._holdMove       = false;
    this._holdTarget     = null;
    this._holdPathTarget = null;
    this._holdDownAt     = 0;
    this._holdDownX      = 0;
    this._holdDownY      = 0;
    this._holdMoved      = false;
    this._holdRepathAt   = 0;

    this.gamePad      = null;
    this.usingPad     = false;
    // Last input was touch → prompts drop key glyphs and the on-screen Use button
    // shows (#101). Default from the device's primary pointer so phones start in
    // touch mode (and show the Use button) before the first tap; "last input wins"
    // refines it after (a keypress/stick flips it to key/pad).
    this.usingTouch   = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    this.padAJustDown = false;
    this._prevRawButtons = {};
    this._paused = false;
    this._pauseOverlay = null;

    this.input.gamepad.on('connected', pad => { this.gamePad = pad; });
    if (this.input.gamepad.total > 0) this.gamePad = this.input.gamepad.getPad(0);

    // Contextual control prompts live in one fixed on-screen panel (#101) — a
    // Minecraft-style list, bottom-left, of every action currently possible with
    // its key/button (or a touch hint). Decoupling it from any single world
    // position means two actions that target two different animals (Pet vs.
    // Info, #96/#97) each read clearly and name their own target. Screen-pinned
    // (scrollFactor 0); _renderPrompts fills/positions it each frame from the
    // per-frame _promptLines the proximity passes accumulate.
    this.promptPanel = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px', color: '#ffffff',
      backgroundColor: '#1c1f2eea',
      padding: { x: 11, y: 8 },
      lineSpacing: 5, align: 'left',
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(9999).setVisible(false);
    this._promptLines = [];

    // Lead rope drawn each frame when leading a horse
    this.leadRope = this.add.graphics().setDepth(9998);

  }

  // ─── World interactables (primary-action targets) ─────────────────────────
  //
  // Every static prop you activate with the primary action — by walking up and
  // pressing the use key, or by tapping/clicking it — lives here. Both input
  // paths (handleTap and checkProximity) share this one list, so adding a new
  // activatable object is a single descriptor instead of two parallel blocks.
  //
  // A descriptor is a function instances(item) returning zero or more
  // activatable instances for the currently held item/context. Each instance is
  // fully self-describing:
  //   { x, y, tapRadius, reachDist, promptOffsetY, canAct, label,
  //     approach(world), activate() }
  // Singletons return a one-element array; collections (sources, nests) return
  // one entry per instance. canAct:false still shows a passive hint prompt
  // (e.g. "carrier full", "equip a Basket") but can't be triggered.
  buildInteractables() {
    const gate = () => {
      const g = this.props.gate;
      if (!g) return [];
      return [{
        x: g.x, y: g.y, tapRadius: 90, reachDist: 100, promptOffsetY: 80,
        canAct: true, label: `${g.open ? 'Close' : 'Open'} Gate`,
        approach: () => ({ x: g.x, y: g.y + (this.player.sprite.y < g.y ? -70 : 70) }),
        activate: () => this.toggleGate(),
      }];
    };

    const barn = () => {
      const b = this.props.barn;
      if (!b) return [];
      return [{
        x: b.x, y: b.y, tapRadius: 130, reachDist: 150, promptOffsetY: 40,
        canAct: true, label: 'Sleep',
        approach: () => ({ x: b.x, y: b.y + 95 }), // walk to just below the barn
        activate: () => this.sleep(),
      }];
    };

    const trough = (item) => {
      const t = this.props.trough;
      // Offer "Fill Trough" until it's brim-full, so you can pour bucket after
      // bucket to top it up (#103) — not just when it's bone dry.
      if (!t || t.level >= TROUGH_CAP || item?.content !== 'water') return [];
      return [{
        x: t.x, y: t.y, tapRadius: 200, reachDist: 145, promptOffsetY: 40,
        canAct: true, label: 'Fill Trough',
        // Walk to the side the player is on: the well side (just north of the
        // fence) to fill over it, or just inside the pasture from the south (#106).
        approach: (world) => {
          const refY = world ? world.y : this.player.sprite.y;
          const onWellSide = refY < t.y;
          return { x: t.x, y: onWellSide ? PASTURE_BOUNDS.minY - 34 : t.y + 56 };
        },
        activate: () => this.fillTrough(),
      }];
    };

    const sources = (item) => {
      if (!item || item.type !== 'carrier') return [];
      return this.props.sources
        .filter(s => item.accepts.includes(s.content))
        .map(s => {
          // Food gathers one unit per animal that eats it (#136); other contents
          // (water) just fill to capacity. `target` is what a full gather lands on.
          const target = this._gatherTarget(s.content, item.capacity);
          const have   = item.content === s.content ? item.count : 0;
          const full   = have >= target;
          const fullMsg = have >= item.capacity ? 'carrier full' : 'enough gathered';
          return {
            x: s.x, y: s.y, tapRadius: 120, reachDist: s.reach, promptOffsetY: 80,
            canAct: !full,
            label: full ? `${s.label}  •  ${fullMsg}`
                        : `Gather ${CONTENT_DEFS[s.content].label}`,
            approach: (world) => {
              const refX = world ? world.x : this.player.sprite.x;
              return { x: s.x + (refX < s.x ? -1 : 1) * 70, y: s.y + 10 };
            },
            activate: () => this.gatherFrom(s),
          };
        });
    };

    const nests = (item) => {
      const hasBasket = item?.carrier === 'basket';
      return this.props.nests
        .filter(n => n.hasEgg)
        .map(n => ({
          x: n.x, y: n.y, tapRadius: 100, reachDist: 80, promptOffsetY: 30,
          canAct: hasBasket,
          label: hasBasket ? 'Collect Egg' : 'Egg in nest  •  equip a Basket to collect',
          approach: () => ({ x: n.x, y: n.y + 45 }),
          activate: () => this.collectEgg(n),
        }));
    };

    const farmStand = (item) => {
      const s = this.farmStand;
      const type = item?.content;
      const sellable = s && STAND_DEFS[type] && item.count > 0;
      if (!sellable) return []; // stock is shown visually; only prompt to deposit
      return [{
        x: s.x, y: s.y, tapRadius: 160, reachDist: 120, promptOffsetY: 100,
        canAct: true, label: `Sell ${CONTENT_DEFS[type].label}  (basket: ${item.count})`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: s.x + (refX < s.x ? -1 : 1) * 90, y: s.y + 20 };
        },
        activate: () => this.stockStand(),
      }];
    };

    this.interactables = [gate, barn, trough, sources, nests, farmStand];
    // Split by input: gate/barn are bare-hand "interact" targets (tap/click/E);
    // the rest require a carried tool/carrier and are triggered by Use (the
    // on-screen button / F / controller). See useActiveTool + handleTap.
    this.interactWorld = [gate, barn];
    this.toolWorld     = [trough, sources, nests, farmStand];
  }

  // Nearest activatable instance to (x, y) within each instance's own radius
  // (tapRadius for taps, reachDist for the keyboard), searching the given list of
  // interactable descriptors (defaults to all).
  _nearestInteractable(x, y, item, radiusKey, list = this.interactables) {
    let best = null, bestDist = Infinity;
    for (const instancesOf of list) {
      for (const inst of instancesOf(item)) {
        const d = Phaser.Math.Distance.Between(x, y, inst.x, inst.y);
        if (d <= inst[radiusKey] && d < bestDist) { bestDist = d; best = inst; }
      }
    }
    return best;
  }

  // Tap landed on a world interactable? Walk to it and activate on arrival.
  _tapInteractable(world, item) {
    const inst = this._nearestInteractable(world.x, world.y, item, 'tapRadius', this.interactWorld);
    if (!inst || !inst.canAct) return false;
    const dest = inst.approach(world);
    this.tapMoveTo(dest.x, dest.y, () => inst.activate());
    return true;
  }

  // Player standing next to a world interactable? Queue its prompt; activate on
  // key press. Non-actionable instances show a passive hint (no key prefix).
  _proximityInteractable(item, useJust) {
    const inst = this._nearestInteractable(this.player.sprite.x, this.player.sprite.y, item, 'reachDist', this.interactWorld);
    if (!inst) return false;
    this._pushPrompt(inst.canAct ? 'interact' : null, inst.label);
    if (inst.canAct) this._interactAction = { label: inst.label, run: () => inst.activate() };
    if (useJust && inst.canAct) inst.activate();
    return true;
  }

  // ─── Static control-prompt panel (#101) ───────────────────────────────────

  // Which input the player is currently using, for prompt formatting.
  _promptMode() {
    if (this.usingPad)   return 'pad';
    if (this.usingTouch) return 'touch';
    return 'key';
  }

  // A physical keyboard action (move / E / C / F) puts prompts in keyboard mode.
  _useKeyboard() { this.usingPad = false; this.usingTouch = false; }

  // The key/button glyph for an action in the current mode. Touch has no
  // physical keys (you tap the world / the on-screen Use button), so the touch
  // hint is carried by _promptLine's verb instead and this returns ''.
  _glyph(action) {
    if (this._promptMode() === 'touch') return '';
    const pad = this.usingPad;
    switch (action) {
      case 'interact': return pad ? '[ A ]' : '[ E ]';
      case 'info':     return pad ? '[ Y ]' : '[ C ]';
      case 'use':      return pad ? '[ X ]' : '[ F ]';
      default:         return '';
    }
  }

  // Compose one prompt line. `action` null = a passive hint (no control glyph).
  // On touch, a leading verb ("Tap:", "Use:") stands in for the missing glyph.
  _promptLine(action, label) {
    if (!action) return label;
    if (this._promptMode() === 'touch') {
      const verb = { interact: 'Tap:', info: 'Double-tap:', use: 'Use:' }[action];
      return verb ? `${verb}  ${label}` : label;
    }
    return `${this._glyph(action)}  ${label}`;
  }

  _pushPrompt(action, label) {
    (this._promptLines ??= []).push(this._promptLine(action, label));
  }

  // Draw the accumulated lines into the fixed bottom-left panel (or hide it). On
  // touch the panel is replaced entirely by the on-screen action buttons (#101),
  // so it's hidden there; keyboard/gamepad keep it. Called once per frame after
  // the interact + tool proximity passes have queued their lines.
  _renderPrompts() {
    const panel = this.promptPanel;
    if (!panel) return;
    const lines = this._promptLines ?? [];
    if (this._promptMode() === 'touch' || !this.promptsOn || !lines.length) {
      panel.setVisible(false);
      return;
    }
    panel.setText(lines.join('\n'));
    // Screen-fixed overlay on the centred-origin world camera — offset to compensate.
    const o = worldUiOffset(this);
    panel.setPosition(12 + o.x, logicalH(this) - 84 + o.y).setVisible(true);
  }

  // Build the {interact, info, use} action set and broadcast it when it changes,
  // so HotbarScene can show/label the on-screen touch buttons (#101). Runs every
  // frame after the proximity passes have set _interactAction / _infoAction /
  // _useActionLabel. Emits in all modes (cheap, change-gated); the buttons only
  // render in touch mode.
  _syncActionButtons() {
    const actions = {
      interact: this._interactAction?.label ?? null,
      info:     this._infoAction?.label ?? null,
      use:      this._useActionLabel ?? null,
    };
    const sig = `${actions.interact}|${actions.info}|${actions.use}`;
    if (sig !== this._lastActionsSig) {
      this._lastActionsSig = sig;
      this.game.events.emit(EVENTS.ACTIONS_CHANGED, actions);
    }
  }

  // Invoked by the on-screen Interact / Info buttons (touch). Each runs whatever
  // the current contextual action is (pet/mount/gate/sleep/dismount, or info).
  triggerInteract() {
    if (this._paused || this._sleeping) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    this._interactAction?.run?.();
  }

  triggerInfo() {
    if (this._paused || this._sleeping) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    this._infoAction?.run?.();
  }

  // True when this tap is a quick second tap on the same animal — used so a
  // single tap pets and a double-tap opens info (#79; the touch equivalent of
  // the C key / gamepad Y).
  _isDoubleTap(key) {
    const now = this.time.now;
    const isDouble = this._lastTapKey === key && (now - (this._lastTapAt ?? 0)) < 320;
    this._lastTapKey = key;
    this._lastTapAt  = now;
    return isDouble;
  }

  handleTap(pointer) {
    if (this.scene.isActive('InfoPanelScene')) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    if (pointer.button !== 0) return;

    // This tap sets the input mode for prompt formatting (#101): a touch drops
    // key glyphs; a mouse click implies a desktop keyboard, so it reads as 'key'.
    this.usingTouch = !!pointer.wasTouch;
    this.usingPad   = false;

    // Pointer coords are in physical (buffer) px under HiDPI; UI rects are logical,
    // so convert before any screen-space hit-test (a no-op at DPR 1).
    const dpr = dprOf(this);
    const lpx = pointer.x / dpr, lpy = pointer.y / dpr;
    // Ignore taps in the badge area at the bottom of the canvas
    if (lpy > logicalH(this) - 72) return;
    // Taps on an on-screen action button are handled by that button — don't also
    // start a walk toward where it sits on screen (#101).
    if (this.scene.get('HotbarScene')?.isPointerOnActionButton?.(lpx, lpy)) return;
    // Likewise, a tap that picks from an open carrier fly-out shouldn't also move
    // the player toward it (#75).
    if (this.scene.get('HotbarScene')?.isPointerOnFlyout?.(lpx, lpy)) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Track the press so hold-to-move and tap-vs-hold release can be detected.
    this._pointerDown = true;
    this._holdDownAt  = this.time.now;
    this._holdDownX   = pointer.x;
    this._holdDownY   = pointer.y;
    this._holdMoved   = false;
    this._holdMove    = false;

    // While mounted: tapping on the horse dismounts; tapping elsewhere steers it
    // there (and holding keeps it heading toward your finger).
    if (this.riding) {
      const hs = this.riding.h.sprite;
      if (Phaser.Math.Distance.Between(world.x, world.y, hs.x, hs.y) < 64) {
        this.dismount();
        return;
      }
      this._startHold(world.x, world.y);
      return;
    }

    const item  = this.getActiveItem();

    // Tapping an animal is always an interact (never a tool use — tools go
    // through the Use button / F / controller). A single tap pets/loves; a quick
    // double-tap on the same animal opens its info panel (#79). Saddled horses
    // mount instead.
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(world.x, world.y, h.sprite.x, h.sprite.y);
      if (d < 80) {
        const wantInfo = !h.saddled && this._isDoubleTap(h.key);
        const tx = h.sprite.x + (world.x < h.sprite.x ? -70 : 70);
        this.tapMoveTo(tx, h.sprite.y, () => {
          if (h.saddled)       this.mountHorse(h);
          else if (wantInfo)   this.openPortrait(h.key);
          else                 this.petAnimal(h.key, h.sprite);
        });
        return;
      }
    }

    for (const a of this.animals) {
      if (!a.sprite.visible) continue; // tucked inside the coop at night
      const d = Phaser.Math.Distance.Between(world.x, world.y, a.sprite.x, a.sprite.y);
      if (d < 60) {
        const wantInfo = this._isDoubleTap(a.key);
        const tx = a.sprite.x + (world.x < a.sprite.x ? -40 : 40);
        this.tapMoveTo(tx, a.sprite.y, () => {
          if (wantInfo) this.openCreatureInfo(a);
          else          this.petAnimal(a.key, a.sprite);
        });
        return;
      }
    }

    // Bare-hand world interactables — gate, barn (tool-based ones like the
    // trough/nests/stand are triggered by Use instead).
    if (this._tapInteractable(world, item)) return;

    // Plain locomotion — start a hold-capable move toward the point.
    this._startHold(world.x, world.y);
  }

  // Use the currently-armed hotbar tool on the most appropriate nearby target.
  // Interact (pet/info/mount, gate/barn) stays on tap/click/E — this is only for
  // Nearest in-reach world-spot action for the equipped item — a gathering source,
  // the trough, a nest, or the farm stand — or null if none is within reach. Shared
  // by useActiveTool (to dispatch) and checkToolProximity (to label) so the prompt
  // and the action always agree (#133).
  _nearestUseSpot(item) {
    let inst = null, instD = Infinity;
    for (const instancesOf of this.toolWorld) {
      for (const c of instancesOf(item)) {
        if (!c.canAct) continue;
        const dd = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, c.x, c.y);
        if (dd < instD) { instD = dd; inst = c; }
      }
    }
    return inst && instD <= inst.reachDist ? inst : null;
  }

  // The cow in this.animals nearest the player and within Use reach, or null. Used
  // for direct cow care (#cow). Skips the cow while she's tucked away (invisible).
  _nearestCowInReach() {
    let best = null, bestD = Infinity;
    for (const a of this.animals) {
      if (a.model?.species !== 'cow' || !a.sprite.visible) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, a.sprite.x, a.sprite.y);
      if (d <= USE_REACH && d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // Resolve what Use does with `item` on a nearby cow, or null. Carrier-driven:
  //   food basket → Feed,  water bucket → Water,  empty bucket → Milk (when ready).
  // Returns { label, run } so useActiveTool dispatches it and checkToolProximity
  // labels the prompt with the same wording.
  _cowUseAction(item) {
    if (!item || item.type !== 'carrier') return null;
    const cow = this._nearestCowInReach();
    if (!cow) return null;
    const model = cow.model;
    const who = model?.name ? ` ${model.name}` : '';

    if (item.carrier === 'basket' && item.action === 'feed' && item.count > 0) {
      return { label: `Feed${who}`, run: () => this.feedCow(cow) };
    }
    if (item.carrier === 'bucket') {
      if (item.content === 'water' && item.count > 0) {
        return { label: `Water${who}`, run: () => this.waterCow(cow) };
      }
      // Empty bucket → milk her, but only when she's actually ready to give it.
      if (!item.content && model?.readyToProduce && !model.producedToday) {
        return { label: `Milk${who}`, run: () => this.milkCow(cow) };
      }
    }
    return null;
  }

  // tools: brush/saddle/lead act on the nearest valid horse, feed drops at your
  // feet, and carriers/water/eggs/selling walk to the nearest matching spot.
  useActiveTool() {
    if (this._paused || this._sleeping || this.riding) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    const item = this.getActiveItem();
    if (!item || item.action === 'interact') return; // empty hand: nothing to use

    const { player } = this;

    // Use never moves the player — it only acts on something already in reach.

    // Cow care (#cow): a food basket / water bucket / empty (milking) bucket used on
    // the cow in reach. Checked before the herd tools so it always wins near her.
    const cowAct = this._cowUseAction(item);
    if (cowAct) { cowAct.run(); return; }

    // Animal-targeted tools: act on the nearest valid horse if it's in reach.
    if (item.action === 'brush' || item.action === 'saddle' || item.action === 'lead') {
      const target = this._nearestToolHorse(item);
      if (!target) return;
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, target.sprite.x, target.sprite.y);
      if (d > USE_REACH) return;
      if (item.action === 'saddle')    this.toggleSaddle(target);
      else if (item.action === 'lead') this.toggleLead(target);
      else                             this.useItemOnHorse(item, target);
      return;
    }

    // Feed: a carrier holding food. Acting on an in-reach world spot wins over
    // dropping at your feet — a gathering source (keep filling rather than place,
    // #133) or the farm stand (sell sellable produce, #80). Only when you're not
    // standing at any such spot does Use drop the food where you are. (Hay isn't
    // sellable and there's no hay source at the stand, so it still drops there.)
    if (item.action === 'feed') {
      const spot = this._nearestUseSpot(item);
      if (spot) spot.activate();
      else      this.placeFood(item);
      return;
    }

    // Everything else (fill trough, gather, collect egg, sell) is a world spot —
    // activate the nearest valid one only if we're already within its reach.
    this._nearestUseSpot(item)?.activate();
  }

  // Per-frame: resolve the equipped tool/carrier's Use action (#83) — both the
  // panel prompt line (keyboard/gamepad) and the on-screen Use button label
  // (touch, via _useActionLabel). The label says exactly what Use would do,
  // naming the content where relevant ("Gather Water", "Feed Hay", "Sell
  // Apples"). _useActionLabel is null unless an action is actually in reach, so
  // the touch Use button only appears when there's something to use. The action
  // itself fires on F / X / the Use button.
  checkToolProximity() {
    let useLabel = null;
    const finish = () => { this._useActionLabel = useLabel; };

    if (this.riding ||
        this.scene.get('HotbarScene')?.invOpen ||
        this.scene.isActive('InfoPanelScene')) return finish();

    const item = this.getActiveItem();
    if (!item || item.action === 'interact') return finish();

    const { player } = this;

    // Cow care (#cow): mirror useActiveTool's dispatch so the Use prompt names what
    // it would do (Feed / Water / Milk) whenever the cow is in reach with the right
    // carrier.
    const cowAct = this._cowUseAction(item);
    if (cowAct) {
      useLabel = cowAct.label;
      this._pushPrompt('use', cowAct.label);
      return finish();
    }

    // Animal-targeted tools: brush / saddle / lead on the nearest valid horse.
    if (item.action === 'brush' || item.action === 'saddle' || item.action === 'lead') {
      const target = this._nearestToolHorse(item);
      const d = target && Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, target.sprite.x, target.sprite.y);
      if (target && d <= USE_REACH) {
        const who = this._animalName(target.key);
        let label;
        if (item.action === 'saddle')    label = target.saddled ? 'Unsaddle' : 'Saddle';
        else if (item.action === 'lead') label = this.leadHorses.includes(target) ? 'Stop Leading' : 'Lead';
        else                             label = 'Brush';
        useLabel = label; // the Use button keeps it about the action (Pet/Info name the animal)
        this._pushPrompt('use', who ? `${label} ${who}` : label);
      }
      return finish();
    }

    // Feed: a carrier holding food. Mirrors useActiveTool's dispatch (#133) — if a
    // world spot is in reach (a gathering source to keep filling, or the stand to
    // sell), the prompt names that action; otherwise it's "Drop" at your feet.
    if (item.action === 'feed') {
      const spot = this._nearestUseSpot(item);
      if (spot) {
        useLabel = spot.label.replace(/\s*\(.*\)\s*$/, '');
        this._pushPrompt('use', spot.label);
      } else {
        useLabel = `Feed ${item.label}`;
        this._pushPrompt('use', `Drop ${item.label}`);
      }
      return finish();
    }

    // World-spot tools (fill trough / fill bucket / gather / collect egg / sell):
    // the nearest actionable instance within reach. The descriptor labels already
    // name the content ("Gather Water", "Collect Egg"); strip any "(basket: n)"
    // tail for the button.
    const inst = this._nearestUseSpot(item);
    if (inst) {
      useLabel = inst.label.replace(/\s*\(.*\)\s*$/, '');
      this._pushPrompt('use', inst.label);
    }
    return finish();
  }

  // Display name for a horse/chicken/cat key, for naming prompt targets (#101).
  _animalName(key) {
    const h = this.registry.get('allHorses')?.[key];
    if (h?.name) return h.name;
    const a = this.animals?.find(x => x.key === key);
    return a?.model?.name ?? null;
  }

  // Pick the horse a tool should act on. Saddle/lead target the nearest horse
  // within care distance (toggle actions, no "needs it" cap). The brush targets
  // the dirtiest horse *that needs brushing* within reach (lowest grooming,
  // tie-broken by distance, #96) — and returns null when every in-reach horse is
  // already clean, so brushing isn't offered or fired on a maxed coat (#98).
  _nearestToolHorse(item) {
    const allHorses = this.registry.get('allHorses');
    const dist = (h) => Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, h.sprite.x, h.sprite.y);

    if (item.action === 'brush') {
      const grooming = (h) => allHorses[h.key]?.stats.grooming ?? 100;
      const inReach = this.horses.filter(h => dist(h) <= USE_REACH);
      if (!inReach.length) return null; // no horse in reach to brush
      // Prefer a horse that still needs brushing (#96); but if every in-reach
      // horse is already clean, brush the nearest one anyway — brushing is always
      // available as a bonding activity (#116, revises the #98 maxed-out disable).
      const dirty = inReach.filter(h => grooming(h) < 99.5);
      const pool = dirty.length ? dirty : inReach;
      return pool.sort((a, b) => (grooming(a) - grooming(b)) || (dist(a) - dist(b)))[0];
    }

    let best = null, bestD = Infinity;
    for (const h of this.horses) {
      const d = dist(h);
      if (d < CARE_DIST && d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  // Begin (or re-aim) a hold-to-move trip toward (x,y). Works mounted or on foot.
  _startHold(x, y) {
    this._holdMove       = true;
    this._holdTarget     = { x, y };
    this._holdPathTarget = { x, y };
    this._holdRepathAt   = this.time.now;
    this._moveToward(x, y);
  }

  _moveToward(x, y) {
    if (this.riding) this._rideMoveTo(x, y);
    else             this.tapMoveTo(x, y);
  }

  handlePointerMove(pointer) {
    if (!this._pointerDown || !this._holdMove) return;
    if (!pointer.isDown) return;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this._holdTarget = { x: w.x, y: w.y };
    // Only treat it as a drag once the finger has actually travelled — a couple of
    // pixels of tap jitter shouldn't short-circuit the hold delay.
    // pointer + _holdDown are physical (buffer) px, so the drag threshold scales by DPR.
    if (Phaser.Math.Distance.Between(pointer.x, pointer.y,
                                     this._holdDownX, this._holdDownY) > HOLD_DRAG_PX * dprOf(this)) {
      this._holdMoved = true;
    }
  }

  handlePointerUp() {
    if (this._holdMove) {
      // A real hold (long press or dragged) stops on release. A quick tap keeps
      // its route so you still walk all the way to where you tapped.
      const held = this.time.now - this._holdDownAt;
      if (held > HOLD_MS || this._holdMoved) {
        if (this.riding) this._cancelRideNav();
        else             this._cancelTapMove();
      }
    }
    this._pointerDown = false;
    this._holdMove    = false;
    this._holdTarget  = null;
  }

  // While the pointer is held, keep the active route pointed at the live finger
  // position — re-pathing only when it drifts a cell or the route runs out, and
  // throttled so the A* search doesn't run every frame.
  _updateHold() {
    if (!this._pointerDown || !this._holdMove || !this._holdTarget) return;
    const now = this.time.now;
    // Don't engage live steering until the press has been held a beat (unless the
    // finger is being dragged) — a brief press stays a plain walk-to-tap.
    if (!this._holdMoved && now - this._holdDownAt < HOLD_MS) return;
    if (now - this._holdRepathAt < 100) return;

    const t = this._holdTarget;
    const drifted = !this._holdPathTarget ||
      Phaser.Math.Distance.Between(t.x, t.y, this._holdPathTarget.x, this._holdPathTarget.y) > 24;
    const routeEmpty = this.riding ? !this.rideNav : !this.navPath;
    if (drifted || routeEmpty) {
      this._holdRepathAt   = now;
      this._holdPathTarget = { x: t.x, y: t.y };
      this._moveToward(t.x, t.y);
    }
  }

  tapMoveTo(tx, ty, onArrive) {
    this._cancelTapMove();

    const { sprite } = this.player;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    if (Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty) < 8) {
      onArrive?.();
      return;
    }

    // Find a route that steers around obstacles (the trough, fences, nests…) and
    // through the gate opening when it's open. If nothing connects (e.g. the gate
    // is shut and the target is on the far side), head straight and let _stepNav's
    // collision stop us where we can't proceed.
    const path = this._findPath(sprite.x, sprite.y, tx, ty);
    this.navPath     = (path && path.length) ? path : [{ x: tx, y: ty }];
    this.navDest     = { x: tx, y: ty };
    this.navOnArrive = onArrive ?? null;
    this._navStuck = 0;
  }

  // True if a straight segment from (x0,y0) to (x1,y1) stays clear of obstacles
  // for a body of radius R, sampled densely enough to not skip thin walls.
  // `obs` is the obstacle list to test against (defaults to all obstacles).
  _clearLine(x0, y0, x1, y1, R, obs = this.obstacles) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this._collides(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R, obs)) return false;
    }
    return true;
  }

  // Grid A* across the walkable area, returning a smoothed list of world-space
  // waypoints from just after (fromX,fromY) to (toX,toY), or null if unreachable.
  // Used by every mover (player, ridden horse, and wandering animals) so they
  // walk around obstacles instead of into them. `opts.R` is the body clearance
  // and `opts.obstacles` is the obstacle list to avoid (e.g. a chicken's list
  // omits its own coop/nests — its "home"). See _obstaclesFor.
  _findPath(fromX, fromY, toX, toY, opts = {}) {
    const R = opts.R ?? 16; // clearance — a touch more than the body's collision radius
    const obs = opts.obstacles ?? this.obstacles;
    // Straight shot? Skip the grid search entirely.
    if (this._clearLine(fromX, fromY, toX, toY, R, obs)) return [{ x: toX, y: toY }];

    const CELL = 24;
    const { minX, maxX, minY, maxY } = PLAYER_BOUNDS;
    const cols = Math.floor((maxX - minX) / CELL) + 1;
    const rows = Math.floor((maxY - minY) / CELL) + 1;
    const N = cols * rows;
    const wx = c => minX + c * CELL;
    const wy = r => minY + r * CELL;
    const toC = x => Phaser.Math.Clamp(Math.round((x - minX) / CELL), 0, cols - 1);
    const toR = y => Phaser.Math.Clamp(Math.round((y - minY) / CELL), 0, rows - 1);

    const blocked = new Uint8Array(N);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        blocked[r * cols + c] = this._collides(wx(c), wy(r), R, obs) ? 1 : 0;

    const startC = toC(fromX), startR = toR(fromY);
    let goalC = toC(toX), goalR = toR(toY);

    // Snap a blocked goal (e.g. tapping the trough itself) to the nearest free cell.
    if (blocked[goalR * cols + goalC]) {
      let best = -1, bestD = Infinity;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (blocked[r * cols + c]) continue;
          const d = (c - goalC) ** 2 + (r - goalR) ** 2;
          if (d < bestD) { bestD = d; best = r * cols + c; }
        }
      if (best < 0) return null;
      goalC = best % cols; goalR = Math.floor(best / cols);
    }
    const startIdx = startR * cols + startC;
    const goalIdx  = goalR * cols + goalC;
    blocked[startIdx] = 0; // never trap the search at the player's own cell

    const g = new Float64Array(N).fill(Infinity);
    const f = new Float64Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const h = (c, r) => {
      const dc = Math.abs(c - goalC), dr = Math.abs(r - goalR);
      return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr); // octile
    };
    g[startIdx] = 0;
    f[startIdx] = h(startC, startR);
    const open = new Set([startIdx]);
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    let found = false;
    while (open.size) {
      let cur = -1, curF = Infinity;
      for (const idx of open) if (f[idx] < curF) { curF = f[idx]; cur = idx; }
      if (cur === goalIdx) { found = true; break; }
      open.delete(cur);
      const cc = cur % cols, cr = (cur - cc) / cols;
      for (const [dc, dr] of DIRS) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const nidx = nr * cols + nc;
        if (blocked[nidx]) continue;
        // Don't cut across an obstacle corner on diagonal moves.
        if (dc !== 0 && dr !== 0 && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
        const ng = g[cur] + ((dc !== 0 && dr !== 0) ? Math.SQRT2 : 1);
        if (ng < g[nidx]) {
          g[nidx] = ng;
          came[nidx] = cur;
          f[nidx] = ng + h(nc, nr);
          open.add(nidx);
        }
      }
    }
    if (!found) return null;

    // Reconstruct, then string-pull: keep only waypoints we can't see past.
    const cells = [];
    for (let i = goalIdx; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map(i => ({ x: wx(i % cols), y: wy(Math.floor(i / cols)) }));
    pts[0] = { x: fromX, y: fromY };
    const last = pts[pts.length - 1];
    if (this._clearLine(last.x, last.y, toX, toY, R, obs)) pts.push({ x: toX, y: toY });

    const smooth = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      const tail = smooth[smooth.length - 1];
      while (j > i + 1 && !this._clearLine(tail.x, tail.y, pts[j].x, pts[j].y, R, obs)) j--;
      smooth.push(pts[j]);
      i = j;
    }
    smooth.shift(); // drop the player's current position
    return smooth.length ? smooth : [{ x: toX, y: toY }];
  }

  // Stop any in-progress tap-to-move and drop its arrival callback.
  _cancelTapMove() {
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    this._navStuck = 0;
  }

  // Drop the player onto an idle frame matching their current facing.
  _stopWalkAnim() {
    const player = this.player;
    if (!player.moving) return;
    const idleKey = player.facing === 'up'  ? 'player_up_0' :
                    player.facing === 'down' ? 'player_down_0' : 'player_side_0';
    player.sprite.setFlipX(player.facing === 'left');
    player.sprite.stop();
    player.sprite.setTexture(idleKey);
    player.moving = false;
  }

  // Advance the player one frame along navPath, sliding against obstacles like
  // keyboard movement. Reaching the last waypoint fires navOnArrive; getting
  // wedged (e.g. against a closed gate) abandons the trip.
  _stepNav(delta) {
    const { player } = this;
    const sprite = player.sprite;

    let wp = this.navPath[0];
    while (wp && Phaser.Math.Distance.Between(sprite.x, sprite.y, wp.x, wp.y) < 8) {
      this.navPath.shift();
      wp = this.navPath[0];
    }
    if (!wp) { this._stopWalkAnim(); this._finishNav(); return; }

    const dx = wp.x - sprite.x, dy = wp.y - sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = PLAYER_SPEED * (delta / 1000);
    const nx = Phaser.Math.Clamp(sprite.x + (dx / dist) * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(sprite.y + (dy / dist) * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const beforeX = sprite.x, beforeY = sprite.y;
    if (!this._collides(nx, sprite.y)) sprite.x = nx;
    if (!this._collides(sprite.x, ny)) sprite.y = ny;

    // If barely any progress was made, we're wedged against an obstacle — bail
    // after a short grace period rather than scrubbing in place forever. If we
    // wedged right next to the destination (e.g. the trough or a nest, which are
    // themselves obstacles), treat it as an arrival so the interaction still fires.
    if (Math.hypot(sprite.x - beforeX, sprite.y - beforeY) < step * 0.25) {
      this._navStuck += delta;
      if (this._navStuck > 350) {
        this._stopWalkAnim();
        const dest = this.navDest;
        if (dest && Phaser.Math.Distance.Between(sprite.x, sprite.y, dest.x, dest.y) < 60) {
          this._finishNav();
        } else {
          this._cancelTapMove();
        }
        return;
      }
    } else {
      this._navStuck = 0;
    }

    const newFacing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    if (!player.moving || newFacing !== player.facing) {
      player.facing = newFacing;
      const animKey = newFacing === 'up' ? 'player_walk_up' :
                      newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
      sprite.setFlipX(newFacing === 'left');
      sprite.play(animKey, true);
    }
    player.moving = true;
  }

  _finishNav() {
    const cb = this.navOnArrive;
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    cb?.();
  }

  getActiveItem() {
    return this.scene.get('HotbarScene')?.getActiveItem() ?? null;
  }

  // Live animal counts by species id, for demand-based gathering (#136).
  _speciesCounts() {
    return {
      horse:   Object.keys(this.registry.get('allHorses')   ?? {}).length,
      chicken: Object.keys(this.registry.get('allChickens') ?? {}).length,
      cow:     Object.keys(this.registry.get('allCows')     ?? {}).length,
    };
  }

  // How many of `content` a full gather should land on. Food: one per animal that can
  // eat it (#136), capped at carrier capacity. Non-food (water): just capacity.
  _gatherTarget(content, capacity) {
    const demand = foodDemand(content, this._speciesCounts());
    return demand > 0 ? Math.min(demand, capacity) : capacity;
  }

  // Gather from a source in one Use (sources are infinite). Food tops the carrier up
  // to one unit per animal that eats it (#136); water just fills to capacity. Owner
  // preferred a single fill-up over the one-at-a-time loop (#78, reverting #122).
  // Refuses if the carrier already holds a different content.
  gatherFrom(source) {
    const hot = this.scene.get('HotbarScene');
    const item = this.getActiveItem();
    if (!item || item.type !== 'carrier') return;
    const target = this._gatherTarget(source.content, item.capacity);
    const have   = item.content === source.content ? item.count : 0;
    const want   = Math.max(0, target - have);
    const added  = want > 0 ? (hot?.fillActiveCarrier(source.content, want) ?? 0) : 0;
    if (added <= 0) return;
    playGather(source.content); // distinct per-source pickup sound (water → splash)
    this.showIcon(CONTENT_DEFS[source.content].icon, this.player.sprite);
  }

};
