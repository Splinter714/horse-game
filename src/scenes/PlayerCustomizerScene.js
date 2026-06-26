import Phaser from 'phaser';
import { applyDpr } from './uiUtils.js';
import { WithCustomizerShell } from './customizer/shell.js';
import { WithCustomizerNav } from './customizer/nav.js';
import { loadPlayerLook, savePlayerLook } from '../data/save.js';

// Standalone host for the player character customizer (#44), launched ON TOP of the
// world from the pause menu. It reuses the generic customizer shell + nav (the same
// swatch grids / option pills / scroll / focus nav the animal editors use): the player
// is just another data-driven "parts" subject (see data/customize.js), with shape
// OPTION parts (hairstyle / sleeves / bottoms) alongside colour parts.
//
// Unlike the live-only dev art-preview customizer, the player's look PERSISTS to
// localStorage (savePlayerLook) so it survives reloads — BootScene rebuilds the player
// textures from it on boot. The shell pauses/hides the world + hotbar while editing and
// restores them on Done/Esc/B, then calls _onCustExit to close this scene.
export default class PlayerCustomizerScene extends WithCustomizerShell(WithCustomizerNav(Phaser.Scene)) {
  constructor() {
    super('PlayerCustomizerScene');
  }

  create() {
    applyDpr(this, { topLeft: true });
    this._mode = 'edit';
    // In-memory "model" carrying the persisted look-keys; the shell sets model.look on
    // each edit and we persist it. previewFrames give the shell a down-facing walk cycle
    // to animate (the player has no idle_0/idle_1 sheet, only directional walk frames).
    const model = { look: loadPlayerLook() };
    this.custEnterFor({
      speciesId: 'player',
      key: 'player',
      model,
      persist: () => savePlayerLook(model.look),
      previewFrames: [
        { key: 'player_down_0' }, { key: 'player_down_1' },
        { key: 'player_down_2' }, { key: 'player_down_3' },
      ],
      previewFrameRate: 6,
    });
  }

  update() {
    if (this._mode === 'edit') this._pollEditPad();
  }

  // The shell's custExit() has already resumed + shown the world/hotbar; close ourselves.
  _onCustExit() {
    this.scene.stop();
  }
}
