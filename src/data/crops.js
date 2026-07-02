// Crop table (#242) — the data behind the garden plot's plant → grow → harvest loop.
//
// Crops are data-driven like coats/items: adding one is an entry here plus its art.
// Each crop grows through a fixed sequence of visible STAGES, advancing one stage per
// day/night cycle (the garden hooks the dawn roll — no real-time timers). The final
// stage is ripe: harvest it with a basket to collect the crop's `harvest` content,
// which rides the existing basket → farm-stand → sell pipeline (see items.js /
// STAND_DEFS). Plant-and-wait: no watering in v1 (that's #245).
//
// The starter set spans fruit / grain / veg so crop-processing (#40) has inputs:
//   strawberry → (future) jam · wheat → (future) flour / pig feed · carrot → veg / sell
//
// Pure data + tiny helpers only — no Phaser — so the growth logic is unit-testable in
// the `node` test env alongside the other data modules.

// Ordered stage list shared by every crop. Each crop declares one ground TEXTURE per
// stage (seedling → … → ripe), built in propArt.js as `crop_<id>_<stage>`. Keeping the
// count uniform (4 stages) keeps the growth maths simple; a crop can still *feel*
// different via its art and its number of days to ripen == GROWTH_STAGES - 1.
export const GROWTH_STAGES = 4; // stages 0..3; stage 3 (last) is ripe

// Is a crop at `stage` fully grown (ready to harvest)?
export function isRipe(stage) {
  return stage >= GROWTH_STAGES - 1;
}

// Advance a growth stage by one day/night cycle, clamped at ripe. Pure.
export function growStage(stage) {
  return Math.min(GROWTH_STAGES - 1, (stage ?? 0) + 1);
}

// The crop table. `harvest` is the content type the ripe crop yields into a basket
// (must exist in items.js CONTENT_DEFS + STAND_DEFS so it sells). `yield` is how many
// units one ripe plant gives. `stageTex(stage)` names the ground texture for a stage.
export const CROPS = {
  strawberry: {
    id: 'strawberry',
    label: 'Strawberry',
    harvest: 'strawberry',
    yield: 2,          // a plant gives a small handful of berries
    seedIcon: 'iconStrawberry',
  },
  wheat: {
    id: 'wheat',
    label: 'Wheat',
    harvest: 'wheat',
    yield: 2,
    seedIcon: 'iconWheat',
  },
  carrot: {
    id: 'carrot',
    label: 'Carrot',
    harvest: 'carrot',
    yield: 1,
    seedIcon: 'iconCarrot',
  },
};

// Fixed planting rotation — the order the plot cycles crops when the player plants
// (kid-friendly: just tap to plant, and you get a nice mix). Data, so re-orderable.
export const CROP_ORDER = ['strawberry', 'wheat', 'carrot'];

export function getCrop(id) {
  return CROPS[id] ?? null;
}

// The next crop in the planting rotation after `id` (wraps). Given null/unknown,
// starts at the first. Pure — drives the plot's plant-next behaviour.
export function nextCrop(id) {
  const i = CROP_ORDER.indexOf(id);
  return CROP_ORDER[(i + 1) % CROP_ORDER.length];
}

// The ground texture key for a crop at a growth stage: `crop_<id>_<stage>`. Clamped so
// an out-of-range stage still resolves to a real texture.
export function stageTexture(cropId, stage) {
  const s = Math.max(0, Math.min(GROWTH_STAGES - 1, stage ?? 0));
  return `crop_${cropId}_${s}`;
}
