// The Goat model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'goat' species definition (./index.js). The goat keeps feed/water/
// pet convenience wrappers (like the Horse/Cow) so direct-care call sites read cleanly.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Goat extends Animal {
  constructor(data = {}) {
    super(SPECIES.goat, data);
  }

  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
  pet()   { return this.applyAction('pet'); }
}
