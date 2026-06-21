import Phaser from 'phaser';
import { buildWorldTextures } from '../art/worldArt.js';
import { buildHorseTextures } from '../art/horseArt.js';
import { buildPortraitTexture } from '../art/portraitArt.js';
import { getCoat } from '../data/coats.js';
import { loadHorse } from '../data/save.js';
import { Horse } from '../data/horse.js';

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
        stats: { hunger: 78, thirst: 82, grooming: 95, happiness: 88 } })
    ];

    // All horses accessible by texture key.
    const allHorses = {
      horse:  playerHorse,
      horse2: companions[0],
      horse3: companions[1]
    };

    this.registry.set('horse', playerHorse);
    this.registry.set('allHorses', allHorses);
    this.registry.set('viewingHorse', null);

    // Build textures for each horse's coat.
    buildWorldTextures(this);
    buildHorseTextures(this, 'horse',  getCoat(playerHorse.coat));
    buildHorseTextures(this, 'horse2', getCoat('bay'));
    buildHorseTextures(this, 'horse3', getCoat('dappleGrey'));

    // Portrait textures — one per unique coat.
    buildPortraitTexture(this, 'portrait_horse',  getCoat(playerHorse.coat));
    buildPortraitTexture(this, 'portrait_horse2', getCoat('bay'));
    buildPortraitTexture(this, 'portrait_horse3', getCoat('dappleGrey'));

    this.scene.start('PaddockScene');
  }
}
