// The Rooster model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'rooster' species definition (./index.js). Roosters are identity-only
// (name + appearance + personality) like the hen; the difference is behavioural (crows at
// dawn, doesn't lay) and lives in the species def + behaviors, not this class.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Rooster extends Animal {
  constructor(data = {}) {
    super(SPECIES.rooster, data);
  }
}
