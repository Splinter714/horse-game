import Phaser from 'phaser';
import { applyDpr } from './uiUtils.js';
import { WithCustomizerShell } from './customizer/shell.js';
import { WithCustomizerNav } from './customizer/nav.js';
import { WithHorseSections } from './customizer/horse.js';

// Standalone host for the general animal customizer (#166), launched ON TOP of a host
// scene — currently the dev Art-preview gallery. It owns no content of its own: it just
// composes the shell + horse sections and opens the editor for one creature, then stops
// itself on exit (the gallery underneath is paused + hidden meanwhile, then restored).
//
// Used for live art-direction only, so there's no persistence here — the shell re-skins
// the creature's textures in place and the changes vanish on reload (#165 decision).

export default class CustomizerScene extends WithCustomizerShell(WithCustomizerNav(WithHorseSections(Phaser.Scene))) {
  constructor() {
    super('CustomizerScene');
  }

  // data: { speciesId, key, host } — `host` is the scene key to pause/hide while editing.
  create(data) {
    applyDpr(this, { topLeft: true });
    this._mode = 'edit';
    if (!this.custEnterFor({ speciesId: data.speciesId, key: data.key, host: data.host })) {
      this.scene.stop();
    }
  }

  update() {
    if (this._mode === 'edit') this._pollEditPad();
  }

  // The shell's custExit() has already resumed + shown the host scene; close ourselves.
  _onCustExit() {
    this.scene.stop();
  }
}
