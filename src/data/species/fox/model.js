// The Fox model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'fox' species definition (./index.js). It has real survival needs
// (hunger/thirst) restored at dropped fox-food/water piles via the shared grazing AI,
// and is persisted (rosters.js) so a tamed fox's care survives reloads.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Fox extends Animal {
  constructor(data = {}) {
    super(SPECIES.fox, data);
  }

  pet()   { return this.applyAction('pet'); }
  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
}
