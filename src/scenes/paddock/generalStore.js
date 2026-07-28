// The unified store (#215/#217/#222/#244, unified by #312) — ONE store building:
// world placement + launch hook. `buildGeneralStore` places the building prop
// (called from buildTown, paddock/town.js — moved out of the farm per #312's
// confirmed decision) and registers its solid footprint on
// `this.generalStoreObstacles` (spread into this.obstacles by buildObstacles,
// mirroring the barn/doghouse pattern). `openGeneralStore` launches the buy overlay
// (GeneralStoreScene) when the player interacts with the store, mirroring
// paddock/shop.js's openShop exactly (same launch/bringToTop/already-open guard).
// (The shopkeeper NPC that used to stand at the counter — #244 — was removed per
// #388; the store is self-serve now, opened directly via its interactable.)
//
// Structured with a `counters` registry (data/generalStore.js STORE_COUNTERS: seeds,
// food, clothing, pets) — GeneralStoreScene reads STORE_COUNTERS directly, no
// scene-side change needed here to add a counter. Before #312 this building only
// held seeds+clothing (in the farm) and pets had a separate building in town
// (paddock/town.js's old pet store) — both are now this one building/counterIds-free
// launch, showing every counter.

import { S, TOWN_X0 } from './constants.js';

const STORE_X = TOWN_X0 + 260, STORE_Y = 700;

export const WithGeneralStore = (Base) => class extends Base {
  buildGeneralStore() {
    const sprite = this.add.image(STORE_X, STORE_Y, 'generalStore')
      .setScale(S).setDepth(STORE_Y).setOrigin(0.5, 1);
    this.props.generalStore = { x: STORE_X, y: STORE_Y, sprite };

    // Solid building footprint (sprite 72×50 at S=2 → 144×100), bottom at STORE_Y.
    this.generalStoreObstacles = [
      { x: STORE_X - 72, y: STORE_Y - 100, w: 144, h: 100, isGeneralStore: true, own: this.props.generalStore },
    ];

  }

  openGeneralStore() {
    if (this.scene.isActive('GeneralStoreScene')) return; // already open
    // No counterIds filter (#312 — the unified store): every STORE_COUNTERS entry
    // shows up here now (seeds, food, clothing, pets) since this is the one store.
    this.scene.launch('GeneralStoreScene', { title: 'General Store', icon: 'generalStore' });
    this.scene.bringToTop('GeneralStoreScene');
  }
};
