// Recipe book panel (#214) — a small, simple toggle-able list of every recipe the
// player has discovered so far by successfully cooking a valid ingredient combo at
// the stove. Deliberately NOT a new scene/screen: just a screen-fixed text panel
// over the house interior, toggled with [R] anywhere in the house (mirrors the
// stove's own contextual-prompt hint, which advertises the key). `this` is
// HouseInteriorScene; split into its own mixin file so houseInteriorCooking.js and
// HouseInteriorScene.js stay focused (mirrors the houseInteriorDecor.js split).

import Phaser from 'phaser';
import { RECIPE_LIST } from '../data/cooking.js';
import { CONTENT_DEFS } from '../data/items.js';
import { logicalW, logicalH, dprOf } from './uiUtils.js';

export const WithHouseInteriorRecipeBook = (Base) => class extends Base {
  // Built once from create(); starts hidden. A screen-fixed backdrop + text block,
  // same layering trick as the contextual prompt (setScrollFactor(0), high depth).
  _buildRecipeBookUI() {
    this.recipeBookOpen = false;
    this._recipeBookBackdrop = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(1990).setVisible(false);
    this._recipeBookText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px',
      color: '#fff3dd', align: 'left', lineSpacing: 6,
    }).setScrollFactor(0).setDepth(2000).setVisible(false);
    this._layoutRecipeBook();
    this.scale.on('resize', this._layoutRecipeBook, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._layoutRecipeBook, this);
    });
  }

  // [R] toggles the panel from anywhere in the house — simplest possible reach from
  // the stove interaction without a dedicated button/second scene.
  _checkRecipeBookInput() {
    if (Phaser.Input.Keyboard.JustDown(this.rKey)) this._toggleRecipeBook();
  }

  _toggleRecipeBook() {
    this.recipeBookOpen = !this.recipeBookOpen;
    if (this.recipeBookOpen) this._renderRecipeBookText();
    this._recipeBookBackdrop.setVisible(this.recipeBookOpen);
    this._recipeBookText.setVisible(this.recipeBookOpen);
  }

  _renderRecipeBookText() {
    const discovered = RECIPE_LIST.filter((r) => this.recipeBook.includes(r.id));
    const lines = ['Recipe Book  (R to close)', ''];
    if (discovered.length === 0) {
      lines.push('No recipes discovered yet.', 'Try combining ingredients at the stove!');
    } else {
      for (const r of discovered) {
        const ingredients = r.ingredients
          .map((ing) => `${ing.amount} ${CONTENT_DEFS[ing.content]?.label ?? ing.content}`)
          .join(' + ');
        lines.push(`${r.label}  —  ${ingredients}`);
      }
    }
    this._recipeBookText.setText(lines.join('\n'));
  }

  // Centred-camera scrollFactor-0 overlays need the DPR offset (see uiUtils / the
  // scene's own _layoutFixed for the prompt) — without it the panel drifts off the
  // physical screen centre at DPR>1 (the owner's iPad, DPR 2).
  _layoutRecipeBook() {
    const sw = logicalW(this), sh = logicalH(this);
    const k = (dprOf(this) - 1) / 2;
    const cx = sw / 2 + sw * k, cy = sh / 2 + sh * k;
    const w = Math.min(sw - 40, 420), h = Math.min(sh - 80, 260);
    this._recipeBookBackdrop?.setSize(w, h).setPosition(cx, cy);
    this._recipeBookText?.setPosition(cx - w / 2 + 16, cy - h / 2 + 14);
  }
};
