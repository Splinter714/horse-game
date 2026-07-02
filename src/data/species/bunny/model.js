// The Bunny model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'bunny' species definition (./index.js). It has real survival
// needs (hunger/thirst) restored at dropped bunny-food/water piles via the shared
// grazing AI, and is persisted (rosters.js) so an attracted bunny's coat + care
// survive reloads.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Bunny extends Animal {
  constructor(data = {}) {
    super(SPECIES.bunny, data);
  }

  pet()   { return this.applyAction('pet'); }
  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
}
