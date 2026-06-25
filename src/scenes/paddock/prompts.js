// Contextual control prompts — the fixed bottom-left hint panel (#101) and the
// per-frame resolution of what each action would do: the {interact, info, use}
// label set broadcast to HotbarScene's on-screen touch buttons, and the tool/Use
// proximity labeling. Mode-aware (key/pad/touch). Extracted from player.js as its
// own concern (issue #167).

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { USE_REACH } from './constants.js';
import { logicalH, worldUiOffset } from '../uiUtils.js';

export const WithPrompts = (Base) => class extends Base {
  // Which input the player is currently using, for prompt formatting.
  _promptMode() {
    if (this.usingPad)   return 'pad';
    if (this.usingTouch) return 'touch';
    return 'key';
  }

  // A physical keyboard action (move / E / C / F) puts prompts in keyboard mode.
  _useKeyboard() { this.usingPad = false; this.usingTouch = false; }

  // The key/button glyph for an action in the current mode. Touch has no
  // physical keys (you tap the world / the on-screen Use button), so the touch
  // hint is carried by _promptLine's verb instead and this returns ''.
  _glyph(action) {
    if (this._promptMode() === 'touch') return '';
    const pad = this.usingPad;
    switch (action) {
      case 'interact': return pad ? '[ A ]' : '[ E ]';
      case 'info':     return pad ? '[ Y ]' : '[ C ]';
      case 'use':      return pad ? '[ X ]' : '[ F ]';
      default:         return '';
    }
  }

  // Compose one prompt line. `action` null = a passive hint (no control glyph).
  // On touch, a leading verb ("Tap:", "Use:") stands in for the missing glyph.
  _promptLine(action, label) {
    if (!action) return label;
    if (this._promptMode() === 'touch') {
      const verb = { interact: 'Tap:', info: 'Double-tap:', use: 'Use:' }[action];
      return verb ? `${verb}  ${label}` : label;
    }
    return `${this._glyph(action)}  ${label}`;
  }

  _pushPrompt(action, label) {
    (this._promptLines ??= []).push(this._promptLine(action, label));
  }

  // Draw the accumulated lines into the fixed bottom-left panel (or hide it). On
  // touch the panel is replaced entirely by the on-screen action buttons (#101),
  // so it's hidden there; keyboard/gamepad keep it. Called once per frame after
  // the interact + tool proximity passes have queued their lines.
  _renderPrompts() {
    const panel = this.promptPanel;
    if (!panel) return;
    const lines = this._promptLines ?? [];
    if (this._promptMode() === 'touch' || !this.promptsOn || !lines.length) {
      panel.setVisible(false);
      return;
    }
    panel.setText(lines.join('\n'));
    // Screen-fixed overlay on the centred-origin world camera — offset to compensate.
    const o = worldUiOffset(this);
    panel.setPosition(12 + o.x, logicalH(this) - 84 + o.y).setVisible(true);
  }

  // Build the {interact, info, use} action set and broadcast it when it changes,
  // so HotbarScene can show/label the on-screen touch buttons (#101). Runs every
  // frame after the proximity passes have set _interactAction / _infoAction /
  // _useActionLabel. Emits in all modes (cheap, change-gated); the buttons only
  // render in touch mode.
  _syncActionButtons() {
    const actions = {
      interact: this._interactAction?.label ?? null,
      info:     this._infoAction?.label ?? null,
      use:      this._useActionLabel ?? null,
    };
    const sig = `${actions.interact}|${actions.info}|${actions.use}`;
    if (sig !== this._lastActionsSig) {
      this._lastActionsSig = sig;
      this.game.events.emit(EVENTS.ACTIONS_CHANGED, actions);
    }
  }

  // Invoked by the on-screen Interact / Info buttons (touch). Each runs whatever
  // the current contextual action is (pet/mount/gate/sleep/dismount, or info).
  triggerInteract() {
    if (this._paused || this._sleeping) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    this._interactAction?.run?.();
  }

  triggerInfo() {
    if (this._paused || this._sleeping) return;
    if (this.scene.get('HotbarScene')?.invOpen) return;
    this._infoAction?.run?.();
  }

  // Display name for a horse/chicken/cat key, for naming prompt targets (#101).
  _animalName(key) {
    const h = this.registry.get('allHorses')?.[key];
    if (h?.name) return h.name;
    const a = this.animals?.find(x => x.key === key);
    return a?.model?.name ?? null;
  }

  // Per-frame: resolve the equipped tool/carrier's Use action (#83) — both the
  // panel prompt line (keyboard/gamepad) and the on-screen Use button label
  // (touch, via _useActionLabel). The label says exactly what Use would do,
  // naming the content where relevant ("Gather Water", "Feed Hay", "Sell
  // Apples"). _useActionLabel is null unless an action is actually in reach, so
  // the touch Use button only appears when there's something to use. The action
  // itself fires on F / X / the Use button.
  checkToolProximity() {
    let useLabel = null;
    const finish = () => { this._useActionLabel = useLabel; };

    if (this.riding ||
        this.scene.get('HotbarScene')?.invOpen ||
        this.scene.isActive('InfoPanelScene')) return finish();

    const item = this.getActiveItem();
    if (!item || item.action === 'interact') return finish();

    const { player } = this;

    // Direct animal care (#cow): mirror useActiveTool's dispatch so the Use prompt
    // names what it would do (Feed / Water / Milk) whenever a feedable/milkable animal
    // is in reach with the right carrier. Generic over species (#167 B3).
    const careAct = this._animalUseAction(item);
    if (careAct) {
      useLabel = careAct.label;
      this._pushPrompt('use', careAct.label);
      return finish();
    }

    // Animal-targeted tools: brush / saddle / lead on the nearest valid horse.
    if (item.action === 'brush' || item.action === 'saddle' || item.action === 'lead') {
      const target = this._nearestToolHorse(item);
      const d = target && Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y, target.sprite.x, target.sprite.y);
      if (target && d <= USE_REACH) {
        const who = this._animalName(target.key);
        let label;
        if (item.action === 'saddle')    label = target.saddled ? 'Unsaddle' : 'Saddle';
        else if (item.action === 'lead') label = this.leadHorses.includes(target) ? 'Stop Leading' : 'Lead';
        else                             label = 'Brush';
        useLabel = label; // the Use button keeps it about the action (Pet/Info name the animal)
        this._pushPrompt('use', who ? `${label} ${who}` : label);
      }
      return finish();
    }

    // Feed: a carrier holding food. Mirrors useActiveTool's dispatch (#133) — if a
    // world spot is in reach (a gathering source to keep filling, or the stand to
    // sell), the prompt names that action; otherwise it's "Drop" at your feet.
    if (item.action === 'feed') {
      const spot = this._nearestUseSpot(item);
      if (spot) {
        useLabel = spot.label.replace(/\s*\(.*\)\s*$/, '');
        this._pushPrompt('use', spot.label);
      } else {
        useLabel = `Feed ${item.label}`;
        this._pushPrompt('use', `Drop ${item.label}`);
      }
      return finish();
    }

    // World-spot tools (fill trough / fill bucket / gather / collect egg / sell):
    // the nearest actionable instance within reach. The descriptor labels already
    // name the content ("Gather Water", "Collect Egg"); strip any "(basket: n)"
    // tail for the button.
    const inst = this._nearestUseSpot(item);
    if (inst) {
      useLabel = inst.label.replace(/\s*\(.*\)\s*$/, '');
      this._pushPrompt('use', inst.label);
    }
    return finish();
  }
};
