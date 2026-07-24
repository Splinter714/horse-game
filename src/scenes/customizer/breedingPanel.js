// Horse breeding & foals panel controls (#15, redesigned #114; cancel added #322) —
// factored out of InfoPanelScene.js into its own mixin file to keep InfoPanelScene.js
// under the line budget (src/scenes/modularity.test.js), mirroring how the chick
// incubation controls already live in their own file (./incubationPanel.js). Unbonded
// grown horse → "Pair" (marks/forms a PERMANENT bond, no gestation). Already-bonded
// grown horse → separate, repeatable "Breed" (starts a gestation with its bonded
// mate) — or, if a gestation is already in flight, a disabled "Expecting…" state plus
// a "Cancel breeding" button (#322). Foal → "Stay a baby forever" toggle. Horses only.

import { growHitArea } from '../uiUtils.js';

const CARD_W = 300;

export const WithBreedingPanel = (Base) => class extends Base {
  _addBreedingControls(animal, key, y) {
    if (animal.species !== 'horse') return y;
    const paddock = this.scene.get('PaddockScene');
    if (!paddock) return y;

    let cy = y + 6;

    // A newborn foal shows the growth toggle rather than pair/breed buttons.
    if (animal.isFoal) {
      const on = !animal.stayBaby; // "Allow growing up" is the inverse of stayBaby
      const label = animal.stayBaby ? '🍼  Stays a baby forever' : '🌱  Allowed to grow up';
      const toggle = this.add.text(CARD_W / 2, cy, label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px',
        color: on ? '#eafff0' : '#4f4d47', fontStyle: 'bold',
        backgroundColor: on ? '#3a6a44' : '#e3ded3', padding: { x: 12, y: 7 }, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      growHitArea(toggle);
      toggle.on('pointerdown', () => {
        // Flip the toggle. Turning growth ON grows the foal up right away (and the
        // panel will close as the world takes over); otherwise just re-render.
        paddock.setStayBaby(key, !animal.stayBaby);
        if (!animal.isFoal) this.close(); // it grew up — model no longer a foal
        else this.refresh();
      });
      this.panel.add(toggle);
      return cy + toggle.height + 4;
    }

    // Already bonded → the separate, repeatable "Breed" button (monogamous, permanent).
    if (paddock.isBonded?.(key)) {
      // #322: a gestation already in flight for this horse → show a disabled
      // "Expecting…" state plus a Cancel button instead of the active Breed button.
      // The permanent pair bond is untouched either way — cancel only aborts this
      // one gestation (see paddock/breeding.js cancelBreeding).
      if (paddock._isExpecting?.(key)) {
        cy = this._addPinkButton(cy, '🤰  Expecting…', () => {}, { disabled: true });
        return this._addPinkButton(cy, '✋  Cancel breeding', () => {
          const status = paddock.cancelBreeding?.(key);
          this._flashBreedStatus(status);
          this.refresh();
        });
      }
      return this._addPinkButton(cy, '💕  Breed', () => {
        const status = paddock.startBreeding?.(key);
        if (status && status.includes('expecting a foal')) { this.close(); return; }
        this._flashBreedStatus(status);
      });
    }

    // Not yet bonded: the pair button (label reflects any pending mate).
    const mate = paddock.pendingMateName?.(key);
    const label = mate ? `💞  Pair with ${mate}` : '💞  Pair';
    return this._addPinkButton(cy, label, () => {
      const status = paddock.toggleBondSelection?.(key);
      if (status && status.includes('bonded for life')) { this.close(); return; }
      this._flashBreedStatus(status);
    });
  }

  // Shared pink-pill button used by the "Pair"/"Breed"/"Cancel breeding" actions
  // above — same styling, just a label + a click handler. Returns the new bottom-y
  // cursor. `{ disabled: true }` (#322's "Expecting…" state) renders it inert and
  // greyed out, with no click handler wired up.
  _addPinkButton(cy, label, onClick, { disabled = false } = {}) {
    const btn = this.add.text(CARD_W / 2, cy, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: disabled ? '#7a746a' : '#5a1e3a',
      fontStyle: 'bold', backgroundColor: disabled ? '#e3ded3' : '#ffc0d8',
      padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5, 0);
    if (!disabled) {
      btn.setInteractive({ useHandCursor: true });
      growHitArea(btn);
      btn.on('pointerdown', onClick);
    }
    this.panel.add(btn);
    return cy + btn.height + 4;
  }

  // Flash a short breeding/incubation status message under the breed/incubate/cancel
  // button (auto-fades). Shared with the chick incubation panel (./incubationPanel.js).
  _flashBreedStatus(text) {
    if (!text) return;
    this._breedStatus?.destroy();
    this._breedStatus = this.add.text(CARD_W / 2, (this._cardY ? 0 : 0), text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#5a1e3a', fontStyle: 'bold',
      align: 'center', wordWrap: { width: CARD_W - 24 },
    }).setOrigin(0.5, 1).setDepth(20000);
    // Position it just above the card's bottom edge in screen space.
    const y = (this._cardY ?? 0) + (this.panel?.getBounds?.().height ?? 0) - 2;
    this._breedStatus.setPosition((this._cardX ?? 0) + CARD_W / 2, y + 34);
    this.tweens.add({
      targets: this._breedStatus, alpha: 0, y: this._breedStatus.y - 10,
      delay: 1400, duration: 600, ease: 'Sine.easeIn',
      onComplete: () => { this._breedStatus?.destroy(); this._breedStatus = null; },
    });
  }
};
