// House interior — station targeting & activation (#334).
//
// Extracted from HouseInteriorScene so the three ways to use a station live in one
// place and stay consistent:
//   • TAP/CLICK  — pointerdown near the FURNITURE (its drawn centre) walks the player
//                  to the station's stand point and activates on arrival.
//   • KEYBOARD   — [E]/[Space] while standing AT the stand point.
//   • GAMEPAD    — pad A, same reach test as the keyboard.
//
// #334 root cause lived here: the proximity test used for the prompt/keyboard path
// measured the player against the furniture's CENTRE, while the walk-up target is the
// separate `standX/standY` point. For the bed those are 134 world px apart — well
// outside PROMPT_REACH — so the "[E] Sleep" prompt never appeared and the key never
// fired, no matter where the player stood. Tap "worked" only because it activates from
// its own arrival callback, with no proximity gate at all. The prompt/key path now
// measures to the STAND point (where the player is actually meant to be), which is the
// same point tap walks to — so all three routes agree by construction.

import Phaser from 'phaser';

// World px: how close to a station's STAND point counts as "at" it.
const PROMPT_REACH = 70;
// World px: how close a tap has to land to a station's drawn centre to target it.
const TAP_REACH = 90;

export const WithHouseInteriorInteract = (Base) => class extends Base {
  // ── Stations (bed / dresser / pantry / kitchen), data-driven off HOUSE_INTERIOR ──
  _buildStations(HI) {
    this.stations = Object.entries(HI.stations).map(([id, s]) => ({
      id,
      x: this._d(s.x), y: this._d(s.y),
      standX: this._d(s.standX), standY: this._d(s.standY),
      label: s.label, action: s.action,
      // Bed, dresser, pantry (#212), and the stove/oven (#213) are all actionable
      // now — the stove still has no cooking system behind it (#41).
      canAct: true,
    }));
  }

  // Convert a raw pointer (physical/buffer px) to this scene's world coords.
  _pointerWorld(pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  _onTap(pointer) {
    if (this._customizing || this._exiting) return;
    const w = this._pointerWorld(pointer);
    // Tapping near a station walks to it and activates on arrival.
    const st = this._nearestStation(w.x, w.y, TAP_REACH);
    if (st && st.canAct) {
      this._walkTo(st.standX, st.standY, () => this._activate(st));
      return;
    }
    this._walkTo(w.x, w.y, null);
  }

  _walkTo(x, y, onArrive) {
    this._navTarget = {
      x: Phaser.Math.Clamp(x, 12, this.roomW - 12),
      y: Phaser.Math.Clamp(y, 24, this.roomH - 6),
      onArrive,
    };
  }

  // Nearest station to (x,y) within `radius`. `byStand` measures to the walk-up
  // stand point instead of the drawn furniture centre — that's the right frame for
  // "is the player at this station", since the stand point is where walking parks them.
  _nearestStation(x, y, radius, byStand = false) {
    let best = null, bestD = Infinity;
    for (const st of this.stations) {
      const tx = byStand ? st.standX : st.x;
      const ty = byStand ? st.standY : st.y;
      const d = Phaser.Math.Distance.Between(x, y, tx, ty);
      if (d <= radius && d < bestD) { bestD = d; best = st; }
    }
    return best;
  }

  _checkStationPrompt() {
    const p = this.player.sprite;
    // Poll the pad edge EVERY frame (not just in reach) so a button held down while
    // walking up doesn't count as a fresh press the instant the player arrives.
    const padA = this._padInteractJustDown();
    const st = this._nearestStation(p.x, p.y, PROMPT_REACH, true);
    if (!st) { this.prompt.setVisible(false); this._proxStation = null; return; }
    this._proxStation = st;
    const key = st.canAct ? '[E] ' : '';
    const label = st.action === 'kitchen' ? this._kitchenLabel() : st.label;
    this.prompt.setText(`${key}${label}`).setVisible(true);
    // Keyboard / gamepad interact.
    if (st.canAct && (Phaser.Input.Keyboard.JustDown(this.eKey) ||
                      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
                      padA)) {
      this._activate(st);
    }
  }

  // Edge-triggered pad A, polled from the raw Gamepad API like paddock/input.js does
  // (Phaser's cached pad state goes stale across the pause/launch this scene sits on).
  // The interior had NO pad button handling at all before #334 — only the left stick.
  _padInteractJustDown() {
    const raw = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    const down = raw ? (raw.buttons?.[0]?.pressed ?? false) : false;
    const justDown = down && !this._padAPrev;
    this._padAPrev = down;
    return justDown;
  }

  _activate(st) {
    if (st.action === 'sleep') this._doSleep();
    else if (st.action === 'customize') this._openCustomizer();
    else if (st.action === 'pantry') this._usePantry();
    else if (st.action === 'kitchen') this._useKitchen();
  }
};
