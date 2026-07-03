// The Llama model is a thin specialization of the generic Animal (../../Animal.js),
// configured by the 'llama' species definition (./index.js). Like the Sheep/Cow/Pig it
// keeps feed/water/pet convenience wrappers so direct-care call sites read cleanly.
//
// The `variant` (llama | alpaca) is a plain identity field carried on the roster
// individual (rosters.js) and echoed through toJSON so it survives save/load; the art
// builder (art/index.js) reads it to pick the silhouette. It has no effect on stats or
// AI — the two variants are pure appearance, like horse coats.

import { Animal } from '../../Animal.js';
import { SPECIES } from '../index.js';

export class Llama extends Animal {
  constructor(data = {}) {
    super(SPECIES.llama, data);
    // Appearance variant — 'llama' (default) or 'alpaca'. Preserved verbatim.
    this.variant = data.variant ?? null;
  }

  feed()  { return this.applyAction('feed'); }
  water() { return this.applyAction('water'); }
  pet()   { return this.applyAction('pet'); }

  toJSON() {
    const json = super.toJSON();
    if (this.variant != null) json.variant = this.variant;
    return json;
  }
}
