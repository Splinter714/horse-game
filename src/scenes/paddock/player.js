// Player core — building the player sprite/camera/input bindings (buildPlayer) and
// the primary tap handler (handleTap: animals → interactables → walk). The heavier
// player subsystems live in sibling mixins: movement/pathfinding (playerMovement),
// the Use-action dispatch (useDispatch), the world-interactable descriptors
// (interactables), and the control-prompt panel (prompts). Applied as a functional
// mixin. Split out of the old ~1,030-line player.js (issue #167).

import Phaser from 'phaser';
import { WORLD_W, WORLD_H, S } from './constants.js';
import { loadDevSettings } from '../../data/save.js';
import { dprOf, logicalH } from '../uiUtils.js';

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
    // Space = a second action key (#168): acts as both E (interact: pet/mount/
    // gate/barn — polled via JustDown in checkProximity) and F (Use: feed/gather/
    // fill/collect/sell). Players who reach for space as the default action key get
    // the contextual action regardless of whether it's an interact or a Use.
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.spaceKey.on('down', () => { this._useKeyboard(); this.useActiveTool(); });
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
};
