// The Duck model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'duck' species definition (./index.js). It has real survival needs
// (hunger/thirst) restored at dropped duck-food/water piles via the shared grazing AI,
// and is persisted (rosters.js) so a tamed duck's care survives reloads.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Duck extends Animal {
  constructor(data = {}) {
    super(SPECIES.duck, data);
  }

  pet()   { return this.applyAction('pet'); }
  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
}
