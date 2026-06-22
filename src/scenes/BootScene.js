import Phaser from 'phaser';
import { buildWorldTextures } from '../art/worldArt.js';
import { buildAnimalTextures, CHICKEN_COATS } from '../art/animalArt.js';
import { buildHorseTextures, buildFoalTextures } from '../art/horseArt.js';
import { buildPortraitTexture, buildChickenPortraitTexture } from '../art/portraitArt.js';
import { buildPlayerTextures } from '../art/playerArt.js';
import { getCoat } from '../data/coats.js';
import { loadHorse } from '../data/save.js';
import { Horse, EBONY_BASE_STATS } from '../data/horse.js';
import { Chicken } from '../data/chicken.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Player's horse (loaded from save, with offline decay applied).
    const playerHorse = loadHorse();

    // Companion horses — fixed, always content, not saved.
    const companions = [
      new Horse({ id: 'horse-2', name: 'Clover', breed: 'Bay', coat: 'bay', age: 5,
        stats: { hunger: 90, thirst: 85, grooming: 80, happiness: 92 } }),
      new Horse({ id: 'horse-3', name: 'Ash', breed: 'Dapple Grey', coat: 'dappleGrey', age: 7,
        stats: { hunger: 78, thirst: 82, grooming: 95, happiness: 88 } }),
      new Horse({ id: 'horse-4', name: 'Splash', breed: 'Paint', coat: 'paint', age: 4,
        stats: { hunger: 85, thirst: 80, grooming: 70, happiness: 90 } }),
      new Horse({ id: 'horse-5', name: 'Ember', breed: 'Chestnut', coat: 'chestnut', age: 6,
        stats: { hunger: 82, thirst: 88, grooming: 75, happiness: 86 } }),
      new Horse({ id: 'horse-6', name: 'Pearl', breed: 'Cremello', coat: 'cremello', age: 2,
        stats: { hunger: 88, thirst: 76, grooming: 90, happiness: 94 } }),
      new Horse({ id: 'horse-friesian-ebony', name: 'Ebony', breed: 'Friesian', coat: 'friesian', age: 5,
        stats: { hunger: 86, thirst: 82, grooming: 88, happiness: 91 },
        health: EBONY_BASE_STATS.health, speed: EBONY_BASE_STATS.speed, stamina: EBONY_BASE_STATS.stamina }),
    ];

    // All horses accessible by texture key.
    const allHorses = {
      horse:  playerHorse,
      horse2: companions[0],
      horse3: companions[1],
      horse4: companions[2],
      horse5: companions[3],
      horse6: companions[4],
      horse7: companions[5],
    };

    this.registry.set('horse', playerHorse);
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

    // Build textures for each horse's coat.
    buildWorldTextures(this);
    buildAnimalTextures(this);
    buildPlayerTextures(this);
    buildHorseTextures(this, 'horse',  getCoat(playerHorse.coat));
    buildHorseTextures(this, 'horse2', getCoat('bay'));
    buildHorseTextures(this, 'horse3', getCoat('dappleGrey'));
    buildHorseTextures(this, 'horse4', getCoat('paint'));
    buildHorseTextures(this, 'horse5', getCoat('chestnut'));
    buildHorseTextures(this, 'horse6', getCoat('cremello'));
    buildHorseTextures(this, 'horse7', getCoat('friesian'));

    // Portrait textures — one per unique coat.
    buildPortraitTexture(this, 'portrait_horse',  getCoat(playerHorse.coat));
    buildPortraitTexture(this, 'portrait_horse2', getCoat('bay'));
    buildPortraitTexture(this, 'portrait_horse3', getCoat('dappleGrey'));
    buildPortraitTexture(this, 'portrait_horse4', getCoat('paint'));
    buildPortraitTexture(this, 'portrait_horse5', getCoat('chestnut'));
    buildPortraitTexture(this, 'portrait_horse6', getCoat('cremello'));
    buildPortraitTexture(this, 'portrait_horse7', getCoat('friesian'));

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
