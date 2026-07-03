// Tier-2 bird-ecosystem world objects (#219 bird bath, #240 seed feeder,
// #226 hummingbird sugar-water feeder, #239 beehive). These are the fixed,
// decorative-plus-ambient props that the flying wildlife (paddock/wildlife.js) and
// the bees/hummingbirds hook onto. Kept in their own concern mixin (not world.js)
// so the family of related objects lives together and world.js stays under its
// line budget (#167). Composed onto PaddockScene like the other WithX mixins.
//
// Each builder places a sprite, records a `this.props.<name>` descriptor, and pushes
// any solid footprint into `this.birdEcosystemObstacles` — buildObstacles (world.js)
// spreads that array into this.obstacles, mirroring doghouseObstacles/barnObstacles.

import { S } from './constants.js';

export const WithBirdEcosystem = (Base) => class extends Base {
  // One entry point buildWorld calls after the yard props are down. Accumulates the
  // footprints for every bird-ecosystem object into one array world.js spreads.
  buildBirdEcosystem() {
    this.birdEcosystemObstacles = [];
    this.buildBirdBath(); // #219
  }

  // ─── Bird bath (#219) ────────────────────────────────────────────────────────
  // A decorative pedestal bath in the north yard where the ambient birds already
  // visit (near the flowers / cat / coop). Purely scenery + an ambient beat: birds
  // fly in to splash and drink (paddock/wildlife.js `_scheduleBirdBathVisit`). No
  // refilling or upkeep — it's fixed scenery, not a fillable resource.
  //
  // FIRST-PASS spot (620, 470) — flagged for the owner to redirect in the live
  // preview if a different yard corner reads better. Registers a small solid
  // pedestal footprint so the player and grazers path around it.
  buildBirdBath() {
    const x = 620, y = 470;
    this.add.image(x, y, 'birdBath').setScale(S).setDepth(y).setOrigin(0.5, 1);
    this.props.birdBath = { x, y };
    // Sprite 34×40 at S (origin 0.5,1); the solid part is the pedestal foot ≈ 20px
    // wide at the base → ~44×20 footprint, bottom a touch above y so a bird landing
    // on the near rim still reads as "on" the bath.
    this.birdEcosystemObstacles.push({ x: x - 22, y: y - 20, w: 44, h: 18 });
  }
};
