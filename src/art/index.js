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
import { getCoat, composeCoat } from '../data/species/horse/coats.js';

// Live species present in the world. Built every boot.
export const SPECIES_TEXTURES = {
  horse(scene) {
    // One set of side-view frames per horse, driven by that horse's own coat data.
    const allHorses = scene.registry.get('allHorses');
    for (const key of Object.keys(allHorses)) {
      const coat = composeCoat(allHorses[key].coat, allHorses[key].markings);
      buildHorseTextures(scene, key, coat);
    }
    // Foal textures (foal1 = dapple grey, foal2 = chestnut pinto, foal3 = bay). The
    // demo foals are fixed, not per-roster, so they're built here unconditionally.
    buildFoalTextures(scene, 'foal1', composeCoat('grey', { dapples: true }));
    buildFoalTextures(scene, 'foal2', composeCoat('chestnut', { pinto: true }));
    buildFoalTextures(scene, 'foal3', getCoat('bay'));
  },

  chicken(scene) {
    CHICKEN_COATS.forEach((coat, i) => buildChickenTextures(scene, `chicken${i}`, coat));
    // One portrait per loaded hen, keyed by its coat.
    const allChickens = scene.registry.get('allChickens');
    Object.values(allChickens).forEach((c, i) =>
      buildChickenPortraitTexture(scene, `portrait_chicken${i}`, CHICKEN_COATS[c.coat]));
  },

  cow(scene) { buildCowTextures(scene, 'cow'); },

  cat(scene) { buildCatTextures(scene, 'cat'); },
};

// Disabled barnyard animals — their art exists but they aren't in the world yet.
// Built only for the dev Art-preview gallery so we can art-direct them early.
export const PREVIEW_TEXTURES = {
  sheep(scene) { buildSheepTextures(scene, 'sheep'); },
  pig(scene)   { buildPigTextures(scene, 'pig'); },
  dog(scene)   { buildDogTextures(scene, 'dog'); },
};
