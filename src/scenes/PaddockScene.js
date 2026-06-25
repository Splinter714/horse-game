import Phaser from 'phaser';
import { loadUiSettings, loadDevSettings } from '../data/save.js';
import { EVENTS } from '../data/events.js';
import {
  playHoofbeat,
  playBirdChirp, startWind, stopWind, startMusic, stopMusic,
  setMusicMode,
} from '../audio/sounds.js';
import {
  WORLD_W, WORLD_H, INTERACT_DIST, PLAYER_SPEED, RIDE_SPEED,
  HOLD_MS, HOLD_DRAG_PX, BOUNDS, PLAYER_BOUNDS, PASTURE_BOUNDS,
  GATE_X, GATE_GAP_X0, GATE_GAP_X1,
  STAND_DEFS, STAND_TYPES,
} from './paddock/constants.js';
import { WithWorld } from './paddock/world.js';
import { WithCreatures } from './paddock/creatures.js';
import { WithFarmStand } from './paddock/farmStand.js';
import { WithDayNight } from './paddock/dayNight.js';
import { WithHorseAI } from './paddock/horseAI.js';
import { WithBehaviors } from './paddock/behaviors.js';
import { WithRiding } from './paddock/riding.js';
import { WithPlayer } from './paddock/player.js';
import { WithEffects } from './paddock/effects.js';
import { WithPersistence } from './paddock/persistence.js';
import { WithRendering } from './paddock/rendering.js';
import { WithWorldObjects } from './paddock/worldObjects.js';
import { WithCareActions } from './paddock/careActions.js';
import { WithInteraction } from './paddock/interaction.js';
import { applyDpr, logicalW, logicalH, worldUiOffset } from './uiUtils.js';

export default class PaddockScene
  extends WithWorld(WithCreatures(WithFarmStand(WithDayNight(WithHorseAI(WithBehaviors(WithRiding(WithPlayer(
    WithEffects(WithPersistence(WithRendering(WithWorldObjects(WithCareActions(WithInteraction(Phaser.Scene)))))))))))))) {
  constructor() {
    super('PaddockScene');
  }

  create() {
    applyDpr(this); // HiDPI: zoom the world camera by the device pixel ratio

    this.decayAccum = 0;
    this.saveAccum  = 0;
    this.horses     = [];
    this.foals      = [];
    this.animals    = [];
    this.registry.set('viewingAnimal', null);

    // Whether contextual control prompts (the floating interact hints) are shown.
    // Player-toggleable in the pause menu (#82); persisted in UI settings.
    this.promptsOn = loadUiSettings().showPrompts;

    // World interactables
    this.props = { trough: null, hayPiles: [], seedPiles: [], nests: [], sources: [], barn: null };
    this.inventory = {};
    this.money = 0;
    this.farmStand = null;
    this.npcs = [];

    // Riding / leading state
    this.riding   = null; // { h, saddleImg }
    this.rideNav  = null; // tap-to-move waypoints while mounted
    this._rideStuck = 0;
    this.leadHorses = [];  // horses currently being led (in order, trailing the player)
    this.leadRope = null; // Graphics line

    this.buildWorld();
    this.buildObstacles();
    this.buildHorses();
    this.buildAnimals();
    this.buildPlayer();
    this.buildFarmStand();
    this.buildInteractables();

    // Periodic AI tick: direct idle horses to food/water
    this.time.addEvent({ delay: 3000, loop: true, callback: this.horseTick, callbackScope: this });

    // NPC customer spawning — schedule first arrival
    this._scheduleNextCustomer();

    this.isNight = false;
    this._sleeping = false;
    this.game.events.on(EVENTS.ANIMAL_ACTION,    this.doAction,        this);
    this.game.events.on(EVENTS.PHASE_CHANGE,    this.onPhaseChange,   this);
    this.game.events.on(EVENTS.SLEEP_DONE,      this._onSleepDone,    this);
    this.game.events.on(EVENTS.PROMPTS_CHANGED, this._onPromptsChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EVENTS.ANIMAL_ACTION,    this.doAction,        this);
      this.game.events.off(EVENTS.PHASE_CHANGE,    this.onPhaseChange,   this);
      this.game.events.off(EVENTS.SLEEP_DONE,      this._onSleepDone,    this);
      this.game.events.off(EVENTS.PROMPTS_CHANGED, this._onPromptsChanged, this);
      stopWind();
      stopMusic();
    });

    // Ambient audio
    startWind();
    startMusic();
    this._scheduleBirds();

    // Riding hoofbeat timer (fires at horse walk frame rate)
    this._hoofTimer = this.time.addEvent({
      delay: 310, loop: true,
      callback: () => {
        if (!this.riding) return;
        const { h } = this.riding;
        const moving = h.sprite.anims.isPlaying && h.sprite.anims.currentAnim?.key.startsWith('walk_');
        if (moving) playHoofbeat(true);
      },
    });

    // Auto-open the appearance editor straight away (skipping the info card) so
    // tweaks are one refresh away. The persisted "Start editor on" dev-tool pick
    // (pause menu) is the source of truth — set it to Off and nothing opens. It
    // works in production builds too, so the owner can test on the deployed game.
    // In DEV, an explicit `?edit=horse4` URL param overrides the pick for one-off
    // local iteration; `?play`/`?canvas` (smoke/sprite tooling) force it off.
    const dev = loadDevSettings();
    let editKey = (dev.startEditor && this.registry.get('allHorses')?.[dev.startEditor])
      ? dev.startEditor : null;

    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('edit')) {
        const ep = params.get('edit');
        editKey = (ep && this.registry.get('allHorses')?.[ep]) ? ep : 'horse';
      } else if (params.has('play') || params.has('canvas')) {
        editKey = null;
      }
    }

    if (editKey) {
      // Boot straight into the editor without flashing the pasture: blank the
      // world camera until the editor overlay (which fully covers the screen) is
      // mounted, then restore it so closing the editor returns to normal play.
      this.cameras.main.setVisible(false);
      this.events.once('resume', () => this.cameras.main.setVisible(true));
      this.time.delayedCall(0, () => this.openPortrait(editKey, { edit: true }));
    }
  }

  // ─── Horses ──���─────────────────────────────────────────────���─────────────

  buildHorses() {
    const h1 = this.spawnHorse(680,  1200, 'horse',  1500);
    const h2 = this.spawnHorse(380,  1300, 'horse2',  800);
    const h3 = this.spawnHorse(1380, 1250, 'horse3', 2200);
    const h4 = this.spawnHorse(1050, 1150, 'horse4', 1200);
    const h5 = this.spawnHorse(520,  1350, 'horse5', 3000);
    const h6 = this.spawnHorse(1600, 1280, 'horse6', 1800);
    const h7 = this.spawnHorse(900,  1220, 'horse7', 2600); // Ebony — Friesian

    // Restore saddles for any horse that was saddled when the game was last saved.
    for (const h of this.horses) {
      if (h.saddled) this.equipSaddle(h);
    }

    // Foals disabled for now — re-enable by uncommenting
    // this.spawnFoal(h3.sprite.x + 80,  h3.sprite.y, 'foal1', h3); // grey foal → Ash
    // this.spawnFoal(h4.sprite.x - 70,  h4.sprite.y, 'foal2', h4); // paint foal → Splash
    // this.spawnFoal(h2.sprite.x + 60,  h2.sprite.y, 'foal3', h2); // bay foal → Clover
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    this._pollRawPad();
    this._syncInputMode();
    if (this._paused || this._sleeping) return;
    this._updateHold();
    this.updateRiding(delta);
    this.updateSaddles();
    this.movePlayer(delta);
    this.updateLeading(delta);
    this.updateFoals(delta);
    this.checkProximity();
    this.checkToolProximity();
    this._renderPrompts();
    this._syncActionButtons();
    this.separateHorses();
    this.depthSort();
    this.tickDecay(delta);
    this.tickAutosave(delta);
  }

  // Sleep: freeze the world, hand off to DayNightScene for the fade-to-black /
  // advance-to-morning / fade-back-in, and resume when it signals EVENTS.SLEEP_DONE.
  sleep() {
    if (this._sleeping) return;
    this._sleeping = true;
    this._promptLines = [];
    this.promptPanel?.setVisible(false);
    this.game.events.emit(EVENTS.SLEEP);
  }

  _onSleepDone() {
    this._sleeping = false;
  }

  _togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      const sw = logicalW(this), sh = logicalH(this);
      const o = worldUiOffset(this); // screen-fixed overlay on the centred-origin world camera
      const bg = this.add.graphics().setDepth(9990).setScrollFactor(0);
      bg.fillStyle(0x000000, 0.55);
      bg.fillRect(-sw, -sh, sw * 3, sh * 3); // oversized so it covers the screen regardless of zoom origin
      const lbl = this.add.text(sw / 2 + o.x, sh / 2 + o.y, 'PAUSED', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      const hint = this.add.text(sw / 2 + o.x, sh / 2 + 48 + o.y, 'Press Start to resume', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9aa0c0',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      this._pauseOverlay = [bg, lbl, hint];
    } else {
      this._pauseOverlay?.forEach(o => o.destroy());
      this._pauseOverlay = null;
    }
  }

  _pollRawPad() {
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!raw) { this._rawPad = null; return; }

    // If Phaser detected it, keep this.gamePad set so the rest of the code knows a pad exists.
    // But we'll read actual state from the raw pad to avoid Phaser's stale cache.
    if (!this.gamePad && this.input.gamepad.total > 0) {
      this.gamePad = this.input.gamepad.getPad(0);
    }
    if (!this.gamePad && raw) this.gamePad = {}; // sentinel so movePlayer enters the pad branch

    const btns = raw.buttons;
    const axes = raw.axes;

    // Standard gamepad mapping
    this._rawPad = {
      leftStickX:  axes[0] ?? 0,
      leftStickY:  axes[1] ?? 0,
      dUp:     btns[12]?.pressed ?? false,
      dDown:   btns[13]?.pressed ?? false,
      dLeft:   btns[14]?.pressed ?? false,
      dRight:  btns[15]?.pressed ?? false,
      btnA:    btns[0]?.pressed  ?? false,
      btnB:    btns[1]?.pressed  ?? false,
      btnX:    btns[2]?.pressed  ?? false,
      btnY:    btns[3]?.pressed  ?? false,
      btnLB:   btns[4]?.pressed  ?? false,
      btnRB:   btns[5]?.pressed  ?? false,
      btnLT:   (btns[6]?.value ?? 0) > 0.3,
      btnRT:   (btns[7]?.value ?? 0) > 0.3,
      btnBack: btns[8]?.pressed  ?? false,
      btnStart:btns[9]?.pressed  ?? false,
    };

    const prev    = this._prevRawButtons ?? {};
    const hotbar  = this.scene.get('HotbarScene');

    if (this._rawPad.btnA && !prev.btnA) {
      this.padAJustDown = true;
      this.usingPad = true;
    }
    // B = close any open menu
    if (this._rawPad.btnB && !prev.btnB) {
      this.usingPad = true;
      if (hotbar?.invOpen)                      hotbar._closeInventory();
      else if (this.scene.isActive('InfoPanelScene')) this.scene.get('InfoPanelScene').close();
    }
    // X = use the armed hotbar tool (interact is A)
    if (this._rawPad.btnX && !prev.btnX) {
      this.usingPad = true;
      this.useActiveTool();
    }
    // Y = open the info panel for the animal in reach (interact/A always pets, #79)
    if (this._rawPad.btnY && !prev.btnY) {
      this.usingPad = true;
      this.openProxInfo();
    }
    // Hotbar navigation (#121): the D-pad drives the hotbar (it no longer moves the
    // player — see movePlayer). D-pad left/right and the bumpers step between slots;
    // D-pad up/down cycle the instances inside a carrier group (no fly-out). The
    // left trigger mirrors a number key: a short pull selects/cycles the active
    // slot, a hold opens its fly-out picker (#75). RT is still free.
    const rp = this._rawPad;
    if (rp.dLeft  && !prev.dLeft)  { this.usingPad = true; hotbar?.navSlot(-1); }
    if (rp.dRight && !prev.dRight) { this.usingPad = true; hotbar?.navSlot(+1); }
    if (rp.btnLB  && !prev.btnLB)  { this.usingPad = true; hotbar?.navSlot(-1); }
    if (rp.btnRB  && !prev.btnRB)  { this.usingPad = true; hotbar?.navSlot(+1); }
    if (rp.dUp    && !prev.dUp)    { this.usingPad = true; hotbar?._padCycleMember(-1); }
    if (rp.dDown  && !prev.dDown)  { this.usingPad = true; hotbar?._padCycleMember(+1); }
    if (rp.btnLT  && !prev.btnLT)  { this.usingPad = true; hotbar?._padTriggerDown(); }
    if (!rp.btnLT && prev.btnLT)   { hotbar?._padTriggerUp(); }
    // Back = toggle inventory
    if (this._rawPad.btnBack && !prev.btnBack) {
      this.usingPad = true;
      hotbar?._toggleInventory();
    }
    // Start = open the full pause menu (volume/mute/dev tools), so a controller
    // player reaches the same menu as touch/keyboard and can adjust volume (#159).
    // While that menu is open this scene is paused, so HotbarScene polls Start to close.
    if (this._rawPad.btnStart && !prev.btnStart) {
      this.usingPad = true;
      this.scene.get('HotbarScene')?._togglePause();
    }

    this._prevRawButtons = {
      btnA:     this._rawPad.btnA,
      btnB:     this._rawPad.btnB,
      btnX:     this._rawPad.btnX,
      btnY:     this._rawPad.btnY,
      btnLB:    this._rawPad.btnLB,
      btnRB:    this._rawPad.btnRB,
      btnLT:    this._rawPad.btnLT,
      btnRT:    this._rawPad.btnRT,
      dUp:      this._rawPad.dUp,
      dDown:    this._rawPad.dDown,
      dLeft:    this._rawPad.dLeft,
      dRight:   this._rawPad.dRight,
      btnBack:  this._rawPad.btnBack,
      btnStart: this._rawPad.btnStart,
    };
  }

  movePlayer(delta) {
    if (this.riding) return;

    // Stop all movement while radial menu is open
    if (this.scene.get('HotbarScene')?.invOpen) {
      this._cancelTapMove();
      this._stopWalkAnim();
      return;
    }

    const { cursors, wasd, player } = this;
    const pad = this.gamePad;

    let vx = 0, vy = 0;

    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;

    const rp = this._rawPad;
    if (rp) {
      // Left stick steers; the D-pad is reserved for the hotbar now (#121).
      if (Math.abs(rp.leftStickX) > 0.15) vx += rp.leftStickX;
      if (Math.abs(rp.leftStickY) > 0.15) vy += rp.leftStickY;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = rp && (
      Math.abs(rp.leftStickX) > 0.15 || Math.abs(rp.leftStickY) > 0.15
    );
    if (kbActive)  { this.usingPad = false; this.usingTouch = false; }
    if (padActive) { this.usingPad = true;  this.usingTouch = false; }

    // Manual input cancels any tap-to-move trip in progress, and dismisses the
    // info popup — moving is one of the "almost anything else" that closes it.
    if (kbActive || padActive) {
      this._cancelTapMove();
      if (this.scene.isActive('InfoPanelScene')) this.scene.get('InfoPanelScene').close();
    }

    if (this.navPath) {
      this._stepNav(delta);
      player.shadow.x = player.sprite.x;
      player.shadow.y = player.sprite.y;
      return;
    }

    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      const step = PLAYER_SPEED * (delta / 1000);
      const nx = Phaser.Math.Clamp(player.sprite.x + vx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      const ny = Phaser.Math.Clamp(player.sprite.y + vy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
      // Slide: try each axis independently so player can slide along walls
      if (!this._collides(nx, player.sprite.y)) player.sprite.x = nx;
      if (!this._collides(player.sprite.x, ny)) player.sprite.y = ny;

      let newFacing;
      if (Math.abs(vx) >= Math.abs(vy)) {
        newFacing = vx < 0 ? 'left' : 'right';
      } else {
        newFacing = vy < 0 ? 'up' : 'down';
      }

      if (!player.moving || newFacing !== player.facing) {
        player.facing = newFacing;
        const animKey = newFacing === 'up'  ? 'player_walk_up' :
                        newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
        player.sprite.setFlipX(newFacing === 'left');
        player.sprite.play(animKey, true);
      }
      player.moving = true;

    } else if (player.moving) {
      const idleKey = player.facing === 'up'  ? 'player_up_0' :
                      player.facing === 'down' ? 'player_down_0' : 'player_side_0';
      player.sprite.setFlipX(player.facing === 'left');
      player.sprite.stop();
      player.sprite.setTexture(idleKey);
      player.moving = false;
    }

    player.shadow.x = player.sprite.x;
    player.shadow.y = player.sprite.y;
  }

  // Broadcast the active input device when it changes, so UI scenes can react —
  // e.g. HotbarScene shows the on-screen Use button only for touch players.
  _syncInputMode() {
    const mode = this._promptMode();
    if (mode !== this._lastInputMode) {
      this._lastInputMode = mode;
      this.game.events.emit(EVENTS.INPUT_MODE_CHANGED, mode);
    }
  }

  // Pause-menu toggle (#82) flipped the control-prompt setting. Update our flag
  // and hide the panel immediately if they were just turned off.
  _onPromptsChanged(show) {
    this.promptsOn = !!show;
    if (!this.promptsOn) { this._promptLines = []; this.promptPanel?.setVisible(false); }
  }

  checkProximity() {
    // Fresh accumulator each frame; the tool pass and _renderPrompts run after.
    this._promptLines = [];
    // Contextual actions for the touch buttons, rebuilt each frame (#101).
    this._interactAction = null;
    this._infoAction = null;
    this._petProxTarget = null;

    if (this.scene.get('HotbarScene')?.invOpen) return;

    // While the info popup is open, the interact key just closes it (handled by
    // the popup's own keydown) — don't also re-trigger a pet/open here, which
    // would make it flicker shut-then-open. Mirrors handleTap bailing early.
    if (this.scene.isActive('InfoPanelScene')) {
      Phaser.Input.Keyboard.JustDown(this.eKey); // consume so it doesn't queue
      this.padAJustDown = false;
      return;
    }

    // When riding, show dismount hint
    if (this.riding) {
      this._pushPrompt('interact', 'Dismount');
      this._interactAction = { label: 'Dismount', run: () => this.dismount() };
      return;
    }

    const { player } = this;
    const item    = this.getActiveItem();
    const eJust   = Phaser.Input.Keyboard.JustDown(this.eKey);
    const aJust   = this.padAJustDown;
    this.padAJustDown = false;
    if (eJust) this._useKeyboard(); // interact via E → keyboard prompt glyphs

    // E (keyboard) and A (gamepad) both trigger the interact action. Tools are
    // no longer used here — they go through useActiveTool (Use button / F /
    // controller). So this whole pass is interact-only: gate/barn, mounting a
    // saddled horse, and petting/opening animals.
    const useJust = eJust || aJust;

    // No animal is the proximity target unless _petPreferenceProximity claims one
    // below. Cleared each frame so the Info input (C / Y) can't fire on a stale
    // animal when a gate/barn/mount prompt is showing instead.
    this._proxAnimal = null;

    // Bare-hand world interactables — gate, barn.
    if (this._proximityInteractable(item, useJust)) return;

    // A saddled horse close by → Mount (an interact, not a tool). Checked before
    // the pet preference so walking up to a tacked-up horse reliably mounts it.
    let mountH = null, mountD = Infinity;
    for (const h of this.horses) {
      if (!h.saddled) continue;
      const d = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, h.sprite.x, h.sprite.y);
      if (d < INTERACT_DIST && d < mountD) { mountD = d; mountH = h; }
    }
    if (mountH) {
      const label = `Mount ${this._animalName(mountH.key) ?? ''}`.trim();
      this._pushPrompt('interact', label);
      this._interactAction = { label, run: () => this.mountHorse(mountH) };
      if (useJust) this.mountHorse(mountH);
      return;
    }

    // The nearest horse voices its mood as you walk up (squeal if neglected,
    // nicker if content), on its own slightly-wider range and per-horse throttle.
    this._maybeGreetOnApproach();

    // Pet/info across all nearby animals (un-saddled horses, chickens, foals),
    // preferring the ones that still need their daily love so you won't start
    // opening info panels until every animal in reach has been loved today.
    this._petPreferenceProximity(useJust);
  }

}

