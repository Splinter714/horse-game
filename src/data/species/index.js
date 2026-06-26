// Species registry — aggregates the per-species definitions (one folder each) into
// the SPECIES map that drives the generic Animal model (../Animal.js). Adding a new
// animal type is: create a src/data/species/<name>/ folder (index.js definition,
// model.js class, behaviors.js, any art-data tables), then register it here.

import { HORSE } from './horse/index.js';
import { CHICKEN } from './chicken/index.js';
import { CAT } from './cat/index.js';
import { COW } from './cow/index.js';
import { PIG } from './pig/index.js';
import { SHEEP } from './sheep/index.js';
import { DOG } from './dog/index.js';
import * as horseBehaviors from './horse/behaviors.js';
import * as chickenBehaviors from './chicken/behaviors.js';
import * as catBehaviors from './cat/behaviors.js';

export const SPECIES = {
  horse: HORSE,
  chicken: CHICKEN,
  cat: CAT,
  cow: COW,
  pig: PIG,
  sheep: SHEEP,
  dog: DOG,
};

export function getSpecies(id) {
  return SPECIES[id] ?? SPECIES.horse;
}

// Behavior modules indexed by species id, then by behavior id. Each module is
// { id, test(ctx) -> bool, run(scene, agent) -> bool }. The `test` half is pure
// (a plain context snapshot in, boolean out) and unit-tested; `run` is the
// scene-coupled execution that reuses the existing movement primitives.
export const BEHAVIORS = {
  horse: indexById(horseBehaviors),
  chicken: indexById(chickenBehaviors),
  // The cow is a herbivore grazer like the horse, so she reuses the horse behavior
  // modules; her own `behaviors` list (cow/index.js) picks the subset she runs
  // (food/water/graze, no begging). The run() primitives are species-generic.
  cow: indexById(horseBehaviors),
  // The pig is a grazer like the cow, so she reuses the horse behavior modules too;
  // her `behaviors` list (pig/index.js) picks the subset she runs. Her pickier diet
  // (apples/carrots, no hay) is enforced by the food data, not a separate behavior.
  pig: indexById(horseBehaviors),
  // The sheep is a grazer like the cow/pig — reuses the horse behavior modules; her
  // `behaviors` list (sheep/index.js) picks the subset (hay/water/graze, no begging).
  sheep: indexById(horseBehaviors),
  // The cat hunts fish at the stream when hungry (#163) — its own one-behavior module.
  cat: indexById(catBehaviors),
  // The dog has no goal-driven behaviors yet (#185 first pass just wanders); a real
  // job — companion-follow / herding — is #186. So no BEHAVIORS.dog entry: chooseBehavior
  // returns null and it falls back to the plain wander.
};

function indexById(mod) {
  const out = {};
  for (const b of Object.values(mod)) {
    if (b && typeof b === 'object' && b.id) out[b.id] = b;
  }
  return out;
}

// Pure decision: walk a species' ordered `behaviors` list and return the id of the
// first behavior whose `test(ctx)` passes, or null if none do (caller wanders).
// This is the unit-testable core of the AI — given a context snapshot it is fully
// deterministic and has no Phaser/scene dependency.
export function chooseBehavior(speciesId, ctx) {
  const spec = getSpecies(speciesId);
  const registry = BEHAVIORS[speciesId] ?? {};
  for (const id of spec.behaviors ?? []) {
    const b = registry[id];
    if (b && b.test(ctx)) return id;
  }
  return null;
}
