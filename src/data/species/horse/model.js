// The Horse model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'horse' species definition (./index.js). All the needs/decay/
// care/mood logic lives in Animal; this file keeps the Horse name and the
// convenience care methods (feed/water/brush/pet) that existing call sites use.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

// Tunable base stats for the Friesian "Ebony" — easy to adjust here. Applied via
// the horse roster in save.js (see optionalAttrs in the species def).
export const EBONY_BASE_STATS = {
  health:  95,
  speed:   80,
  stamina: 70,
};

export class Horse extends Animal {
  constructor(data = {}) {
    super(SPECIES.horse, data);
  }

  // Convenience wrappers around the data-driven applyAction(). Kept so existing
  // call sites (horse.feed(), etc.) continue to work unchanged.
  feed()  { this.applyAction('feed');  }
  water() { this.applyAction('water'); }
  brush() { this.applyAction('brush'); }
  pet()   { this.applyAction('pet');   }
}
