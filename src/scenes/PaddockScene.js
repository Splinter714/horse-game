import Phaser from 'phaser';
import { saveAllHorses, saveAllChickens, loadUiSettings, loadDevSettings } from '../data/save.js';
import { CONTENT_DEFS } from '../data/items.js';
import { composeCoat } from '../data/species/horse/coats.js';
import { buildHorseTextures } from '../art/horseArt.js';
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
  TROUGH_CAP, TROUGH_PER_BUCKET,
} from './paddock/constants.js';
import { WithWorld } from './paddock/world.js';
import { WithCreatures } from './paddock/creatures.js';
import { WithFarmStand } from './paddock/farmStand.js';
import { WithDayNight } from './paddock/dayNight.js';
import { WithHorseAI } from './paddock/horseAI.js';
import { WithBehaviors } from './paddock/behaviors.js';
import { WithRiding } from './paddock/riding.js';
import { WithPlayer } from './paddock/player.js';
import { applyDpr, logicalW, logicalH, worldUiOffset } from './uiUtils.js';

// Maps a species action's `sound` name (see data/species) to the synth function.
const SOUND_FNS = { eat: playEat, drink: playDrink, brush: playBrush, chime: playChime };

export default class PaddockScene
  extends WithWorld(WithCreatures(WithFarmStand(WithDayNight(WithHorseAI(WithBehaviors(WithRiding(WithPlayer(Phaser.Scene)))))))) {
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
    // tweaks are one refresh away. The persisted "Start screen" dev-tool pick
    // (pause menu) is the source of truth — leave it on "Farm" and nothing opens.
    // It works in production builds too, so the owner can test on the deployed game.
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
    if (CONTENT_DEFS[content]?.feeds?.includes('chicken')) this.props.seedPiles.push(pile);
    else                                                   this.props.hayPiles.push(pile);
  }

  fillTrough() {
    const t = this.props.trough;
    if (!t || t.level >= TROUGH_CAP) return; // already brim-full
    const item = this.getActiveItem();
    if (item?.content !== 'water' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(item.count); // empty the bucket
    this._setTroughLevel(t.level + TROUGH_PER_BUCKET); // pour raises the level (#103)
    playSplash();
  }

  // The trough sprite for a given water level (#109): each level has its own
  // texture (`trough` empty, then trough1..troughN built in worldArt.js), so the
  // visible water height matches the actual level 1:1 instead of bucketing many
  // levels into a single "full-looking" sprite (#103).
  _troughTexture(level) {
    if (level <= 0) return 'trough';
    return `trough${Phaser.Math.Clamp(Math.round(level), 1, TROUGH_CAP)}`;
  }

  // Set the trough's water level (clamped), keep the `filled` flag (read in lots
  // of places) in sync, and swap the sprite to match. The single owner of trough
  // level changes — both pouring (fillTrough) and drinking (horseGoDrink) go here.
  _setTroughLevel(level) {
    const t = this.props.trough;
    if (!t) return;
    t.level  = Phaser.Math.Clamp(level, 0, TROUGH_CAP);
    t.filled = t.level > 0;
    t.sprite.setTexture(this._troughTexture(t.level));
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

    // How dirty the coat is *before* this brush stroke, for dust-puff intensity.
    const preDirt = (100 - (horse.stats.grooming ?? 100)) / 100;
    // A fully-clean coat can't get cleaner, so brushing it becomes a bonding
    // gesture instead — it raises happiness like a pet, but keeps the brush sound
    // and shows a heart with no dust (#116). Brushing is therefore always allowed.
    const brushClean = item.action === 'brush' && (horse.stats.grooming ?? 100) >= 99.5;

    switch (item.action) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': if (brushClean) horse.pet(); else horse.brush(); break;
      case 'pet':   horse.pet();   break;
      case 'saddle': this.toggleSaddle(h); return;
      case 'lead':  this.toggleLead(h); return;
    }

    this._saveHorses();
    this.game.events.emit(EVENTS.STATS_CHANGED);

    if (item.action === 'pet') {
      playChime();
      this.showHeart(h.sprite);
    } else if (item.action === 'brush') {
      playBrush();
      if (brushClean) this.showHeart(h.sprite);   // clean coat → affection (#116)
      else this.showDustPuff(h.sprite, preDirt);  // dirty coat → groom out dust
    } else {
      if (item.action === 'feed')  playEat(item.content); // crunchy apple/carrot vs munchy hay (#126)
      if (item.action === 'water') playDrink();
      this.showIcon(item.icon, h.sprite);
    }

    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === h.key) {
        this.scene.get('InfoPanelScene').refreshStats(horse);
      }
    }
  }

  // ─── Pet / info interaction ──────────────────────────────────────────────

  // Interact (E / gamepad A / tap) pets/loves an animal (#79). Info moved to its
  // own input: the C key, gamepad Y, or a double-tap (see openProxInfo).

  // Pet a horse "does something" while it can still gain happiness OR hasn't had
  // today's love yet (recording the love is what keeps it from waking up grumpy).
  // Only once it's BOTH full and already loved is there nothing to add. Capless
  // animals (chickens/cat) have no happiness/daily-care, so a pet is always pure
  // affection and always available.
  _canPetAnimal(model) {
    if (!model) return true; // no care model (a foal) — affection always lands
    if (!model.actionDef?.('pet')) return true; // no love stat — pure affection
    return (model.stats?.happiness ?? 0) < 99.5 || !model.caredToday?.loved;
  }

  // Resolve the care model for any animal key: horses live in the allHorses
  // registry; chickens and the cat carry their model on the in-world entity.
  _animalModel(key) {
    return this.registry.get('allHorses')?.[key]
        ?? this.animals?.find(a => a.key === key)?.model
        ?? null;
  }

  petAnimal(key, sprite) {
    const model = this._animalModel(key);
    if (!this._canPetAnimal(model)) return false; // nothing to add (#98 / loved)

    // First pet/love of the day for a horse plays the friendly chortle too — the
    // same greeting as opening its info (#149). Captured before applyAction sets
    // `loved`; greetHorse's nicker cooldown avoids doubling up with a fresh info open.
    const firstLoveToday = model?.species === 'horse' && !model.caredToday?.loved;

    // Every pet nudges happiness up (clamped, so it no-ops at full) and records
    // 'loved' for today. Works for any species with a `pet` action now — horses,
    // chickens, and the cat (#104). A model without one just gets the heart.
    if (model?.actionDef?.('pet')) {
      model.applyAction('pet');
      this._saveAnimal(model);
      this.game.events.emit(EVENTS.STATS_CHANGED);
    }

    if (firstLoveToday) {
      const h = this.horses.find(x => x.key === key);
      if (h) this.greetHorse(h); // applyAction cleared `neglected`, so this nickers
    }

    playChime();
    this.showHeart(sprite);
    return true;
  }

  // Persist whichever roster a freshly-changed model belongs to. The cat is
  // in-memory only (no roster yet), so it isn't saved.
  _saveAnimal(model) {
    if (model.species === 'horse')        this._saveHorses();
    else if (model.species === 'chicken') saveAllChickens(this.registry.get('allChickens'));
  }

  // Pet the current proximity target (foals just get a heart — they have no
  // care model). Used by the interact button.
  _petTarget(t) {
    if (t.foal) { playChime(); this.showHeart(t.sprite); return; }
    this.petAnimal(t.key, t.sprite);
  }

  // A neglected horse the player has approached gives a throttled grumpy squeal +
  // anger mark, so its mood reads without it fleeing (#150). Non-horses/foals and
  // content horses are silent here. Tending it clears `neglected` and stops this.
  _maybeGrumpAtPlayer(prox) {
    if (!prox) return;
    const model = this.registry.get('allHorses')?.[prox.key];
    if (!model?.neglected) return;
    const h = this.horses.find(x => x.key === prox.key);
    if (!h) return;
    const now = this.time.now;
    if (h._lastGrump && now - h._lastGrump < 6000) return;
    h._lastGrump = now;
    playSqueal();
    this.showIcon('iconGrumpy', h.sprite);
  }

  // Open the info panel for the animal currently in reach (the separate Info
  // input: C key / gamepad Y / double-tap). Foals have no panel. No-op while a
  // menu/panel is open or there's no animal in range.
  openProxInfo() {
    if (this._paused || this._sleeping || this.riding) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    // If the info panel is already open on a customizable animal, a second info
    // press (C / gamepad Y) opens the appearance editor (#147 controller access).
    if (this.scene.isActive('InfoPanelScene')) {
      const info = this.scene.get('InfoPanelScene');
      if (info?._mode === 'info' && info._canEdit?.()) info._enterEdit();
      return;
    }
    const t = this._proxAnimal;
    if (!t || t.foal || !t.open) return;
    t.open();
  }

  // Empty-hand proximity: gather every pettable animal in reach, prefer the ones
  // that still need love today, and target the nearest of those. Returns true if
  // it claimed the prompt (so checkProximity can stop). See call site for intent.
  _petPreferenceProximity(useJust) {
    const { player } = this;
    const allHorses = this.registry.get('allHorses');
    const dist = (s) => Phaser.Math.Distance.Between(
      player.sprite.x, player.sprite.y, s.x, s.y);

    const cands = [];
    for (const h of this.horses) {
      if (h.saddled) continue; // empty hand mounts a saddled horse, not a pet
      const d = dist(h.sprite);
      if (d >= CARE_DIST) continue;
      const model = allHorses?.[h.key];
      const hap = model?.stats?.happiness ?? 100;
      const lovedToday = !!model?.caredToday?.loved;
      // needScore guides the prompt to who needs love most: un-loved horses first
      // (so none are left to wake grumpy), then by happiness deficit within each
      // group. canPet gates availability (#98 / still owed today's love).
      cands.push({
        key: h.key, sprite: h.sprite, d, name: model?.name ?? null,
        canPet: this._canPetAnimal(model),
        needScore: (lovedToday ? 0 : 1000) + (100 - hap),
        open: () => this.openPortrait(h.key),
      });
    }
    for (const a of this.animals) {
      if (!a.sprite.visible) continue; // tucked in the coop at night
      const d = dist(a.sprite);
      if (d >= CARE_DIST) continue;
      // Chickens/cat now have a love stat (#104): offer a pet until they're full
      // and already loved, just like horses. needScore keeps them lowest priority
      // (they never go grumpy), so the herd's daily love still comes first.
      cands.push({
        key: a.key, sprite: a.sprite, d, name: a.model?.name ?? null,
        canPet: this._canPetAnimal(a.model), needScore: 0,
        open: () => this.openCreatureInfo(a),
      });
    }
    for (const foal of this.foals) {
      const d = dist(foal.sprite);
      if (d < CARE_DIST) cands.push({ key: foal.key, sprite: foal.sprite, d, name: null,
        canPet: true, needScore: 0, foal: true }); // foals: no panel, always pet
    }
    if (!cands.length) { this._proxAnimal = null; return false; }

    // Info target: the nearest animal that has a panel — plain proximity (#97),
    // independent of need. (Foals have no panel.)
    this._proxAnimal = cands.filter(c => c.open).sort((a, b) => a.d - b.d)[0] ?? null;

    // A grumpy (neglected) horse the player is near voices its mood on approach,
    // throttled — instead of running off to a corner (#150). It stays pettable.
    this._maybeGrumpAtPlayer(this._proxAnimal);

    // Pet target: among animals a pet would help (#98), the one that needs love
    // most (un-loved first, then biggest happiness deficit), tie-broken by
    // distance (#96). None when every nearby animal is already cheered + loved.
    const petable = cands.filter(c => c.canPet);
    const petTarget = petable.sort((a, b) => (b.needScore - a.needScore) || (a.d - b.d))[0] ?? null;

    // Queue a line per available action — each names its own target, so Pet and
    // Info pointing at two different animals (#96/#97) reads clearly (#101). The
    // same targets drive the touch Interact / Info buttons.
    if (petTarget) {
      const label = petTarget.name ? `Pet ${petTarget.name}` : 'Pet';
      this._pushPrompt('interact', label);
      this._petProxTarget = petTarget;
      this._interactAction = { label, run: () => this._petTarget(petTarget) };
    }
    if (this._proxAnimal) {
      const t = this._proxAnimal;
      const label = t.name ? `Info: ${t.name}` : 'Info';
      this._pushPrompt('info', label);
      this._infoAction = { label, run: () => this.openProxInfo() };
    }

    if (useJust && petTarget) this._petTarget(petTarget);
    return true;
  }

  // ─── Info panel ──────────────────────────────────────────────────────────

  openPortrait(key, opts) {
    const allHorses = this.registry.get('allHorses');
    this.registry.set('viewingAnimal', {
      animal:      allHorses[key],
      // portraitKey: `portrait_${key}`, // deprecated front portrait — panel uses the side view
      key,
    });
    // The horse reacts to you engaging it — nicker if content, grumpy squeal if
    // it was neglected (issue #26).
    const h = this.horses.find(x => x.key === key);
    if (h) this.greetHorse(h);
    this._openInfoPanel(opts);
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

  // Open the info panel for any creature in this.animals (chicken or cat) using
  // its attached model directly — so keyless species (the cat, #84) get a panel
  // too, without a registry roster.
  openCreatureInfo(a) {
    if (!a.model) return;
    this.registry.set('viewingAnimal', {
      animal:      a.model,
      portraitKey: `portrait_${a.key}`,
      key:         a.key,
    });
    this._openInfoPanel();
  }

  _openInfoPanel(opts) {
    if (this.scene.isActive('InfoPanelScene')) {
      const s = this.scene.get('InfoPanelScene');
      s.refresh();
      if (opts?.edit && s._canEdit?.()) s._enterEdit();
      return;
    }
    // Always pass an explicit `edit` flag: Phaser caches a scene's launch data, so
    // omitting it would reuse a previous `{ edit: true }` (e.g. after the dev
    // editor-boot) and wrongly reopen in edit mode (#dev-tools).
    this.scene.launch('InfoPanelScene', { edit: !!opts?.edit });
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

    // Dirtiness before the action is applied, for brush dust-puff intensity.
    const preDirt = (100 - (horseData.stats.grooming ?? 100)) / 100;
    // Brushing a fully-clean coat is a bonding gesture (#116): raise happiness
    // like a pet (apply 'pet'), but keep the brush sound and a heart, no dust.
    const brushClean = type === 'brush' && (horseData.stats.grooming ?? 100) >= 99.5;

    if (!horseData.applyAction(brushClean ? 'pet' : type)) return; // unknown action

    this._saveHorses();

    const def = horseData.actionDef(type);
    SOUND_FNS[def.sound]?.();   // brush sound for brush (clean or dirty)

    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet' || brushClean) {
        this.showHeart(h.sprite);
      } else if (type === 'brush') {
        this.showDustPuff(h.sprite, preDirt); // dust off the coat, not a brush icon
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

  // Brushing feedback (#95): little puffs of dust/dirt coming off the coat,
  // instead of a brush icon — reads as actually grooming the dirt out. Dirtier
  // coats (lower grooming) kick up more, bigger puffs. `dirtiness` is 0..1.
  showDustPuff(sprite, dirtiness = 0.6) {
    const d = Phaser.Math.Clamp(dirtiness, 0, 1);
    const n = 4 + Math.round(d * 6); // 4..10 puffs
    const baseY = sprite.y - 44;     // around the horse's body/back
    for (let i = 0; i < n; i++) {
      // Dusty tan-to-brown, slightly varied per puff.
      const tint = Phaser.Display.Color.GetColor(
        150 + Math.floor(Math.random() * 45),
        120 + Math.floor(Math.random() * 35),
        80  + Math.floor(Math.random() * 35));
      const r = 2.5 + Math.random() * (3 + d * 3);
      const puff = this.add.circle(
        sprite.x + (Math.random() - 0.5) * 80,
        baseY    + (Math.random() - 0.5) * 46,
        r, tint, 0.5).setDepth(10000);
      this.tweens.add({
        targets: puff,
        x: puff.x + (Math.random() - 0.5) * 56,
        y: puff.y - 18 - Math.random() * 40, // drift up as it disperses
        alpha: 0,
        scale: 1.7 + Math.random(),
        duration: 600 + Math.random() * 400,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
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

  // Re-skin a horse live from its current coat + marking data (#2/#17). gen()
  // redraws the frame + portrait textures in place, so the existing sprite and its
  // running animations show the new coat with no rebuild. Used by the appearance
  // editor embedded in the info panel (customizer.js / InfoPanelScene, #147).
  reskinHorse(key) {
    const data = this.registry.get('allHorses')?.[key];
    if (!data) return;
    const coat = composeCoat(data.coat, data.markings);
    buildHorseTextures(this, key, coat, data.build); // the side-view frames the world + panel use
  }

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

    // Pet/info across all nearby animals (un-saddled horses, chickens, foals),
    // preferring the ones that still need their daily love so you won't start
    // opening info panels until every animal in reach has been loved today.
    this._petPreferenceProximity(useJust);
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
        // The dust/stink overlays are the STANDING horse shape, so they'd float
        // awkwardly over the on-its-side sleep/roll pose. Hide them whenever that
        // lying-down frame is showing — i.e. while rolling and while asleep at
        // night (#102). They reappear (darker, if the roll dirtied it) on standing.
        const lying = h.sprite.anims?.currentAnim?.key === `sleep_${h.key}`;
        // The body art bobs 1 design-pixel (= S world px) on the odd idle/walk
        // frames; mirror that here so the dust splotches and stink lines bounce
        // *with* the horse instead of floating over the breathing body.
        const frameKey = h.sprite.frame?.texture?.key || '';
        const bob = /(_1|_3)$/.test(frameKey) ? S : 0;
        h.dustOverlay.x = h.sprite.x;
        h.dustOverlay.y = h.sprite.y + bob;
        h.dustOverlay.setFlipX(h.sprite.flipX);
        h.dustOverlay.angle = h.sprite.angle; // follow the body (e.g. while rolling)
        h.dustOverlay.setDepth(h.sprite.y);
        h.dustOverlay.setAlpha(dirt * DUST_MAX_ALPHA);
        h.dustOverlay.setVisible(dirt > 0 && !lying);

        // Stink lines only on a really filthy horse, gently wavering above its back.
        if (h.stinkOverlay) {
          const stink = Phaser.Math.Clamp((STINK_AT - groom) / STINK_AT, 0, 1);
          const waver = Math.sin(this.time.now / 220 + h._stinkPhase);
          h.stinkOverlay.x = h.sprite.x;
          h.stinkOverlay.y = h.sprite.y - 66 + waver * 3 + bob;
          h.stinkOverlay.setDepth(h.sprite.y + 1);
          h.stinkOverlay.setAlpha(stink * (0.75 + 0.25 * waver));
          h.stinkOverlay.setVisible(stink > 0 && !lying);
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
      // Chickens/cat have no survival needs, but applyDecay eases their happiness
      // back toward its resting baseline so a pet's cheer fades over time (#104/#105).
      for (const a of this.animals) a.model?.applyDecay(secs, false);
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

