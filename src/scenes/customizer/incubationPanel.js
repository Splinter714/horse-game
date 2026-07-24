// Baby chicks panel controls (#274) — a sibling of InfoPanelScene's horse
// _addBreedingControls, factored into its own mixin file to keep InfoPanelScene.js
// under the line budget (src/scenes/modularity.test.js). A grown hen gets an
// "Incubate" button (player-initiated, gated on an eligible rooster being present,
// #269's breedingPartner marker) that starts a fertilized-egg timer right away — a
// single explicit tap since there's only ever one rooster to father the chick (no
// two-step pairing like the horse's Breed flow). A still-a-baby chick gets the
// SAME "Stay a baby forever" toggle as a foal (#298). Calls into PaddockScene's
// WithIncubation mixin (paddock/incubation.js) — a fully parallel system to horse
// breeding (paddock/breeding.js), never touching it.

import { growHitArea } from '../uiUtils.js';

const CARD_W = 300;

export const WithIncubationPanel = (Base) => class extends Base {
  // Only for chickens; other species get nothing. Returns the new bottom-y cursor.
  _addIncubationControls(animal, key, y) {
    if (animal.species !== 'chicken') return y;
    const paddock = this.scene.get('PaddockScene');
    if (!paddock) return y;

    let cy = y + 6;

    // A still-a-baby chick shows the growth toggle rather than an incubate button.
    if (animal.isFoal) {
      const on = !animal.stayBaby; // "Allow growing up" is the inverse of stayBaby
      const label = animal.stayBaby ? '🐣  Stays a baby forever' : '🌱  Allowed to grow up';
      const toggle = this.add.text(CARD_W / 2, cy, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px',
        color: on ? '#eafff0' : '#4f4d47', fontStyle: 'bold',
        backgroundColor: on ? '#3a6a44' : '#e3ded3', padding: { x: 12, y: 7 }, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      growHitArea(toggle);
      toggle.on('pointerdown', () => {
        paddock.setChickStayBaby(key, !animal.stayBaby);
        if (!animal.isFoal) this.close(); // it grew up — model no longer a chick
        else this.refresh();
      });
      this.panel.add(toggle);
      return cy + toggle.height + 4;
    }

    // Grown hen: the incubate button. Only offered when a rooster is present —
    // otherwise nothing is shown, rather than a button that always fails (the
    // rooster requirement, #269's breedingPartner marker this issue was waiting on).
    if (!paddock._hasBreedingRooster?.()) return y;
    const already = paddock._isIncubating?.(key);

    // #322: already incubating → a disabled "Incubating…" state plus an active
    // "Cancel incubation" button, instead of an inert label with no way out.
    if (already) {
      const incBtn = this.add.text(CARD_W / 2, cy, '🥚  Incubating…', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#7a746a',
        fontStyle: 'bold', backgroundColor: '#e3ded3', padding: { x: 14, y: 8 }, align: 'center',
      }).setOrigin(0.5, 0);
      this.panel.add(incBtn);
      cy += incBtn.height + 4;

      const cancelBtn = this.add.text(CARD_W / 2, cy, '✋  Cancel incubation', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#5a1e3a',
        fontStyle: 'bold', backgroundColor: '#ffc0d8', padding: { x: 14, y: 8 }, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      growHitArea(cancelBtn);
      cancelBtn.on('pointerdown', () => {
        const status = paddock.cancelIncubation?.(key);
        this._flashBreedStatus(status);
        this.refresh();
      });
      this.panel.add(cancelBtn);
      cy += cancelBtn.height + 4;
      return cy;
    }

    const incBtn = this.add.text(CARD_W / 2, cy, '🥚  Incubate', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#5a1e3a',
      fontStyle: 'bold', backgroundColor: '#ffc0d8', padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    growHitArea(incBtn);
    incBtn.on('pointerdown', () => {
      const status = paddock.startIncubation?.(key);
      this._flashBreedStatus(status);
      this.refresh();
    });
    this.panel.add(incBtn);
    cy += incBtn.height + 4;
    return cy;
  }
};
