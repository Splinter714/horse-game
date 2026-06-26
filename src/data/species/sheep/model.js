// The Sheep model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'sheep' species definition (./index.js). Like the Horse/Cow/Pig
// it keeps feed/water/pet convenience wrappers so direct-care call sites read cleanly.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Sheep extends Animal {
  constructor(data = {}) {
    super(SPECIES.sheep, data);
  }

  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
  pet()   { return this.applyAction('pet'); }
}
