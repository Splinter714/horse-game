// Persistence + decay ticks — saving the rosters to localStorage and the periodic
// hunger/thirst decay and autosave timers that run off the update loop. Extracted
// from PaddockScene as its own concern (issue #167).
//
// Roster saving is registry-driven (#167 B3): both _saveAnimal and tickAutosave look
// the saver up by species id, so neither hardcodes a species. The C2 literal-tripwire
// seam guard checks this file names no per-species branch.

import { ROSTER_SPECIES } from '../../data/save.js';
import { EVENTS } from '../../data/events.js';

// Look up a roster's { registryKey, save } by species id.
const ROSTER_BY_ID = Object.fromEntries(ROSTER_SPECIES.map((r) => [r.id, r]));

export const WithPersistence = (Base) => class extends Base {
  // Persist one roster (the registry map under its registryKey) by species id.
  _saveRoster(id) {
    const r = ROSTER_BY_ID[id];
    if (r) r.save(this.registry.get(r.registryKey));
  }

  _saveHorses() {
    this._saveRoster('horse');
  }

  // Persist whichever roster a freshly-changed model belongs to. A model whose
  // species has no roster (the in-memory cat) is simply skipped.
  _saveAnimal(model) {
    this._saveRoster(model.species);
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
      // Persist every roster so each species' stats/lastSeen stay fresh — registry-
      // driven, so a new persisted animal is autosaved with no edit here (#167 B3).
      for (const r of ROSTER_SPECIES) r.save(this.registry.get(r.registryKey));
    }
  }
};
