// Pet / info interaction — the in-world social layer: petting the nearest animal
// that still wants love, voicing a horse's mood as you walk up, and opening the
// (data-driven) info panel for any animal. These methods are tightly interwoven
// (_petPreferenceProximity ranks candidates via _canPetAnimal/_animalModel, the
// prompts route through _petTarget/openProxInfo), so they move as one unit.
// Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { GREET_DIST, CARE_DIST, PET_SOUND_MS } from './constants.js';
import { playChime, playNicker, playSqueal } from '../../audio/sounds.js';

export const WithInteraction = (Base) => class extends Base {
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

    // Every pet nudges happiness up (clamped, so it no-ops at full) and records
    // 'loved' for today. Works for any species with a `pet` action now — horses,
    // chickens, and the cat (#104). A model without one just gets the heart.
    if (model?.actionDef?.('pet')) {
      model.applyAction('pet');
      this._saveAnimal(model);
      this.game.events.emit(EVENTS.STATS_CHANGED);
    }

    // Petting is pure affection, so it sounds happy: a friendly nicker for horses
    // (rate-limited so rapid petting doesn't machine-gun it), the soft chime for
    // the chickens/cat who don't nicker. The heart shows on every pet regardless.
    if (model?.species === 'horse') this._petNicker(this.horses.find(x => x.key === key));
    else playChime();
    this.showHeart(sprite);
    return true;
  }

  // Pet the current proximity target (foals just get a heart — they have no
  // care model). Used by the interact button.
  _petTarget(t) {
    if (t.foal) { playChime(); this.showHeart(t.sprite); return; }
    this.petAnimal(t.key, t.sprite);
  }

  // The nearest horse within greeting range voices its mood as the player walks
  // up, throttled per-horse — a sad squeal if it's neglected, a friendly nicker
  // if it's content (#150). It stays put either way (no fleeing). Scans its own
  // (slightly wider) range so the greeting reads a beat before you're in petting
  // reach. No mood icon — the sound carries it.
  _maybeGreetOnApproach() {
    const { player } = this;
    let near = null, nearD = GREET_DIST;
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, h.sprite.x, h.sprite.y);
      if (d < nearD) { nearD = d; near = h; }
    }
    if (!near) return;
    const model = this.registry.get('allHorses')?.[near.key];
    if (!model) return;
    const now = this.time.now;
    if (near._lastApproachGreet && now - near._lastApproachGreet < 6000) return;
    near._lastApproachGreet = now;
    if (model.neglected) playSqueal();   // sad
    else                  playNicker();  // happy
  }

  // A petting nicker, rate-limited per-horse so rapid petting doesn't machine-gun
  // the sound. The pet's happiness gain + heart still land on every press.
  _petNicker(h) {
    const now = this.time.now;
    if (h?._lastPetNicker && now - h._lastPetNicker < PET_SOUND_MS) return;
    if (h) h._lastPetNicker = now;
    playNicker();
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
};
