import Phaser from 'phaser';
import { saveAllHorses, loadUiSettings } from '../data/save.js';
import { CONTENT_DEFS } from '../data/items.js';
import { EVENTS } from '../data/events.js';
import {
  playHoofbeat, playEat, playDrink, playBrush, playChime,
  playSplash, playBirdChirp, startWind, stopWind, startMusic, stopMusic,
  setMusicMode, playNicker, playSqueal,
} from '../audio/sounds.js';
import {
  WORLD_W, WORLD_H, INTERACT_DIST, CARE_DIST, PLAYER_SPEED, RIDE_SPEED,
  HOLD_MS, HOLD_DRAG_PX, BOUNDS, PLAYER_BOUNDS, PASTURE_BOUNDS,
  GATE_X, GATE_GAP_X0, GATE_GAP_X1, S,
  DUST_CLEAN_AT, DUST_MAX_ALPHA, STINK_AT, STAND_DEFS, STAND_TYPES,
} from './paddock/constants.js';
import { WithWorld } from './paddock/world.js';
import { WithCreatures } from './paddock/creatures.js';
import { WithFarmStand } from './paddock/farmStand.js';
import { WithDayNight } from './paddock/dayNight.js';
import { WithHorseAI } from './paddock/horseAI.js';
import { WithBehaviors } from './paddock/behaviors.js';
import { WithRiding } from './paddock/riding.js';
import { WithPlayer } from './paddock/player.js';

// Maps a species action's `sound` name (see data/species) to the synth function.
const SOUND_FNS = { eat: playEat, drink: playDrink, brush: playBrush, chime: playChime };

export default class PaddockScene
  extends WithWorld(WithCreatures(WithFarmStand(WithDayNight(WithHorseAI(WithBehaviors(WithRiding(WithPlayer(Phaser.Scene)))))))) {
  constructor() {
    super('PaddockScene');
  }

  create() {
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

  // ─── Food placement ──────────────────────────────────────────────────────

  // A clear spot to drop food near (x,y) — never on an obstacle (trough, coop,
  // nests, fences, farm stand…) where animals couldn't reach it. Tries the point
  // itself, then widening rings around it; returns null if nothing nearby is free.
  _freeFoodSpot(x, y, R = 16) {
    const clamp = (px, py) => ({
      x: Phaser.Math.Clamp(px, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX),
      y: Phaser.Math.Clamp(py, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY),
    });
    let c = clamp(x, y);
    if (!this._collides(c.x, c.y, R)) return c;
    for (let r = 24; r <= 72; r += 24) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        c = clamp(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        if (!this._collides(c.x, c.y, R)) return c;
      }
    }
    return null;
  }

  // Drop one unit of food from the active basket onto the ground for horses to
  // eat. Consumes a unit from the carrier; does nothing if it's empty or if
  // there's no clear ground in front of the player to drop it on.
  placeFood(item) {
    if (!item || item.type !== 'carrier' || item.count <= 0) return;
    const content = item.content;
    const groundTex = CONTENT_DEFS[content]?.ground;
    if (!groundTex) return; // only feed-type contents drop as food

    const { sprite, facing } = this.player;
    let px = sprite.x, py = sprite.y;
    if      (facing === 'right') px += 70;
    else if (facing === 'left')  px -= 70;
    else if (facing === 'down')  py += 50;
    else                         py -= 50;
    px += Phaser.Math.Between(-15, 15);
    py += Phaser.Math.Between(-10, 10);

    // Refuse to drop onto an obstacle — find clear ground first, and only spend
    // the unit once we know we have somewhere valid to put it.
    const spot = this._freeFoodSpot(px, py);
    if (!spot) return;
    if ((this.scene.get('HotbarScene')?.useActiveCarrier(1) ?? 0) <= 0) return;

    const pileSprite = this.add.image(spot.x, spot.y, groundTex).setScale(S).setDepth(spot.y);
    const pile = { x: spot.x, y: spot.y, sprite: pileSprite, feedsLeft: 3 };
    // Seed feeds chickens (seedPiles); everything else feeds horses (hayPiles).
    if (CONTENT_DEFS[content]?.feeds === 'chicken') this.props.seedPiles.push(pile);
    else                                            this.props.hayPiles.push(pile);
  }

  fillTrough() {
    const t = this.props.trough;
    if (!t || t.filled) return;
    const item = this.getActiveItem();
    if (item?.content !== 'water' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(item.count); // empty the bucket
    t.filled = true;
    t.drinks = 3;
    t.sprite.setTexture('troughFull');
    playSplash();
  }

  toggleGate() {
    const gate = this.props.gate;
    if (!gate) return;

    gate.open = !gate.open;
    gate.sprite.setTexture(gate.open ? 'gateOpen' : 'gateClosed');

    // Update gate obstacle — open gate is passable for everyone, closed gate blocks everyone
    const gateInList = this.obstacles.includes(this.gateObstacle);
    if (gate.open && gateInList) {
      // Remove gate from obstacles so player and horses can pass through
      this.obstacles = this.obstacles.filter(o => o !== this.gateObstacle);
    } else if (!gate.open && !gateInList) {
      // Add gate to obstacles to block passage
      this.obstacles.push(this.gateObstacle);
      // If the player is standing inside the gate footprint, nudge them out to
      // whichever side (farm-north or pasture-south) is closer so they don't get trapped.
      const p = this.player?.sprite;
      const g = this.gateObstacle;
      if (p && this._hits(p.x, p.y, 14, g)) {
        // Strongly favor nudging the player north (toward the farm). Only push
        // them south into the pasture if they're clearly in the bottom portion.
        const nudgeSouth = p.y > g.y + g.h * 0.8;
        p.y = nudgeSouth ? g.y + g.h + 15 : g.y - 15;
        p.y = Phaser.Math.Clamp(p.y, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
        if (this.player.shadow) this.player.shadow.y = p.y;
      }

      // Bounce any creature caught mid-stride in the gate doorway to its home
      // side so it isn't left standing in (or walking through) the shut gate.
      // Movers still approaching the gate are stopped by the _runPath guard.
      for (const m of [...this.horses, ...this.animals]) {
        if (!m.sprite?.active || !m.wanderTween) continue;
        if (this._hits(m.sprite.x, m.sprite.y, 16, g)) {
          m.wanderTween.stop();
          m.wanderTween = null;
          this._settleAtGate(m);
        }
      }
    }
  }

  // ─── Item use ────────────────────────────────────────────────────────────

  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    switch (item.action) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': horse.brush(); break;
      case 'pet':   horse.pet();   break;
      case 'saddle': this.toggleSaddle(h); return;
      case 'lead':  this.toggleLead(h); return;
    }

    this._saveHorses();
    this.game.events.emit(EVENTS.STATS_CHANGED);

    if (item.action === 'pet') {
      playChime();
      this.showHeart(h.sprite);
    } else {
      if (item.action === 'feed')  playEat();
      if (item.action === 'water') playDrink();
      if (item.action === 'brush') playBrush();
      this.showIcon(item.icon, h.sprite);
    }

    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === h.key) {
        this.scene.get('InfoPanelScene').refreshStats(horse);
      }
    }
  }

  // ─── Pet-then-info interaction ───────────────────────────────────────────

  // The first interaction with a given animal each day is a pet (heart + a
  // happiness bump for species that support it); every interaction after that
  // opens the info panel. The "petted today" set is cleared at dawn
  // (`_dawnNewDay`). Returns true if this interaction was the pet.
  _petTodayHas(key) {
    return !!this._petToday?.has(key);
  }

  petOrInfo(key, sprite, openInfo) {
    if (!this._petToday) this._petToday = new Set();
    if (this._petToday.has(key)) { openInfo(); return; }
    this._petToday.add(key);

    // Apply the pet care action for species that have one (horses); for others
    // (chickens, foals) the heart is purely affectionate feedback.
    const horse = this.registry.get('allHorses')?.[key];
    if (horse?.actionDef?.('pet')) {
      horse.applyAction('pet');
      this._saveHorses();
      this.game.events.emit(EVENTS.STATS_CHANGED);
    }

    playChime();
    this.showHeart(sprite);
  }

  // Empty-hand proximity: gather every pettable animal in reach, prefer the ones
  // that still need love today, and target the nearest of those. Returns true if
  // it claimed the prompt (so checkProximity can stop). See call site for intent.
  _petPreferenceProximity(useKey, useJust) {
    const { player } = this;
    const dist = (s) => Phaser.Math.Distance.Between(
      player.sprite.x, player.sprite.y, s.x, s.y);

    const cands = [];
    for (const h of this.horses) {
      if (h.saddled) continue; // empty hand mounts a saddled horse, not a pet
      const d = dist(h.sprite);
      if (d < CARE_DIST) cands.push({
        key: h.key, sprite: h.sprite, d, offY: 118,
        loved: this._petTodayHas(h.key), open: () => this.openPortrait(h.key),
      });
    }
    for (const a of this.animals) {
      if (!a.sprite.visible) continue; // tucked in the coop at night
      const d = dist(a.sprite);
      if (d < CARE_DIST) cands.push({
        key: a.key, sprite: a.sprite, d, offY: 54,
        loved: this._petTodayHas(a.key), open: () => this.openChickenInfo(a.key),
      });
    }
    for (const foal of this.foals) {
      const d = dist(foal.sprite);
      if (d < CARE_DIST) cands.push({ key: foal.key, sprite: foal.sprite, d, offY: 78,
        loved: false, foal: true }); // foals have no panel — always pet
    }
    if (!cands.length) return false;

    const needLove = cands.filter(c => !c.loved);
    const pool = (needLove.length ? needLove : cands).sort((a, b) => a.d - b.d);
    const t = pool[0];

    this.interactPrompt.setText(`${useKey}  ${t.loved ? 'Info' : 'Pet'}`);
    this.interactPrompt.setPosition(t.sprite.x, t.sprite.y - t.offY);
    this.interactPrompt.setVisible(this.promptsOn);

    if (useJust) {
      if (t.foal) { playChime(); this.showHeart(t.sprite); }
      else this.petOrInfo(t.key, t.sprite, t.open);
    }
    return true;
  }

  // ─── Info panel ──────────────────────────────────────────────────────────

  openPortrait(key) {
    const allHorses = this.registry.get('allHorses');
    this.registry.set('viewingAnimal', {
      animal:      allHorses[key],
      portraitKey: `portrait_${key}`,
      key,
    });
    // The horse reacts to you engaging it — nicker if content, grumpy squeal if
    // it was neglected (issue #26).
    const h = this.horses.find(x => x.key === key);
    if (h) this.greetHorse(h);
    this._openInfoPanel();
  }

  openChickenInfo(key) {
    const allChickens = this.registry.get('allChickens');
    this.registry.set('viewingAnimal', {
      animal:      allChickens[key],
      portraitKey: `portrait_${key}`,
      key,
    });
    this._openInfoPanel();
  }

  _openInfoPanel() {
    if (this.scene.isActive('InfoPanelScene')) {
      this.scene.get('InfoPanelScene').refresh();
      return;
    }
    this.scene.launch('InfoPanelScene');
    this.scene.bringToTop('InfoPanelScene');
  }

  // ─── Actions (from InfoPanelScene buttons) ───────────────────────────────

  // The single owner of applying a care action to the model. UI panels emit
  // ANIMAL_ACTION (intent only) and let this apply it, so an action is never
  // double-counted. Sound/icon feedback is driven by the species action def.
  doAction({ type, horseKey }) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[horseKey];
    if (!horseData) return;

    if (!horseData.applyAction(type)) return; // unknown action for this species

    this._saveHorses();

    const def = horseData.actionDef(type);
    SOUND_FNS[def.sound]?.();

    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet') {
        this.showHeart(h.sprite);
      } else if (def.icon) {
        this.showIcon(def.icon, h.sprite);
      }
    }
  }

  showHeart(sprite) {
    const heart = this.add.image(sprite.x, sprite.y - 100, 'heart')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: heart, y: heart.y - 56, alpha: 0, scale: S * 1.4,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  showIcon(key, sprite) {
    const icon = this.add.image(sprite.x, sprite.y - 112, key)
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 44, alpha: 0,
      duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  hop(sprite) {
    this.tweens.add({
      targets: sprite, y: sprite.y - 12, duration: 120,
      yoyo: true, ease: 'Quad.easeOut',
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  // Keep each equipped saddle glued to its horse as it wanders. The ridden
  // horse's saddle is synced inside updateRiding, so skip it here.
  updateSaddles() {
    const ridden = this.riding?.h;
    for (const h of this.horses) {
      if (!h.saddleImg || h === ridden) continue;
      h.saddleImg.x = h.sprite.x;
      h.saddleImg.y = h.sprite.y;
      h.saddleImg.setFlipX(h.sprite.flipX);
      // Depth must track the sprite's *current* y (what depthSort uses), not the
      // stale h.sprite.depth from last frame — otherwise moving south drops the
      // saddle behind the horse for a frame.
      h.saddleImg.setDepth(h.sprite.y + 1);
    }
  }

  _saveHorses() {
    saveAllHorses(this.registry.get('allHorses'));
  }

  update(time, delta) {
    this._pollRawPad();
    if (this._paused || this._sleeping) return;
    this._updateHold();
    this.updateRiding(delta);
    this.updateSaddles();
    this.movePlayer(delta);
    this.updateLeading(delta);
    this.updateFoals(delta);
    this.checkProximity();
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
    this.interactPrompt?.setVisible(false);
    this.game.events.emit(EVENTS.SLEEP);
  }

  _onSleepDone() {
    this._sleeping = false;
  }

  _togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      const sw = this.scale.width, sh = this.scale.height;
      const bg = this.add.graphics().setDepth(9990);
      bg.fillStyle(0x000000, 0.55);
      bg.fillRect(0, 0, sw, sh);
      const lbl = this.add.text(sw / 2, sh / 2, 'PAUSED', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(9991).setScrollFactor(0);
      const hint = this.add.text(sw / 2, sh / 2 + 48, 'Press Start to resume', {
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
    // LT/RT = cycle hotbar (same as LB/RB)
    if (this._rawPad.btnLT && !prev.btnLT) {
      this.usingPad = true;
      if (hotbar) hotbar._setActive((hotbar.activeSlot - 1 + NUM_SLOTS) % NUM_SLOTS);
    }
    if (this._rawPad.btnRT && !prev.btnRT) {
      this.usingPad = true;
      if (hotbar) hotbar._setActive((hotbar.activeSlot + 1) % NUM_SLOTS);
    }
    // Back = toggle inventory
    if (this._rawPad.btnBack && !prev.btnBack) {
      this.usingPad = true;
      hotbar?._toggleInventory();
    }
    // Start = pause / unpause
    if (this._rawPad.btnStart && !prev.btnStart) {
      this.usingPad = true;
      this._togglePause();
    }

    this._prevRawButtons = {
      btnA:     this._rawPad.btnA,
      btnB:     this._rawPad.btnB,
      btnX:     this._rawPad.btnX,
      btnLT:    this._rawPad.btnLT,
      btnRT:    this._rawPad.btnRT,
      btnBack:  this._rawPad.btnBack,
      btnStart: this._rawPad.btnStart,
    };
  }

  updateFoals(delta) {
    for (const foal of this.foals) {
      const parent = foal.parentH.sprite;
      const dx = parent.x - foal.sprite.x;
      const dy = parent.y - foal.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 80) {
        const speed = PLAYER_SPEED * 1.05 * (delta / 1000);
        const ratio = Math.min(1, speed / dist);
        foal.sprite.x += dx * ratio;
        foal.sprite.y += dy * ratio;
        foal.sprite.setFlipX(dx < 0);
        foal.sprite.play(`walk_${foal.key}`, true);
      } else {
        foal.sprite.play(`idle_${foal.key}`, true);
      }

      foal.shadow.x = foal.sprite.x;
      foal.shadow.y = foal.sprite.y;
      foal.shadow.setDepth(foal.sprite.y - 1);
      foal.sprite.setDepth(foal.sprite.y);
    }
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
      if (Math.abs(rp.leftStickX) > 0.15) vx += rp.leftStickX;
      if (Math.abs(rp.leftStickY) > 0.15) vy += rp.leftStickY;
      if (rp.dLeft)  vx -= 1;
      if (rp.dRight) vx += 1;
      if (rp.dUp)    vy -= 1;
      if (rp.dDown)  vy += 1;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = rp && (
      Math.abs(rp.leftStickX) > 0.15 || Math.abs(rp.leftStickY) > 0.15 ||
      rp.dLeft || rp.dRight || rp.dUp || rp.dDown
    );
    if (kbActive)  this.usingPad = false;
    if (padActive) this.usingPad = true;

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

  // Pause-menu toggle (#82) flipped the control-prompt setting. Update our flag
  // and hide the prompt immediately if they were just turned off.
  _onPromptsChanged(show) {
    this.promptsOn = !!show;
    if (!this.promptsOn) this.interactPrompt.setVisible(false);
  }

  checkProximity() {
    if (this.scene.get('HotbarScene')?.invOpen) {
      this.interactPrompt.setVisible(false);
      return;
    }

    // While the info popup is open, the interact key just closes it (handled by
    // the popup's own keydown) — don't also re-trigger a pet/open here, which
    // would make it flicker shut-then-open. Mirrors handleTap bailing early.
    if (this.scene.isActive('InfoPanelScene')) {
      this.interactPrompt.setVisible(false);
      Phaser.Input.Keyboard.JustDown(this.eKey); // consume so it doesn't queue
      this.padAJustDown = false;
      return;
    }

    // When riding, show dismount hint
    if (this.riding) {
      const h = this.riding.h;
      const btn = this.usingPad ? '[ A ]' : '[ E ]';
      this.interactPrompt.setText(`${btn}  Dismount`);
      this.interactPrompt.setPosition(h.sprite.x, h.sprite.y - 140);
      this.interactPrompt.setVisible(this.promptsOn);
      return;
    }

    const { player } = this;
    const item    = this.getActiveItem();
    const eJust   = Phaser.Input.Keyboard.JustDown(this.eKey);
    const aJust   = this.padAJustDown;
    this.padAJustDown = false;

    // E (keyboard) and A (gamepad) both trigger the interact action. Tools are
    // no longer used here — they go through useActiveTool (Use button / F /
    // controller). So this whole pass is interact-only: gate/barn, mounting a
    // saddled horse, and petting/opening animals.
    const useJust = eJust || aJust;
    const useKey  = this.usingPad ? '[ A ]' : '[ E ]';

    // Bare-hand world interactables — gate, barn.
    if (this._proximityInteractable(item, useKey, useJust)) return;

    // A saddled horse close by → Mount (an interact, not a tool). Checked before
    // the pet preference so walking up to a tacked-up horse reliably mounts it.
    let mountH = null, mountD = Infinity;
    for (const h of this.horses) {
      if (!h.saddled) continue;
      const d = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, h.sprite.x, h.sprite.y);
      if (d < INTERACT_DIST && d < mountD) { mountD = d; mountH = h; }
    }
    if (mountH) {
      this.interactPrompt.setText(`${useKey}  Mount`);
      this.interactPrompt.setPosition(mountH.sprite.x, mountH.sprite.y - 118);
      this.interactPrompt.setVisible(this.promptsOn);
      if (useJust) this.mountHorse(mountH);
      return;
    }

    // Pet/info across all nearby animals (un-saddled horses, chickens, foals),
    // preferring the ones that still need their daily love so you won't start
    // opening info panels until every animal in reach has been loved today.
    if (this._petPreferenceProximity(useKey, useJust)) return;

    this.interactPrompt.setVisible(false);
  }

  _showAnimalInfo(a) {
    const label = a.key.charAt(0).toUpperCase() + a.key.slice(1);
    const mood  = this.isNight ? 'Sleeping' : 'Wandering';
    const popup = this.add.text(a.sprite.x, a.sprite.y - 60, `${label}\n${mood}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fffde0',
      backgroundColor: '#1c1f2ecc',
      padding: { x: 8, y: 5 },
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(9999);
    this.tweens.add({
      targets: popup,
      y: popup.y - 20,
      alpha: 0,
      duration: 1800,
      ease: 'Quad.easeIn',
      onComplete: () => popup.destroy(),
    });
  }

  depthSort() {
    const p = this.player;
    p.shadow.setDepth(p.sprite.y - 1);
    p.sprite.setDepth(p.sprite.y);

    const allHorses = this.registry.get('allHorses');
    for (const h of this.horses) {
      h.shadow.x = h.sprite.x;
      h.shadow.y = h.sprite.y;
      h.shadow.setDepth(h.sprite.y - 1);
      h.sprite.setDepth(h.sprite.y);

      // Keep the dust overlay glued to the sprite and fade it as a whole with
      // how dirty the horse is (grooming < DUST_CLEAN_AT). Brushing raises
      // grooming → the splotches fade out together and vanish when fully clean.
      if (h.dustOverlay) {
        const groom = allHorses[h.key]?.stats.grooming ?? 100;
        const dirt  = Phaser.Math.Clamp((DUST_CLEAN_AT - groom) / DUST_CLEAN_AT, 0, 1);
        h.dustOverlay.x = h.sprite.x;
        h.dustOverlay.y = h.sprite.y;
        h.dustOverlay.setFlipX(h.sprite.flipX);
        h.dustOverlay.angle = h.sprite.angle; // follow the body (e.g. while rolling)
        h.dustOverlay.setDepth(h.sprite.y);
        h.dustOverlay.setAlpha(dirt * DUST_MAX_ALPHA);
        h.dustOverlay.setVisible(dirt > 0);

        // Stink lines only on a really filthy horse, gently wavering above its back.
        if (h.stinkOverlay) {
          const stink = Phaser.Math.Clamp((STINK_AT - groom) / STINK_AT, 0, 1);
          const waver = Math.sin(this.time.now / 220 + h._stinkPhase);
          h.stinkOverlay.x = h.sprite.x;
          h.stinkOverlay.y = h.sprite.y - 66 + waver * 3;
          h.stinkOverlay.setDepth(h.sprite.y + 1);
          h.stinkOverlay.setAlpha(stink * (0.75 + 0.25 * waver));
          h.stinkOverlay.setVisible(stink > 0);
        }
      }
    }

    for (const a of this.animals) {
      a.shadow.x = a.sprite.x;
      a.shadow.y = a.sprite.y;
      a.shadow.setDepth(a.sprite.y - 1);
      a.sprite.setDepth(a.sprite.y);
    }

    for (const npc of this.npcs) {
      npc.shadow.x = npc.sprite.x;
      npc.shadow.y = npc.sprite.y;
      npc.shadow.setDepth(npc.sprite.y - 1);
      npc.sprite.setDepth(npc.sprite.y);
    }
  }

  tickDecay(delta) {
    this.decayAccum += delta;
    if (this.decayAccum >= 1000) {
      const secs = this.decayAccum / 1000;
      // Decay every horse in the pasture (not just the player's) so the whole
      // herd gets hungry/thirsty over time and the feeding loop stays live.
      // Only the player's horse is persisted (see tickAutosave); companions
      // decay in-memory for the session.
      const allHorses = this.registry.get('allHorses');
      for (const h of this.horses) allHorses[h.key]?.applyDecay(secs, false);
      this.decayAccum = 0;
      this.game.events.emit(EVENTS.STATS_CHANGED);
    }
  }

  tickAutosave(delta) {
    this.saveAccum += delta;
    if (this.saveAccum >= 15000) {
      this.saveAccum = 0;
      this._saveHorses();
    }
  }
}

