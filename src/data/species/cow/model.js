// The Cow model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'cow' species definition (./index.js). The cow keeps feed/water/
// pet convenience wrappers (like the Horse) so direct-care call sites read cleanly.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Cow extends Animal {
  constructor(data = {}) {
    super(SPECIES.cow, data);
  }

  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
  pet()   { return this.applyAction('pet'); }
}
