// Player meal buff read-side (#277) — a cooked meal eaten at the house pantry
// grants a short move-speed + "chore energy" pick-me-up (see ../../data/playerBuff.js
// for the pure shape/rules). This mixin only READS the live buff, off the shared game
// registry (`playerBuff` key, mirrors `viewingAnimal`) so it survives the PaddockScene
// ⇄ HouseInteriorScene handoff, plus a small always-on-top status readout so it's
// visible while it lasts. HouseInteriorScene's cooking mixin (houseInteriorCooking.js)
// is what SETS it, on eating a pantry dish.

import { speedMult, choreMult, buffSecondsLeft } from '../../data/playerBuff.js';

export const WithPlayerBuff = (Base) => class extends Base {
  // Current buff record straight off the registry (null once absent/never eaten).
  _playerBuff() {
    return this.registry.get('playerBuff') ?? null;
  }

  // 1 (no-op) unless a meal buff is active right now. playerMovement.js scales the
  // walk speed by this; interaction.js/careActions.js scale pet/brush by the other.
  _buffSpeedMult() { return speedMult(this._playerBuff()); }
  _buffChoreMult() { return choreMult(this._playerBuff()); }

  // A small "well fed" readout, fixed to the top-left of the screen (mirrors
  // promptPanel's fixed-to-camera style in player.js). Hidden whenever no buff
  // is active — this is the whole "visible somehow" ask from #277.
  buildPlayerBuffHud() {
    this.buffHud = this.add.text(14, 14, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold',
      color: '#fff3c4', backgroundColor: '#00000080', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(9999).setVisible(false);
  }

  updatePlayerBuffHud() {
    const secs = buffSecondsLeft(this._playerBuff());
    if (secs <= 0) { this.buffHud.setVisible(false); return; }
    const m = Math.floor(secs / 60), s = secs % 60;
    this.buffHud.setText(`⚡ Well Fed  ${m}:${String(s).padStart(2, '0')}`).setVisible(true);
  }
};
