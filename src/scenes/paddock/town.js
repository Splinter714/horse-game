// Town expansion (#222) — a CONTINUOUS eastward extension of the same world/scene
// (no loading screen, no scene swap, unlike the house interior), mirroring the
// riding trail (#36) exactly but on the opposite edge. Walking off the paddock's
// east edge (the old WORLD_W boundary) just keeps going: the camera bounds and
// PLAYER_BOUNDS were already widened in constants.js/player.js, so this mixin only
// needs to build the town's terrain/scenery and its one new shop building.
//
// The farm-stand customer and neighbor NPC already walk in from the east edge
// (WORLD_W - 20, see paddock/farmStand.js / paddock/neighbor.js) — no change to
// their spawn logic needed; they now narratively read as coming FROM town.
//
// v1 scope (per #222): the general store (#215/#217) and its clothing counter
// already exist elsewhere in the world and are NOT relocated here — moving an
// established, already-placed world object risks breaking other things and isn't
// the core ask. This mixin adds the town TERRAIN plus one NEW building: the pet
// store (cosmetic/care items only — a decorative pet bed, a toy, and a grooming
// brush; "sells new animals" is out of scope, a separate future feature).
//
// Kept a separate concern file (not grown into world.js, which is already near
// the 500-line budget) so this doesn't collide with other agents editing the
// farm's world.js in parallel — mirrors exactly how trail.js avoided that collision.

import { S, TOWN_X0, TOWN_W, TOWN_Y0, TOWN_Y1 } from './constants.js';

const PET_STORE_X = TOWN_X0 + 260, PET_STORE_Y = 700;

export const WithTown = (Base) => class extends Base {
  buildTown() {
    // Town ground — a warmer, slightly dustier tint than the farm's grass reads as
    // "a little street/square" without needing a new tileset; reuses the existing
    // grass texture tiled across the extension band (mirrors buildTrail's tinting).
    this.add.tileSprite(TOWN_X0, TOWN_Y0 - 40, TOWN_W, (TOWN_Y1 - TOWN_Y0) + 80, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100).setTint(0xd8cf9e);

    // A worn path leading off the farm's east edge into town, so the transition
    // reads as "the street continues from here" (mirrors the trail's dirt path).
    const g = this.add.graphics().setDepth(-95);
    const midY = (TOWN_Y0 + TOWN_Y1) / 2;
    const pts = [];
    for (let x = TOWN_X0 - 60; x <= TOWN_X0 + TOWN_W - 40; x += 40) {
      const wobble = 18 * Math.sin(x / 150);
      pts.push([x, midY + wobble]);
    }
    const stamp = (radius, color, alpha) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          g.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
        }
      }
    };
    stamp(26, 0x9a8a5c, 0.85);
    stamp(18, 0xc9bb86, 0.9);

    // Scenery: a scattering of trees + flowers along the street so it still feels
    // like the same world's palette (reusing the trail's tree/flower textures).
    const trees = [
      [TOWN_X0 + 620, 260], [TOWN_X0 + 760, 460], [TOWN_X0 + 120, 320], [TOWN_X0 + 40, 900],
      [TOWN_X0 + 820, 780], [TOWN_X0 + 480, 900], [TOWN_X0 + 700, 900], [TOWN_X0 + 860, 300],
    ];
    for (const [x, y] of trees) {
      this.add.image(x, y, 'trailTree').setScale(S).setDepth(y).setOrigin(0.5, 1);
    }

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    const flowerSpots = [
      [TOWN_X0 + 100, 560], [TOWN_X0 + 220, 780], [TOWN_X0 + 380, 340], [TOWN_X0 + 560, 620],
      [TOWN_X0 + 640, 800], [TOWN_X0 + 780, 600], [TOWN_X0 + 860, 460],
    ];
    flowerSpots.forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
    });

    // A simple marker at the town's mouth (the farm side) so the entrance reads
    // clearly from the paddock, mirroring the trail's entrance marker.
    this.props.townEntrance = { x: TOWN_X0 - 20, y: midY };

    // Pet store (#222 v1) — the one NEW building this town area adds. Mirrors the
    // general store's build pattern (paddock/generalStore.js): a placed prop +
    // its own solid footprint spread into this.obstacles.
    const sprite = this.add.image(PET_STORE_X, PET_STORE_Y, 'petStore')
      .setScale(S).setDepth(PET_STORE_Y).setOrigin(0.5, 1);
    this.props.petStore = { x: PET_STORE_X, y: PET_STORE_Y, sprite };
    // Solid building footprint (sprite 72×50 at S=2 → 144×100), bottom at PET_STORE_Y.
    this.petStoreObstacles = [
      { x: PET_STORE_X - 72, y: PET_STORE_Y - 100, w: 144, h: 100, isPetStore: true },
    ];
  }

  // Interactable descriptor for the pet store building — bare-hand interact like
  // the general store (paddock/interactables.js's `generalStore`).
  _townInteractables() {
    const petStore = () => {
      const s = this.props.petStore;
      if (!s) return [];
      return [{
        x: s.x, y: s.y, tapRadius: 150, reachDist: 150, promptOffsetY: 70,
        canAct: true, label: 'Pet Store',
        approach: () => ({ x: s.x, y: s.y + 40 }), // walk to just below the door
        activate: () => this.openPetStore(),
      }];
    };
    return { petStore };
  }

  // Launch the buy panel scoped to just the `pets` counter (data/generalStore.js's
  // STORE_COUNTERS) — reuses GeneralStoreScene's exact UI/money-math, mirrors
  // openGeneralStore (paddock/generalStore.js) exactly.
  openPetStore() {
    if (this.scene.isActive('GeneralStoreScene')) return; // already open
    this.scene.launch('GeneralStoreScene', { counterIds: ['pets'], title: 'Pet Store', icon: 'petStore' });
    this.scene.bringToTop('GeneralStoreScene');
  }
};
