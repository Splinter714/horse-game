// The Pig model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'pig' species definition (./index.js). Like the Horse and Cow
// it keeps feed/water/pet convenience wrappers so direct-care call sites read
// cleanly.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Pig extends Animal {
  constructor(data = {}) {
    super(SPECIES.pig, data);
  }

  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
  pet()   { return this.applyAction('pet'); }
}
