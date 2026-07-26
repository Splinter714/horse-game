// Species registry — aggregates the per-species definitions (one folder each) into
// the SPECIES map that drives the generic Animal model (../Animal.js). Adding a new
// animal type is: create a src/data/species/<name>/ folder (index.js definition,
// model.js class, behaviors.js, any art-data tables), then register it here.

import { HORSE } from './horse/index.js';
import { CHICKEN } from './chicken/index.js';
import { ROOSTER } from './rooster/index.js';
import { CAT } from './cat/index.js';
import { COW } from './cow/index.js';
import { PIG } from './pig/index.js';
import { SHEEP } from './sheep/index.js';
import { DOG } from './dog/index.js';
import { BUNNY } from './bunny/index.js';
import { GOAT } from './goat/index.js';
import { LLAMA } from './llama/index.js';
import { FOX } from './fox/index.js';
import { DUCK } from './duck/index.js';
import * as horseBehaviors from './horse/behaviors.js';
import * as chickenBehaviors from './chicken/behaviors.js';
import * as roosterBehaviors from './rooster/behaviors.js';
import * as catBehaviors from './cat/behaviors.js';
import * as dogBehaviors from './dog/behaviors.js';
import * as pigBehaviors from './pig/behaviors.js';
import * as bunnyBehaviors from './bunny/behaviors.js';
import * as foxBehaviors from './fox/behaviors.js';
import * as duckBehaviors from './duck/behaviors.js';
import * as swimBehaviors from './swim.js';

export const SPECIES = {
  horse: HORSE,
  chicken: CHICKEN,
  rooster: ROOSTER,
  cat: CAT,
  cow: COW,
  pig: PIG,
  sheep: SHEEP,
  dog: DOG,
  bunny: BUNNY,
  goat: GOAT,
  llama: LLAMA,
  fox: FOX,
  duck: DUCK,
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
  // The rooster is a flock bird like the hen — it REUSES the chicken behavior modules
  // (flee dog / seed / follow / gather at bin) and layers its own `crowAtDawn` (#269)
  // on top. Its `behaviors` list (rooster/index.js) picks the subset it runs.
  rooster: { ...indexById(chickenBehaviors), ...indexById(roosterBehaviors) },
  // The cow is a herbivore grazer like the horse, so she reuses the horse behavior
  // modules; her own `behaviors` list (cow/index.js) picks the subset she runs
  // (food/water/graze, no begging). The run() primitives are species-generic.
  cow: indexById(horseBehaviors),
  // The pig is a grazer like the cow, so she reuses the horse behavior modules too;
  // her `behaviors` list (pig/index.js) picks the subset she runs. Her pickier diet
  // (apples/carrots, no hay) is enforced by the food data, not a separate behavior.
  // She also gets her own `wallow` module (#197) — a low-priority charm behavior
  // (mud-roll), layered on top of the reused horse modules.
  pig: { ...indexById(horseBehaviors), ...indexById(pigBehaviors) },
  // The sheep is a grazer like the cow/pig — reuses the horse behavior modules; her
  // `behaviors` list (sheep/index.js) picks the subset (hay/water/graze, no begging).
  sheep: indexById(horseBehaviors),
  // The cat feeds/waters itself at its own dropped piles (seekFood/seekWater, #202
  // refinement) and falls back to fishing at the stream when hungry (#163) — its
  // own species-specific behavior module (no reuse of the horse modules).
  cat: indexById(catBehaviors),
  // The dog occasionally noses the sheep flock into a bunch (#187 charm) — its own
  // one-behavior module. A fuller "dog job" (companion-follow / real herding) is #186.
  // Layered with the GENERIC swimStream module (#231, ./swim.js): any species with
  // the `swims` capability can pick it up the same way — no dog-specific code in it.
  dog: { ...indexById(dogBehaviors), ...indexById(swimBehaviors) },
  // The bunny hops to its own dropped bunny-food/water piles (seekBunnyFood/
  // seekBunnyWater, #224) — its own behavior module, same shape as the cat's
  // seekFood/seekWater. Falls through to a plain hop-wander when neither fires.
  bunny: indexById(bunnyBehaviors),
  // The goat is a grazer like the cow — reuses the horse behavior modules; her
  // `behaviors` list (goat/index.js) picks the subset she runs (food/water/graze, no
  // begging). Her eat-everything diet (all pile contents) is enforced by the food data
  // (items.js `feeds`), not a separate behavior. The run() primitives are species-generic.
  goat: indexById(horseBehaviors),
  // The llama is a grazer like the sheep/cow/pig — reuses the horse grazer behavior
  // modules; her `behaviors` list (llama/index.js) picks the subset (hay/water/graze,
  // no begging). (She no longer has her own charm module — the spitting quirk was
  // turned off per playtest feedback, #268.)
  llama: indexById(horseBehaviors),
  // The tamed fox is a grazer that eats dropped FOX-FOOD piles — it reuses the horse
  // grazer run primitives (horseGoEat/horseGoDrink) plus its own seekFoxFood/seekFoxWater
  // gates (fox/behaviors.js); its `behaviors` list (fox/index.js) picks the fox subset.
  // Its foxFood-only diet is enforced by the food data (items.js `feeds`), not a behavior.
  fox: { ...indexById(horseBehaviors), ...indexById(foxBehaviors) },
  // The tamed duck is a grazer that eats dropped DUCK-FOOD piles — its own
  // seekDuckFood/seekDuckWater gates (duck/behaviors.js), same shape as the fox's,
  // PLUS the GENERIC swimStream module (#231, ./swim.js) since it declares the
  // `swims` capability: a content, off-cooldown duck occasionally wanders to the
  // stream and takes a dip. Its `behaviors` list (duck/index.js) picks the subset.
  duck: { ...indexById(duckBehaviors), ...indexById(swimBehaviors) },
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
