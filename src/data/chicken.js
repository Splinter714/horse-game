// The Chicken model is a thin specialization of the generic Animal (./Animal.js),
// configured by the 'chicken' species definition (./species/index.js). Chickens are
// currently identity-only (name + appearance + personality); needs can be added in
// the species def later without changing this file.

import { Animal } from './Animal.js';
import { SPECIES } from './species/index.js';

export class Chicken extends Animal {
  constructor(data = {}) {
    super(SPECIES.chicken, data);
  }
}
