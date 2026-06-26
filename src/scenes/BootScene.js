import Phaser from 'phaser';
import { buildWorldTextures } from '../art/worldArt.js';
import { buildPlayerTextures } from '../art/playerArt.js';
import { buildWildlifeTextures } from '../art/wildlifeArt.js';
import { SPECIES_TEXTURES, PREVIEW_TEXTURES } from '../art/index.js';
import { ROSTER_SPECIES, loadAudioSettings, saveAudioSettings, loadDevSettings, loadPlayerLook } from '../data/save.js';
import { lookFromKeys } from '../data/customize.js';
import { applyAudioSettings } from '../audio/sounds.js';

// Boot: restore settings, load every persisted roster into the registry, build all
// procedural textures, then start the world. Both the roster load and the texture
// build are registry-driven (see data/rosters.js + art/index.js), so adding an
// animal is data — not an edit here (issue #167 B1/B2). The C2 import-boundary seam
// guard checks this file names no concrete species loader or art builder.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Restore persisted audio settings (mute + per-bus volumes) and re-save on
    // any later change made through the mixer UI.
    applyAudioSettings(loadAudioSettings(), saveAudioSettings);

    // Load every persisted roster into the registry (allHorses / allChickens /
    // allCows…), with forgiving offline decay applied on load. Driven by the roster
    // registry, so a newly-added persisted species is seeded here with no edit.
    this.registry.set('viewingAnimal', null);
    for (const { registryKey, load } of ROSTER_SPECIES) {
      this.registry.set(registryKey, load());
    }

    // Build textures: world + player first (not species rosters), then each
    // species' textures — the horse/chicken builders read their loaded roster from
    // the registry set just above, so this must come after it.
    buildWorldTextures(this);
    // Build the player sprite from their saved customizer look (#44); an unset look
    // resolves to the defaults (today's appearance) via lookFromKeys.
    buildPlayerTextures(this, lookFromKeys('player', loadPlayerLook()));
    buildWildlifeTextures(this); // ambient fish/birds/raccoon — scenery, not a roster
    for (const build of Object.values(SPECIES_TEXTURES)) build(this);

    // Dev tool: boot straight into the standalone art-preview gallery instead of
    // the world (pause-menu "Start screen → Art preview"). Build the otherwise-
    // disabled barnyard animals so the gallery can show every creature.
    if (loadDevSettings().startEditor === 'preview') {
      for (const build of Object.values(PREVIEW_TEXTURES)) build(this);
      this.scene.start('ArtPreviewScene');
      return;
    }

    this.scene.start('PaddockScene');
    this.scene.launch('DayNightScene');
    this.scene.launch('HotbarScene');
  }
}
