// House entry/exit (#56) — the seam between the world (PaddockScene) and the
// enterable interior (HouseInteriorScene). The house door's interactable calls
// enterHouse(): we pause the world scenes (paddock + day/night + hotbar) and start
// the interior on top. When the player walks back out, HouseInteriorScene emits
// EVENTS.EXIT_HOUSE and _onExitHouse() resumes everything. Applied as a functional
// mixin (like world/barn); method names are unique (house*/_*House) for the guard.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';

export const WithHouseEntry = (Base) => class extends Base {
  // Wire the exit event once, from create(). PaddockScene calls this alongside its
  // other game-event subscriptions; it self-removes on shutdown.
  bindHouseEntry() {
    this.game.events.on(EVENTS.EXIT_HOUSE, this._onExitHouse, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EVENTS.EXIT_HOUSE, this._onExitHouse, this);
    });
  }

  // Walk-in: freeze the world + its UI and hand off to the interior scene. Guard
  // against a double-enter while already inside (the interactable can fire twice
  // during the walk-up arrival).
  enterHouse() {
    if (this._inHouse) return;
    this._inHouse = true;
    // Clear any lingering prompt/nav so the world is quiet under the interior.
    this._promptLines = [];
    this.promptPanel?.setVisible(false);
    this.navPath = null; this.navOnArrive = null;

    // Pause the world + day/night clock, sleep the hotbar UI (hidden while inside).
    this.scene.pause();
    this.scene.pause('DayNightScene');
    this.scene.sleep('HotbarScene');
    this.scene.launch('HouseInteriorScene');
    this.scene.bringToTop('HouseInteriorScene');
  }

  // Walk-out: interior signalled EXIT_HOUSE (it stops itself). Resume the world.
  _onExitHouse() {
    if (!this._inHouse) return;
    this._inHouse = false;
    this.scene.resume();
    this.scene.resume('DayNightScene');
    this.scene.wake('HotbarScene');
    this.scene.bringToTop('DayNightScene'); // keep the lighting tint above the world
    this.scene.bringToTop('HotbarScene');
  }
};
