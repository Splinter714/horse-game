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
import { buildChickTextures } from './chickArt.js';
import { buildRoosterTextures, ROOSTER_COATS } from './roosterArt.js';
import { buildChickenPortraitTexture, buildRoosterPortraitTexture } from './portraitArt.js';
import { buildCatTextures } from './catArt.js';
import { buildCowTextures } from './cowArt.js';
import { buildSheepTextures } from './sheepArt.js';
import { buildPigTextures } from './pigArt.js';
import { buildDogTextures } from './dogArt.js';
import { buildBunnyTextures } from './bunnyArt.js';
import { buildFoxTextures } from './foxArt.js';
import { buildDuckTextures } from './duckArt.js';
import { buildGoatTextures } from './goatArt.js';
import { buildLlamaTextures } from './llamaArt.js';
import { LLAMA_VARIANTS } from '../data/species/llama/index.js';
import { buildPlayerTextures } from './playerArt.js';
import { BUNNY_COATS } from '../data/species/bunny/index.js';
import { FOX_KEY } from '../data/species/fox/index.js';
import { DUCK_KEY } from '../data/species/duck/index.js';
import { buildWildlifeOldTextures } from './wildlifeArt.js'; // TEMP: old-vs-new gallery A/B
import { composeCoat } from '../data/species/horse/coats.js';
import { DEMO_FOALS } from '../data/demoFoals.js';
import { lookFromKeys } from '../data/customize.js';

// Live species present in the world. Built every boot.
export const SPECIES_TEXTURES = {
  horse(scene) {
    // One set of side-view frames per horse, driven by that horse's own coat data.
    //
    // A still-a-baby FOAL (#15, isFoal:true — the "stay a baby forever" toggle keeps
    // it that way) gets the smaller foal frames instead of the full horse frames, the
    // same way a baby chick does below. This MUST branch here rather than being
    // patched up later (#339): buildHorseTextures also emits the posture-idle
    // (`idle_content_*`/`idle_neglected_*`), swish and roll frames, which the foal art
    // has no equivalent of. Building the adult set first and then overwriting only the
    // shared idle/walk/eat/sleep keys with foal art left those extra ADULT-sized
    // frames behind under the foal's key — spawnHorse gates the posture/swish/roll
    // anims on those textures existing, so a reloaded foal grew an adult posture-idle
    // animation and rendered full-size while standing still (but foal-size while
    // walking, which uses the overwritten `walk_*` frames).
    const allHorses = scene.registry.get('allHorses');
    for (const key of Object.keys(allHorses)) {
      const h = allHorses[key];
      const coat = composeCoat(h.coat, h.markings);
      if (h.isFoal) buildFoalTextures(scene, key, coat);
      else buildHorseTextures(scene, key, coat);
    }
    // Demo foal textures, from the shared DEMO_FOALS spec (data/demoFoals.js) so the
    // art-preview customizer can seed editable models from the same coats. Fixed, not
    // per-roster, so built here unconditionally.
    //
    // NEVER let a demo sample overwrite a real herd member's frames (#352): the demo
    // keys used to be `foal1`..`foal3`, exactly the keys nextFoalKey hands a bred foal,
    // so this loop re-drew a player's own horse with demo BABY art on the shared
    // idle/walk/eat/sleep frames — leaving the adult-only posture/swish/roll frames
    // full-size, which is what made a grown-up former foal render as a foal while
    // walking and an adult while standing. The keys are prefixed now; this skip is the
    // belt-and-braces so a future colliding key can't silently repaint the herd.
    for (const [key, f] of Object.entries(DEMO_FOALS)) {
      if (key in allHorses) continue;
      buildFoalTextures(scene, key, composeCoat(f.coat, f.markings));
    }
  },

  chicken(scene) {
    // Each hen's feather coat = its saved customizer STYLE (look.style index) if it's
    // been customized, else its roster `coat` index. One frame set + portrait per hen,
    // keyed by its registry key, so a persisted style survives reload.
    //
    // A still-a-baby CHICK (#274, isFoal:true) gets the smaller chick frames instead
    // of the full hen frames (and no portrait yet — the info panel falls back to the
    // hen portrait style for baby chicks) — mirrors how a still-a-baby foal reload
    // gets buildFoalTextures instead of buildHorseTextures (paddock/breeding.js
    // spawnSavedFoals). A grown-up former chick already reads as an ordinary hen here.
    const allChickens = scene.registry.get('allChickens');
    let i = 0;
    for (const [key, c] of Object.entries(allChickens)) {
      if (c.isFoal) {
        buildChickTextures(scene, key, c.coat ?? 0);
        continue; // no portrait texture for a baby chick — nothing references it yet
      }
      const coat = CHICKEN_COATS[chickenCoatIndex(c)];
      buildChickenTextures(scene, key, coat);
      buildChickenPortraitTexture(scene, `portrait_chicken${i++}`, coat);
    }
  },

  rooster(scene) {
    // One frame set + portrait per rooster, keyed by its registry key, from its coat
    // (its customized STYLE if set, else its roster `coat` index) — mirrors the hen.
    const all = scene.registry.get('allRoosters') || {};
    let i = 0;
    for (const [key, r] of Object.entries(all)) {
      const coat = ROOSTER_COATS[roosterCoatIndex(r)];
      buildRoosterTextures(scene, key, coat);
      buildRoosterPortraitTexture(scene, `portrait_rooster${i++}`, coat);
    }
  },

  // The barnyard animals' base colours come from each individual's saved `look`
  // (per-part swatch keys), falling back to the art's defaults when unset.
  cow(scene) { buildRosterLooks(scene, 'allCows', 'cow', buildCowTextures); },

  pig(scene) { buildRosterLooks(scene, 'allPigs', 'pig', buildPigTextures); },

  cat(scene) { buildRosterLooks(scene, 'allCats', 'cat', buildCatTextures); },

  sheep(scene) { buildRosterLooks(scene, 'allSheep', 'sheep', buildSheepTextures); },

  dog(scene) { buildRosterLooks(scene, 'allDogs', 'dog', buildDogTextures); },

  goat(scene) { buildRosterLooks(scene, 'allGoats', 'goat', buildGoatTextures); },
  // Llamas / alpacas (#268). One species, two appearance VARIANTS (llama | alpaca)
  // chosen per-individual by the roster `variant` field (default: the individual's
  // `coat` slot → LLAMA_VARIANTS[coat]). Built per saved individual like the other
  // roster animals, threading the variant + any customizer `look` + the shorn state
  // (so a sheared fleece survives a reload, #233) into the art.
  llama(scene) {
    const all = scene.registry.get('allLlamas') || {};
    for (const [key, model] of Object.entries(all)) {
      const look = (model.look ? lookFromKeys('llama', model.look) : {}) || {};
      // Variant precedence: a saved customizer look wins, else the roster `variant`
      // field, else the `coat` slot (0 = llama, 1 = alpaca), else the llama default.
      const variant = look.variant ?? model.variant ?? LLAMA_VARIANTS[model.coat ?? 0] ?? 'llama';
      buildLlamaTextures(scene, key, { ...look, variant, shorn: model.isShorn?.() ?? false });
    }
  },

  // Bunnies (#224). The roster starts EMPTY and grows at runtime when the player
  // attracts a bunny with bunny food, so — unlike the other rosters — we can't build
  // "one texture per saved individual" up front. Instead build every coat's
  // textures unconditionally (keyed `bunny0`..`bunny<N-1>` = coat slot, so `bunny<i>`
  // always wears BUNNY_COATS[i]), the way the demo foals are pre-built. attractBunny
  // then spawns a bunny whose key already has a ready texture — no runtime build.
  // A persisted bunny with a customizer `look` re-skins on top via reskinAnimal.
  bunny(scene) {
    BUNNY_COATS.forEach((coat, i) => {
      buildBunnyTextures(scene, `bunny${i}`, { coat });
    });
  },

  // Foxes (#266). Like the bunny, the roster starts EMPTY and grows at runtime when a
  // wild fox is TAMED by repeated feeding, so we can't build "one texture per saved
  // individual" up front. Instead build the fox's frame set unconditionally under FOX_KEY
  // (the key a tamed fox spawns as, paddock/fox.js), the way the demo foals / bunny coats
  // are pre-built — so `_commitFox` spawns a fox whose key already has a ready texture, no
  // runtime build. A persisted fox with a customizer `look` re-skins on top via reskinAnimal.
  fox(scene) {
    buildFoxTextures(scene, FOX_KEY, { coat: 'red' });
  },

  // Ducks (#275). Like the fox, the roster starts EMPTY and grows at runtime when a
  // wild duck is TAMED by repeated feeding, so we can't build "one texture per saved
  // individual" up front. Instead build the duck's frame set unconditionally under
  // DUCK_KEY (the key a tamed duck spawns as, paddock/duck.js), the way the fox/demo
  // foals are pre-built — so `_commitDuck` spawns a duck whose key already has a ready
  // texture, no runtime build. A persisted duck with a customizer `look` re-skins on
  // top via reskinAnimal.
  duck(scene) {
    buildDuckTextures(scene, DUCK_KEY, { coat: 'mallard' });
  },
};

// A hen's coat index: its customized style if set, else the roster `coat` default.
function chickenCoatIndex(c) {
  return c.look?.style != null ? Number(c.look.style) : (c.coat ?? 0);
}

// A rooster's coat index — same STYLE-or-roster-default rule as the hen.
function roosterCoatIndex(r) {
  return r.look?.style != null ? Number(r.look.style) : (r.coat ?? 0);
}

// Build every individual in a roster from its saved `look` (swatch keys → ramps).
// A cooldown-produce animal (a sheep sheared before this reload) whose fleece hasn't
// regrown yet is built in its shorn state, so the trimmed look survives a reload
// (#233). `isShorn()` is a no-op (false) for non-producing species.
function buildRosterLooks(scene, registryKey, speciesId, build) {
  const all = scene.registry.get(registryKey) || {};
  for (const [key, model] of Object.entries(all)) {
    const look = model.look ? lookFromKeys(speciesId, model.look) : {};
    build(scene, key, { ...look, shorn: model.isShorn?.() ?? false });
  }
}

// Built only for the dev Art-preview gallery (not the live world). TEMP: the OLD 1×
// wildlife variants, so the owner can A/B them against the crisp super-sampled versions
// side by side. Remove `wildlifeOld` (and the gallery's old families) once the look is
// settled. (Sheep #184 / dog #185 are now live in SPECIES_TEXTURES above.)
export const PREVIEW_TEXTURES = {
  wildlifeOld(scene) { buildWildlifeOldTextures(scene); },
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
  // The llama keeps its variant (llama|alpaca) across a live recolor — the customizer
  // look carries the variant through so a recolored alpaca stays an alpaca.
  llama: (scene, key, look) => buildLlamaTextures(scene, key, look),
  cow:   (scene, key, look) => buildCowTextures(scene, key, look),
  goat:  (scene, key, look) => buildGoatTextures(scene, key, look),
  cat:   (scene, key, look) => buildCatTextures(scene, key, look),
  fox:   (scene, key, look) => buildFoxTextures(scene, key, look),
  duck:  (scene, key, look) => buildDuckTextures(scene, key, look),
  // The chicken picks a whole coat (a STYLE), not per-part ramps: the customizer's
  // single 'style' part stores the chosen CHICKEN_COATS entry under look.style.
  chicken: (scene, key, look) => buildChickenTextures(scene, key, look.style ?? look),
  // The rooster picks a whole coat (a STYLE) like the hen: the single 'style' part
  // stores the chosen ROOSTER_COATS entry under look.style.
  rooster: (scene, key, look) => buildRoosterTextures(scene, key, look.style ?? look),
  // The player isn't a keyed roster — one shared set of textures — so `key` is ignored
  // and the whole look (colour ramps + shape keys) rebuilds every player frame (#44).
  player: (scene, key, look) => buildPlayerTextures(scene, look),
};

export function reskinAnimal(scene, speciesId, key, look) {
  RESKIN[speciesId]?.(scene, key, look);
}
