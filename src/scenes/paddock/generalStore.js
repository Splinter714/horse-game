// General store (#215) — the seed-shop building: world placement + launch hook.
// `buildGeneralStore` places the building prop (called from buildWorld, world.js) and
// registers its solid footprint on `this.generalStoreObstacles` (spread into
// this.obstacles by buildObstacles, mirroring the barn/doghouse pattern). Placed in
// the north-central economy row (south of the kitchen counter/garden plot, west of
// the shop stall/farm stand) with no overlap — see world.js's buildWorld for the
// neighboring props' footprints. `openGeneralStore` launches the buy overlay
// (GeneralStoreScene) when the player interacts with the store, mirroring
// paddock/shop.js's openShop exactly (same launch/bringToTop/already-open guard).
//
// Structured with a `counters` registry (data/generalStore.js STORE_COUNTERS) so a
// second counter (clothing, #217) can slot in later without a second building —
// GeneralStoreScene reads STORE_COUNTERS directly, no scene-side change needed here.

import { S } from './constants.js';

const STORE_X = 1300, STORE_Y = 700;

export const WithGeneralStore = (Base) => class extends Base {
  buildGeneralStore() {
    const sprite = this.add.image(STORE_X, STORE_Y, 'generalStore')
      .setScale(S).setDepth(STORE_Y).setOrigin(0.5, 1);
    this.props.generalStore = { x: STORE_X, y: STORE_Y, sprite };

    // Solid building footprint (sprite 72×50 at S=2 → 144×100), bottom at STORE_Y.
    this.generalStoreObstacles = [
      { x: STORE_X - 72, y: STORE_Y - 100, w: 144, h: 100, isGeneralStore: true },
    ];
  }

  openGeneralStore() {
    if (this.scene.isActive('GeneralStoreScene')) return; // already open
    this.scene.launch('GeneralStoreScene');
    this.scene.bringToTop('GeneralStoreScene');
  }
};
