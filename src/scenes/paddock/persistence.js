// Persistence + decay ticks — saving the rosters to localStorage and the periodic
// hunger/thirst decay and autosave timers that run off the update loop. Extracted
// from PaddockScene as its own concern (issue #167).
//
// NOTE: `_saveAnimal` still switches on `model.species` to pick the right roster
// saver. That per-species branch is a cross-cutting seam slated for generalization
// in Phase B1 (registry-driven rosters); kept verbatim here so this step stays a
// pure structural move.

import { saveAllHorses, saveAllChickens, saveAllCows } from '../../data/save.js';
import { EVENTS } from '../../data/events.js';

export const WithPersistence = (Base) => class extends Base {
  _saveHorses() {
    saveAllHorses(this.registry.get('allHorses'));
  }

  // Persist whichever roster a freshly-changed model belongs to. The cat is
  // in-memory only (no roster yet), so it isn't saved.
  _saveAnimal(model) {
    if (model.species === 'horse')        this._saveHorses();
    else if (model.species === 'chicken') saveAllChickens(this.registry.get('allChickens'));
    else if (model.species === 'cow')     saveAllCows(this.registry.get('allCows'));
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
      saveAllCows(this.registry.get('allCows')); // keep her stats/lastSeen fresh (#cow)
    }
  }
};
