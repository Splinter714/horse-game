import Phaser from 'phaser';
import { loadUiSettings, loadDevSettings } from '../data/save.js';
import { EVENTS } from '../data/events.js';
import {
  playHoofbeat, startWind, stopWind, startMusic, stopMusic,
} from '../audio/sounds.js';
import { INTERACT_DIST } from './paddock/constants.js';
import { WithWorld } from './paddock/world.js';
import { WithCreatures } from './paddock/creatures.js';
import { WithFlock } from './paddock/flock.js';
import { WithHerd } from './paddock/herd.js';
import { WithFarmStand } from './paddock/farmStand.js';
import { WithDayNight } from './paddock/dayNight.js';
import { WithHorseAI } from './paddock/horseAI.js';
import { WithBehaviors } from './paddock/behaviors.js';
import { WithRiding } from './paddock/riding.js';
import { WithPlayer } from './paddock/player.js';
import { WithPlayerMovement } from './paddock/playerMovement.js';
import { WithPrompts } from './paddock/prompts.js';
import { WithInteractables } from './paddock/interactables.js';
import { WithUseDispatch } from './paddock/useDispatch.js';
import { WithEffects } from './paddock/effects.js';
import { WithPersistence } from './paddock/persistence.js';
import { WithRendering } from './paddock/rendering.js';
import { WithWorldObjects } from './paddock/worldObjects.js';
import { WithCareActions } from './paddock/careActions.js';
import { WithInteraction } from './paddock/interaction.js';
import { WithInput } from './paddock/input.js';
import { applyDpr } from './uiUtils.js';

export default class PaddockScene
  extends WithWorld(WithCreatures(WithFlock(WithHerd(WithFarmStand(WithDayNight(WithHorseAI(WithBehaviors(WithRiding(WithPlayer(
    WithEffects(WithPersistence(WithRendering(WithWorldObjects(WithCareActions(WithInteraction(WithInput(
    WithPlayerMovement(WithPrompts(WithInteractables(WithUseDispatch(Phaser.Scene))))))))))))))))))))) {
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
    this.game.events.on(EVENTS.PHASE_CHANGE,    this.onPhaseChange,   this);
    this.game.events.on(EVENTS.SLEEP_DONE,      this._onSleepDone,    this);
    this.game.events.on(EVENTS.PROMPTS_CHANGED, this._onPromptsChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
      this._interactJustDown(); // consume E/Space so it doesn't queue
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
    const eJust   = this._interactJustDown();
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

