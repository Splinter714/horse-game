// Garden plot (#242) — the crop-farming concern: a fixed tilled garden bed with a grid
// of plantable slots. Plant a crop (bare-hand interact, cycling through the starter set),
// water it (Use with a filled water bucket, #245 — a planted slot only advances a growth
// stage on a day it was watered; unwatered growth stalls, never reverses), watch it grow
// one stage per day/night cycle (advanceGarden is called from the dawn roll, gated on
// watering), then harvest a ripe slot into a basket (Use) and sell the crop at the farm
// stand via the existing basket → stand pipeline.
//
// Applied as a functional mixin (this = the PaddockScene). The pure state lives in
// data/garden.js (unit-tested); this file owns the sprites, world placement, and the
// interactable wiring. Everything crop-specific is data (data/crops.js) so a new crop is
// a table entry + art, not an edit here.

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { loadGarden, saveGarden } from '../../data/save.js';
import {
  GARDEN_SLOTS, emptyGarden, plant, advanceDay, resetWateredFlags, harvest,
  firstEmptySlot, slotRipe, slotWatered, waterSlot as waterGardenSlot, nextCrop,
} from '../../data/garden.js';
import { getCrop, stageTexture } from '../../data/crops.js';
import { S } from './constants.js';
import { playGather, playSplash } from '../../audio/sounds.js';

// Where the garden bed sits (bottom-centre origin), and how its 6 slots are laid out —
// a 3-wide × 2-deep grid of planting spots over the tilled bed. Farm-yard, north of the
// pasture fence, on open ground near the other stations.
const PLOT = { x: 1500, y: 560 };
const SLOT_COLS = 3;
const SLOT_DX = 52;   // horizontal gap between slot centres (world px)
const SLOT_DY = 40;   // vertical gap between the two rows
const SLOT_X0 = -SLOT_DX; // left column offset from plot centre
const SLOT_Y0 = -78;  // top row offset from the bed's base (origin bottom-centre)

export const WithGarden = (Base) => class extends Base {
  // Build the garden bed, its slot positions, load the saved crops, and draw them.
  buildGarden() {
    const bedSprite = this.add.image(PLOT.x, PLOT.y, 'gardenPlot')
      .setScale(S).setDepth(PLOT.y - 40).setOrigin(0.5, 1);

    // Compute the world position of each planting slot (row-major, matching the data
    // array index) so slot i in the model maps to a fixed spot on the bed.
    const slots = [];
    for (let i = 0; i < GARDEN_SLOTS; i++) {
      const col = i % SLOT_COLS;
      const row = Math.floor(i / SLOT_COLS);
      slots.push({
        x: PLOT.x + SLOT_X0 + col * SLOT_DX,
        y: PLOT.y + SLOT_Y0 + row * SLOT_DY,
        sprite: null,
      });
    }

    this.garden = {
      x: PLOT.x, y: PLOT.y, sprite: bedSprite, slots,
      state: loadGarden() ?? emptyGarden(),
    };

    // The bed is a solid obstacle so animals/player walk around it (like the compost
    // bin / spinning wheel). Covers the tilled area, base at the bed's foot.
    this.obstacles.push({ x: PLOT.x - 60, y: PLOT.y - 74, w: 120, h: 74 });

    this._renderGarden();
  }

  // (Re)draw every slot's crop sprite from the current state. Empty slots show nothing;
  // a planted slot shows its crop's stage texture. Called on build, plant, harvest, and
  // after a day's growth.
  _renderGarden() {
    const gd = this.garden;
    if (!gd) return;
    gd.slots.forEach((slot, i) => {
      slot.sprite?.destroy();
      slot.sprite = null;
      const cell = gd.state[i];
      if (!cell) return;
      slot.sprite = this.add.image(slot.x, slot.y, stageTexture(cell.crop, cell.stage))
        .setScale(S).setDepth(slot.y).setOrigin(0.5, 1);
    });
  }

  _saveGardenState() {
    if (this.garden) saveGarden(this.garden.state);
  }

  // The crop the plot will plant next: cycle from the last-planted crop so repeated
  // planting lays down a mix (kid-friendly). Tracked on the garden so the prompt can
  // preview which crop the next plant drops.
  _nextPlantCrop() {
    return this.garden?._nextCrop ?? nextCrop(null);
  }

  // Plant the next crop in the rotation into the first empty slot. No-op if the plot is
  // full. Free starter seeds (no seed inventory in v1) — just walk up and plant.
  plantNextCrop() {
    const gd = this.garden;
    if (!gd) return;
    const i = firstEmptySlot(gd.state);
    if (i < 0) return; // plot full
    const cropId = this._nextPlantCrop();
    gd.state = plant(gd.state, i, cropId);
    gd._nextCrop = nextCrop(cropId); // advance the rotation for the next plant
    this._saveGardenState();
    this._renderGarden();
    playGather('seed'); // soft scatter, like sowing seeds
    const slot = gd.slots[i];
    this.showIcon(getCrop(cropId).seedIcon, slot.sprite ?? { x: slot.x, y: slot.y });
  }

  // Harvest a ripe slot into the active basket: the crop's yield of its harvest content
  // fills the basket, the slot goes back to empty (ready to replant). No-op if the slot
  // isn't ripe or the carrier can't take the crop.
  harvestSlot(i) {
    const gd = this.garden;
    if (!gd || !slotRipe(gd.state, i)) return;
    const cell = gd.state[i];
    const content = getCrop(cell.crop).harvest;
    const { garden: next, yield: amount } = harvest(gd.state, i);
    if (amount <= 0) return;
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier(content, amount) ?? 0;
    if (added <= 0) return; // basket full / wrong carrier — leave the crop standing
    gd.state = next;
    this._saveGardenState();
    this._renderGarden();
    playGather(content);
    const slot = gd.slots[i];
    this.showIcon(CONTENT_DEFS[content].icon, { x: slot.x, y: slot.y });
  }

  // Advance the whole garden one growth stage — called once per dawn from the day roll
  // (dayNight.js `_dawnNewDay`), so sleeping a night passes crop-growing time. Gated on
  // each slot's `watered` flag (#245): an unwatered slot holds instead of growing. Reset
  // the flags for the fresh day AFTER advancing, so last night's watering is what gated
  // last night's growth. No real-time timers.
  advanceGarden() {
    const gd = this.garden;
    if (!gd) return;
    gd.state = advanceDay(gd.state);
    gd.state = resetWateredFlags(gd.state);
    this._saveGardenState();
    this._renderGarden();
  }

  // Water a planted slot (#245): flips its `watered` flag so the next dawn's growth
  // tick advances it instead of stalling. No-op if the slot is empty or already
  // watered (waterGardenSlot is itself a no-op-if-unnecessary, kept as a guard here too
  // so we skip the sound/save/redraw when there's nothing to do).
  waterSlot(i) {
    const gd = this.garden;
    if (!gd) return;
    const cell = gd.state[i];
    if (!cell || cell.watered) return;
    gd.state = waterGardenSlot(gd.state, i);
    this._saveGardenState();
    this._renderGarden();
    playSplash();
  }

  // Nearest planted-but-unwatered slot to the player within `reach`, or null. Shared by
  // the water Use descriptor and its prompt so they always agree on the target.
  _nearestUnwateredSlot(reach = 110) {
    const gd = this.garden;
    if (!gd) return null;
    let best = null, bestD = Infinity;
    gd.slots.forEach((slot, i) => {
      const cell = gd.state[i];
      if (!cell || slotWatered(gd.state, i)) return;
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, slot.x, slot.y);
      if (d <= reach && d < bestD) { bestD = d; best = { i, slot }; }
    });
    return best;
  }

  // Nearest ripe slot to the player within `reach`, or null. Shared by the harvest Use
  // descriptor and its prompt so they always agree on the target.
  _nearestRipeSlot(reach = 110) {
    const gd = this.garden;
    if (!gd) return null;
    let best = null, bestD = Infinity;
    gd.slots.forEach((slot, i) => {
      if (!slotRipe(gd.state, i)) return;
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, slot.x, slot.y);
      if (d <= reach && d < bestD) { bestD = d; best = { i, slot }; }
    });
    return best;
  }

  // The garden's interactable descriptors, merged into the world lists by
  // buildInteractables. Three behaviours:
  //   • bare-hand interact near the bed        → plant the next crop (interactWorld)
  //   • filled water bucket + Use near a slot   → water it (toolWorld, #245)
  //   • basket + Use near a ripe slot           → harvest into the basket (toolWorld)
  _gardenInteractables() {
    const gd = this.garden;
    if (!gd) return { plant: () => [], water: () => [], harvest: () => [] };

    const plantDesc = () => {
      if (firstEmptySlot(gd.state) < 0) {
        // Full plot — a passive hint, no action, so the station stays discoverable.
        return [{
          x: gd.x, y: gd.y - 40, tapRadius: 150, reachDist: 130, promptOffsetY: 70,
          canAct: false, label: 'Garden  •  full — harvest ripe crops to replant',
          approach: () => ({ x: gd.x, y: gd.y + 24 }),
          activate: () => {},
        }];
      }
      const crop = getCrop(this._nextPlantCrop());
      return [{
        x: gd.x, y: gd.y - 40, tapRadius: 150, reachDist: 130, promptOffsetY: 70,
        canAct: true, label: `Plant ${crop.label}`,
        approach: () => ({ x: gd.x, y: gd.y + 24 }), // walk to just below the bed
        activate: () => this.plantNextCrop(),
      }];
    };

    // Water a growing slot: offered when the active carrier is a filled water bucket
    // and at least one planted slot still needs today's watering. Mirrors the
    // trough/pet-bowl fill descriptor (a Use action on a filled bucket).
    const waterDesc = (item) => {
      if (item?.content !== 'water' || item.count <= 0) return [];
      const target = this._nearestUnwateredSlot(9999);
      if (!target) return [];
      const cell = gd.state[target.i];
      const crop = getCrop(cell.crop);
      return [{
        x: target.slot.x, y: target.slot.y, tapRadius: 100, reachDist: 110, promptOffsetY: 30,
        canAct: true, label: `Water ${crop.label}`,
        approach: () => ({ x: target.slot.x, y: target.slot.y + 30 }),
        activate: () => this.waterSlot(target.i),
      }];
    };

    const harvestDesc = (item) => {
      const ripe = this._nearestRipeSlot(9999); // list if any ripe slot exists at all
      if (!ripe) return [];
      const hasBasket = item?.carrier === 'basket';
      const cell = gd.state[ripe.i];
      const crop = getCrop(cell.crop);
      return [{
        x: ripe.slot.x, y: ripe.slot.y, tapRadius: 100, reachDist: 110, promptOffsetY: 30,
        canAct: hasBasket,
        label: hasBasket
          ? `Harvest ${crop.label}`
          : `${crop.label} ripe  •  equip a Basket to harvest`,
        approach: () => ({ x: ripe.slot.x, y: ripe.slot.y + 30 }),
        activate: () => this.harvestSlot(ripe.i),
      }];
    };

    return { plant: plantDesc, water: waterDesc, harvest: harvestDesc };
  }
};
