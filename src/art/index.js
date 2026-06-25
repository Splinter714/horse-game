// Procedural-texture registry — maps a species id to the function that builds all
// of that species' runtime textures into a scene. BootScene iterates this instead
// of hardcoding each species' build calls, so adding an animal is one entry here
// (next to its art file) rather than an edit to the boot sequence (issue #167). The
// C2 import-boundary seam guard checks BootScene names no per-species builder.
//
// Each builder is `(scene) => void` and may read the loaded roster from the scene
// registry (e.g. the horse builds one coat per individual). World + player textures
// aren't species rosters, so they stay direct calls in BootScene.

import { buildHorseTextures, buildFoalTextures } from './horseArt.js';
import { buildChickenTextures, CHICKEN_COATS } from './chickenArt.js';
import { buildChickenPortraitTexture } from './portraitArt.js';
import { buildCatTextures } from './catArt.js';
import { buildCowTextures } from './cowArt.js';
import { buildSheepTextures } from './sheepArt.js';
import { buildPigTextures } from './pigArt.js';
import { buildDogTextures } from './dogArt.js';
import { composeCoat } from '../data/species/horse/coats.js';
import { DEMO_FOALS } from '../data/demoFoals.js';

// Live species present in the world. Built every boot.
export const SPECIES_TEXTURES = {
  horse(scene) {
    // One set of side-view frames per horse, driven by that horse's own coat data.
    const allHorses = scene.registry.get('allHorses');
    for (const key of Object.keys(allHorses)) {
      const coat = composeCoat(allHorses[key].coat, allHorses[key].markings);
      buildHorseTextures(scene, key, coat);
    }
    // Demo foal textures, from the shared DEMO_FOALS spec (data/demoFoals.js) so the
    // art-preview customizer can seed editable models from the same coats. Fixed, not
    // per-roster, so built here unconditionally.
    for (const [key, f] of Object.entries(DEMO_FOALS)) {
      buildFoalTextures(scene, key, composeCoat(f.coat, f.markings));
    }
  },

  chicken(scene) {
    CHICKEN_COATS.forEach((coat, i) => buildChickenTextures(scene, `chicken${i}`, coat));
    // One portrait per loaded hen, keyed by its coat.
    const allChickens = scene.registry.get('allChickens');
    Object.values(allChickens).forEach((c, i) =>
      buildChickenPortraitTexture(scene, `portrait_chicken${i}`, CHICKEN_COATS[c.coat]));
  },

  cow(scene) { buildCowTextures(scene, 'cow'); },

  pig(scene) { buildPigTextures(scene, 'pig'); },

  cat(scene) { buildCatTextures(scene, 'cat'); },
};

// Disabled barnyard animals — their art exists but they aren't in the world yet.
// Built only for the dev Art-preview gallery so we can art-direct them early.
export const PREVIEW_TEXTURES = {
  sheep(scene) { buildSheepTextures(scene, 'sheep'); },
  dog(scene)   { buildDogTextures(scene, 'dog'); },
};

// Live re-skin dispatch (#165) — rebuilds one creature's frame textures IN PLACE
// from a customizer `look` (per-part palette ramps). Registry-driven so no shared
// file branches on species name (mirrors SPECIES_TEXTURES; keeps the C2 seam guard
// happy). `gen()` redraws under the same texture key, so the on-screen sprite updates
// with no rebuild — the same trick reskinHorse() uses for live coat edits.
const RESKIN = {
  sheep: (scene, key, look) => buildSheepTextures(scene, key, look),
  pig:   (scene, key, look) => buildPigTextures(scene, key, look),
  dog:   (scene, key, look) => buildDogTextures(scene, key, look),
  cow:   (scene, key, look) => buildCowTextures(scene, key, look),
  cat:   (scene, key, look) => buildCatTextures(scene, key, look),
  // The chicken picks a whole coat (a STYLE), not per-part ramps: the customizer's
  // single 'style' part stores the chosen CHICKEN_COATS entry under look.style.
  chicken: (scene, key, look) => buildChickenTextures(scene, key, look.style ?? look),
};

export function reskinAnimal(scene, speciesId, key, look) {
  RESKIN[speciesId]?.(scene, key, look);
}
