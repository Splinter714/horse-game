import Phaser from 'phaser';
import { buildWorldTextures } from '../art/worldArt.js';
import { buildAnimalTextures, CHICKEN_COATS } from '../art/animalArt.js';
import { buildHorseTextures, buildFoalTextures } from '../art/horseArt.js';
import { buildPortraitTexture, buildChickenPortraitTexture } from '../art/portraitArt.js';
import { buildPlayerTextures } from '../art/playerArt.js';
import { getCoat } from '../data/coats.js';
import { loadAllHorses } from '../data/save.js';
import { Chicken } from '../data/chicken.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // The whole herd, loaded from save with offline decay applied. Every horse is
    // equal — no special "player horse". Keyed by texture/registry key.
    const allHorses = loadAllHorses();

    this.registry.set('allHorses', allHorses);
    this.registry.set('viewingHorse', null);

    // Chickens — each has identity, name, and appearance
    const chickens = [
      new Chicken({ id: 'chicken-1', name: 'Daisy', coat: 0, personality: 'friendly' }),
      new Chicken({ id: 'chicken-2', name: 'Ruby', coat: 1, personality: 'broody' }),
      new Chicken({ id: 'chicken-3', name: 'Shadow', coat: 2, personality: 'adventurous' }),
      new Chicken({ id: 'chicken-4', name: 'Sunny', coat: 3, personality: 'cheerful' }),
      new Chicken({ id: 'chicken-5', name: 'Pearl', coat: 4, personality: 'calm' }),
    ];

    const allChickens = {
      chicken0: chickens[0],
      chicken1: chickens[1],
      chicken2: chickens[2],
      chicken3: chickens[3],
      chicken4: chickens[4],
    };

    this.registry.set('allChickens', allChickens);

    // Build textures for each horse's coat — driven by the horse's own data.
    buildWorldTextures(this);
    buildAnimalTextures(this);
    buildPlayerTextures(this);
    for (const key of Object.keys(allHorses)) {
      const coat = getCoat(allHorses[key].coat);
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
