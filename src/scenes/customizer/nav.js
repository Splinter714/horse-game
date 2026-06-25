import Phaser from 'phaser';
import { dprOf } from '../uiUtils.js';

// Scroll + controller/keyboard focus navigation for the customizer shell (#147).
// Split out of shell.js to keep each customizer file under the size budget (#167/#169).
// It operates on the same instance state the shell sets up (panel rect, viewport,
// content container, the `_focusables` list), so it's just a behavioural slice of the
// one customizer prototype — the host composes it alongside the shell.

export const WithCustomizerNav = (Base) => class extends Base {
  // ── Scrolling ───────────────────────────────────────────────────────────────
  _installScrollInput() {
    this.input.on('wheel', (_p, _go, _dx, dy) => this._setScroll(this.scrollY + dy * 0.5));
    this.input.on('pointerdown', (p) => {
      if (this._focusActive) { this._focusActive = false; this._focusRing?.clear(); }
      if (!this._inView(p)) return;
      this._drag = true; this._dragMoved = false;
      this._dragStartY = p.y / dprOf(this); this._dragStartScroll = this.scrollY;
    });
    this.input.on('pointermove', (p) => {
      if (!this._drag || !p.isDown) return;
      const dy = p.y / dprOf(this) - this._dragStartY;
      if (Math.abs(dy) > 6) this._dragMoved = true;
      this._setScroll(this._dragStartScroll - dy);
    });
    this.input.on('pointerup', () => { this._drag = false; });
  }

  _inView(p) {
    const dpr = dprOf(this);
    const x = p.x / dpr, y = p.y / dpr;
    return x >= this.px && x <= this.px + this.panelW && y >= this.viewTop && y <= this.viewBottom;
  }

  _setScroll(v) {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.scrollMax || 0);
    if (this.contentC) this.contentC.y = this.viewTop - this.scrollY;
    this._updateScrollbar();
    if (this._focusActive) this._refreshFocusRing();
  }

  // ── Controller / keyboard focus navigation (#147) ─────────────────────────────
  _screenRect(f) {
    return f.fixed ? f : { x: this.px + f.x, y: this.viewTop - this.scrollY + f.y, w: f.w, h: f.h };
  }

  _moveFocus(dx, dy) {
    if (this._mode !== 'edit' || !this._focusables.length) return;
    if (!this._focusActive) { this._focusActive = true; this._focusIdx = 0; this._scrollToFocus(); this._refreshFocusRing(); return; }
    const cur = this._focusables[this._focusIdx];
    const a = this._screenRect(cur), ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    let best = -1, bestScore = Infinity;
    this._focusables.forEach((f, i) => {
      if (i === this._focusIdx) return;
      const r = this._screenRect(f), bx = r.x + r.w / 2, by = r.y + r.h / 2;
      const ddx = bx - ax, ddy = by - ay;
      if (dx > 0 && ddx <= 4) return; if (dx < 0 && ddx >= -4) return;
      if (dy > 0 && ddy <= 4) return; if (dy < 0 && ddy >= -4) return;
      const along = dx !== 0 ? Math.abs(ddx) : Math.abs(ddy);
      const cross = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
      const score = along + cross * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { this._focusIdx = best; this._scrollToFocus(); this._refreshFocusRing(); }
  }

  _activateFocus() {
    if (this._mode !== 'edit') return;
    if (!this._focusActive) { this._focusActive = true; this._focusIdx = 0; this._scrollToFocus(); this._refreshFocusRing(); return; }
    this._focusables[this._focusIdx]?.activate?.();
  }

  _scrollToFocus() {
    const f = this._focusables[this._focusIdx];
    if (!f || f.fixed) return;
    const topY = this.viewTop - this.scrollY + f.y;
    const botY = topY + f.h;
    if (topY < this.viewTop) this._setScroll(this.scrollY - (this.viewTop - topY) - 8);
    else if (botY > this.viewBottom) this._setScroll(this.scrollY + (botY - this.viewBottom) + 8);
  }

  _refreshFocusRing() {
    if (!this._focusRing) return;
    this._focusRing.clear();
    if (!this._focusActive) return;
    const f = this._focusables[this._focusIdx];
    if (!f) return;
    const r = this._screenRect(f);
    this._focusRing.lineStyle(3, 0xffffff, 0.95);
    this._focusRing.strokeRoundedRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
  }

  // Poll the gamepad while editing: d-pad/stick moves focus, A activates, B exits.
  _pollEditPad() {
    const pad = this.input.gamepad && this.input.gamepad.getPad(0);
    if (!pad) return;
    const p = this._padPrev || {};
    const ls = pad.leftStick || { x: 0, y: 0 };
    const cur = {
      left: pad.left || ls.x < -0.5, right: pad.right || ls.x > 0.5,
      up: pad.up || ls.y < -0.5, down: pad.down || ls.y > 0.5,
      A: pad.A, B: pad.B,
    };
    if (cur.left && !p.left) this._moveFocus(-1, 0);
    if (cur.right && !p.right) this._moveFocus(1, 0);
    if (cur.up && !p.up) this._moveFocus(0, -1);
    if (cur.down && !p.down) this._moveFocus(0, 1);
    if (cur.A && !p.A) this._activateFocus();
    if (cur.B && !p.B) this.custExit();
    this._padPrev = cur;
  }

  _buildScrollbar() {
    this._sb?.destroy();
    this._sb = this.add.graphics().setDepth(6);
    this._updateScrollbar();
  }

  _updateScrollbar() {
    if (!this._sb) return;
    this._sb.clear();
    if (!this.scrollMax) return;
    const trackX = this.px + this.panelW - 7, trackH = this.viewH;
    const thumbH = Math.max(28, trackH * (this.viewH / this.contentH));
    const thumbY = this.viewTop + (trackH - thumbH) * (this.scrollY / this.scrollMax);
    this._sb.fillStyle(0x3a4060, 0.5); this._sb.fillRoundedRect(trackX, this.viewTop, 4, trackH, 2);
    this._sb.fillStyle(0xffe066, 0.85); this._sb.fillRoundedRect(trackX, thumbY, 4, thumbH, 2);
  }
};
