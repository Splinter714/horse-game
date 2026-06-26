// The Dog model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'dog' species definition (./index.js). Identity-only like the
// Cat — petting tops up happiness; no survival needs. A `pet()` convenience wrapper
// keeps direct-care call sites clean.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Dog extends Animal {
  constructor(data = {}) {
    super(SPECIES.dog, data);
  }

  pet() { return this.applyAction('pet'); }
}
