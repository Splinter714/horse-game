import Phaser from 'phaser';
import { buildWorldTextures } from '../art/worldArt.js';
import { buildChickenTextures, CHICKEN_COATS } from '../art/chickenArt.js';
import { buildCatTextures } from '../art/catArt.js';
// Other barnyard animals (cow/sheep/pig/dog) are disabled — their art lives in
// src/art/{cow,sheep,pig,dog}Art.js, ready to build here when re-enabled.
import { buildHorseTextures, buildFoalTextures } from '../art/horseArt.js';
import { buildPortraitTexture, buildChickenPortraitTexture } from '../art/portraitArt.js';
import { buildPlayerTextures } from '../art/playerArt.js';
import { getCoat, composeCoat } from '../data/species/horse/coats.js';
import { loadAllHorses, loadAllChickens, loadAudioSettings, saveAudioSettings } from '../data/save.js';
import { applyAudioSettings } from '../audio/sounds.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Restore persisted audio settings (mute + per-bus volumes) and re-save on
    // any later change made through the mixer UI.
    applyAudioSettings(loadAudioSettings(), saveAudioSettings);

    // The whole herd, loaded from save with offline decay applied. Every horse is
    // equal — no special "player horse". Keyed by texture/registry key.
    const allHorses = loadAllHorses();

    this.registry.set('allHorses', allHorses);
    this.registry.set('viewingAnimal', null);

    // Chickens — identity + appearance, loaded (and persisted) like horses.
    const allChickens = loadAllChickens();
    const chickens = Object.values(allChickens);

    this.registry.set('allChickens', allChickens);

    // Build textures for each horse's coat — driven by the horse's own data.
    buildWorldTextures(this);
    CHICKEN_COATS.forEach((coat, i) => buildChickenTextures(this, `chicken${i}`, coat));
    buildCatTextures(this, 'cat');
    buildPlayerTextures(this);
    for (const key of Object.keys(allHorses)) {
      const coat = composeCoat(allHorses[key].coat, allHorses[key].markings);
      buildHorseTextures(this, key, coat);
      buildPortraitTexture(this, `portrait_${key}`, coat);
    }

    // Foal textures (foal1 = grey, foal2 = paint, foal3 = bay)
    buildFoalTextures(this, 'foal1', getCoat('dappleGrey'));
    buildFoalTextures(this, 'foal2', getCoat('paint'));
    buildFoalTextures(this, 'foal3', getCoat('bay'));

    // Chicken portrait textures — one per coat
    chickens.forEach((c, i) => {
      buildChickenPortraitTexture(this, `portrait_chicken${i}`, CHICKEN_COATS[c.coat]);
    });

    this.scene.start('PaddockScene');
    this.scene.launch('DayNightScene');
    this.scene.launch('HotbarScene');
  }
}
