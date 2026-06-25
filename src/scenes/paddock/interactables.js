// World interactables — the static props you activate with the primary action
// (gate, barn, trough, gathering sources, nests, farm stand). Each is a
// self-describing descriptor so both input paths (handleTap and the proximity
// pass) share one declarative list instead of two parallel blocks — adding an
// activatable object is a single descriptor. Extracted from player.js (issue #167).
//
// A descriptor is a function instances(item) returning zero or more activatable
// instances for the currently held item/context. Each instance is fully
// self-describing:
//   { x, y, tapRadius, reachDist, promptOffsetY, canAct, label,
//     approach(world), activate() }
// Singletons return a one-element array; collections (sources, nests) return one
// entry per instance. canAct:false still shows a passive hint prompt (e.g.
// "carrier full", "equip a Basket") but can't be triggered.

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { TROUGH_CAP, PASTURE_BOUNDS, STAND_DEFS } from './constants.js';

export const WithInteractables = (Base) => class extends Base {
  buildInteractables() {
    const gate = () => {
      const g = this.props.gate;
      if (!g) return [];
      return [{
        x: g.x, y: g.y, tapRadius: 90, reachDist: 100, promptOffsetY: 80,
        canAct: true, label: `${g.open ? 'Close' : 'Open'} Gate`,
        approach: () => ({ x: g.x, y: g.y + (this.player.sprite.y < g.y ? -70 : 70) }),
        activate: () => this.toggleGate(),
      }];
    };

    const barn = () => {
      const b = this.props.barn;
      if (!b) return [];
      return [{
        x: b.x, y: b.y, tapRadius: 130, reachDist: 150, promptOffsetY: 40,
        canAct: true, label: 'Sleep',
        approach: () => ({ x: b.x, y: b.y + 95 }), // walk to just below the barn
        activate: () => this.sleep(),
      }];
    };

    const trough = (item) => {
      const t = this.props.trough;
      // Offer "Fill Trough" until it's brim-full, so you can pour bucket after
      // bucket to top it up (#103) — not just when it's bone dry.
      if (!t || t.level >= TROUGH_CAP || item?.content !== 'water') return [];
      return [{
        x: t.x, y: t.y, tapRadius: 200, reachDist: 145, promptOffsetY: 40,
        canAct: true, label: 'Fill Trough',
        // Walk to the side the player is on: the well side (just north of the
        // fence) to fill over it, or just inside the pasture from the south (#106).
        approach: (world) => {
          const refY = world ? world.y : this.player.sprite.y;
          const onWellSide = refY < t.y;
          return { x: t.x, y: onWellSide ? PASTURE_BOUNDS.minY - 34 : t.y + 56 };
        },
        activate: () => this.fillTrough(),
      }];
    };

    const sources = (item) => {
      if (!item || item.type !== 'carrier') return [];
      return this.props.sources
        .filter(s => item.accepts.includes(s.content))
        .map(s => {
          // Food gathers one unit per animal that eats it (#136); other contents
          // (water) just fill to capacity. `target` is what a full gather lands on.
          const target = this._gatherTarget(s.content, item.capacity);
          const have   = item.content === s.content ? item.count : 0;
          const full   = have >= target;
          const fullMsg = have >= item.capacity ? 'carrier full' : 'enough gathered';
          return {
            x: s.x, y: s.y, tapRadius: 120, reachDist: s.reach, promptOffsetY: 80,
            canAct: !full,
            label: full ? `${s.label}  •  ${fullMsg}`
                        : `Gather ${CONTENT_DEFS[s.content].label}`,
            approach: (world) => {
              const refX = world ? world.x : this.player.sprite.x;
              return { x: s.x + (refX < s.x ? -1 : 1) * 70, y: s.y + 10 };
            },
            activate: () => this.gatherFrom(s),
          };
        });
    };

    const nests = (item) => {
      const hasBasket = item?.carrier === 'basket';
      return this.props.nests
        .filter(n => n.hasEgg)
        .map(n => ({
          x: n.x, y: n.y, tapRadius: 100, reachDist: 80, promptOffsetY: 30,
          canAct: hasBasket,
          label: hasBasket ? 'Collect Egg' : 'Egg in nest  •  equip a Basket to collect',
          approach: () => ({ x: n.x, y: n.y + 45 }),
          activate: () => this.collectEgg(n),
        }));
    };

    const farmStand = (item) => {
      const s = this.farmStand;
      const type = item?.content;
      const sellable = s && STAND_DEFS[type] && item.count > 0;
      if (!sellable) return []; // stock is shown visually; only prompt to deposit
      return [{
        x: s.x, y: s.y, tapRadius: 160, reachDist: 120, promptOffsetY: 100,
        canAct: true, label: `Sell ${CONTENT_DEFS[type].label}  (basket: ${item.count})`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: s.x + (refX < s.x ? -1 : 1) * 90, y: s.y + 20 };
        },
        activate: () => this.stockStand(),
      }];
    };

    this.interactables = [gate, barn, trough, sources, nests, farmStand];
    // Split by input: gate/barn are bare-hand "interact" targets (tap/click/E);
    // the rest require a carried tool/carrier and are triggered by Use (the
    // on-screen button / F / controller). See useActiveTool + handleTap.
    this.interactWorld = [gate, barn];
    this.toolWorld     = [trough, sources, nests, farmStand];
  }

  // Nearest activatable instance to (x, y) within each instance's own radius
  // (tapRadius for taps, reachDist for the keyboard), searching the given list of
  // interactable descriptors (defaults to all).
  _nearestInteractable(x, y, item, radiusKey, list = this.interactables) {
    let best = null, bestDist = Infinity;
    for (const instancesOf of list) {
      for (const inst of instancesOf(item)) {
        const d = Phaser.Math.Distance.Between(x, y, inst.x, inst.y);
        if (d <= inst[radiusKey] && d < bestDist) { bestDist = d; best = inst; }
      }
    }
    return best;
  }

  // Tap landed on a world interactable? Walk to it and activate on arrival.
  _tapInteractable(world, item) {
    const inst = this._nearestInteractable(world.x, world.y, item, 'tapRadius', this.interactWorld);
    if (!inst || !inst.canAct) return false;
    const dest = inst.approach(world);
    this.tapMoveTo(dest.x, dest.y, () => inst.activate());
    return true;
  }

  // Player standing next to a world interactable? Queue its prompt; activate on
  // key press. Non-actionable instances show a passive hint (no key prefix).
  _proximityInteractable(item, useJust) {
    const inst = this._nearestInteractable(this.player.sprite.x, this.player.sprite.y, item, 'reachDist', this.interactWorld);
    if (!inst) return false;
    this._pushPrompt(inst.canAct ? 'interact' : null, inst.label);
    if (inst.canAct) this._interactAction = { label: inst.label, run: () => inst.activate() };
    if (useJust && inst.canAct) inst.activate();
    return true;
  }
};
