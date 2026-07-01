// The Cat model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'cat' species definition (./index.js). Identity-only for now
// (no survival needs), but persisted like the other animals so its customizer look
// and happiness survive reloads.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Cat extends Animal {
  constructor(data = {}) {
    super(SPECIES.cat, data);
  }

  pet() { return this.applyAction('pet'); }
  // A real food source (#202): the cat eats dropped fish via the shared grazing
  // primitive (horseGoEat, scenes/paddock/horseAI.js), which calls this generically.
  feed() { return this.applyAction('feed'); }
}
