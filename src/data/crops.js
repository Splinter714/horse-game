// Crop table (#242) — the data behind the garden plot's plant → grow → harvest loop.
//
// Crops are data-driven like coats/items: adding one is an entry here plus its art.
// Each crop grows through a fixed sequence of visible STAGES, advancing one stage per
// day/night cycle the slot is watered (the garden hooks the dawn roll — no real-time
// timers; watering gate is #245, growIfWatered below). The final stage is ripe: harvest
// it with a basket to collect the crop's `harvest` content, which rides the existing
// basket → farm-stand → sell pipeline (see items.js / STAND_DEFS).
//
// The starter set spans fruit / grain / veg so crop-processing (#40) has inputs:
//   strawberry → jam · wheat → flour / pig feed · carrot → veg / sell
// Crop variety (#216) adds two more, each with a DIFFERENT regrow behavior (real crops
// don't all behave the same way — some keep producing, some are a one-time dig-up):
//   blueberry → regrows after harvest (a bush keeps fruiting)
//   potato    → one-and-done (a root veg — dig it up, replant from scratch)
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

// Watering chore (#245): a planted crop only advances if it was watered that
// day/night cycle — otherwise growth stalls (never goes backward, just holds).
// `growIfWatered` is the gated version of growStage the daily tick should call
// instead of growStage directly once watering is in play. Pure.
export function growIfWatered(stage, watered) {
  return watered ? growStage(stage) : (stage ?? 0);
}

// The crop table. `harvest` is the content type the ripe crop yields into a basket
// (must exist in items.js CONTENT_DEFS + STAND_DEFS so it sells). `yield` is how many
// units one ripe plant gives. `stageTex(stage)` names the ground texture for a stage.
// `regrows` (#216): does harvesting leave the plant standing to fruit again (true, the
// slot resets to an earlier growth stage — see REGROW_STAGE below) or dig it up clean
// (false/omitted, the slot goes back to empty)? Real crops differ — berries/tomatoes
// keep producing, root veg is one-and-done — so this is per-crop, not one blanket rule.
export const CROPS = {
  strawberry: {
    id: 'strawberry',
    label: 'Strawberry',
    harvest: 'strawberry',
    yield: 2,          // a plant gives a small handful of berries
    seedIcon: 'iconStrawberry',
    regrows: true,     // a strawberry plant keeps fruiting once established
  },
  wheat: {
    id: 'wheat',
    label: 'Wheat',
    harvest: 'wheat',
    yield: 2,
    seedIcon: 'iconWheat',
    // Wheat is cut at harvest (one-and-done) — regrows omitted/false.
  },
  carrot: {
    id: 'carrot',
    label: 'Carrot',
    harvest: 'carrot',
    yield: 1,
    seedIcon: 'iconCarrot',
    // A carrot is pulled up whole at harvest (one-and-done) — regrows omitted/false.
  },
  // Blueberry (#216): a bush — harvesting picks the ripe berries but leaves the plant
  // standing, so it regrows (resets to a mid-growth stage rather than back to seed) and
  // fruits again later. A slower-ripening, higher-yield crop for variety.
  blueberry: {
    id: 'blueberry',
    label: 'Blueberry',
    harvest: 'blueberry',
    yield: 3,
    seedIcon: 'iconBlueberry',
    regrows: true,
  },
  // Potato (#216): a root vegetable — dug up whole at harvest, same one-and-done shape
  // as the carrot, giving a second one-shot crop for the pair (#216 scope: at least one
  // of each behavior).
  potato: {
    id: 'potato',
    label: 'Potato',
    harvest: 'potato',
    yield: 2,
    seedIcon: 'iconPotato',
  },
};

// Fixed planting rotation — the order the plot cycles crops when the player plants
// (kid-friendly: just tap to plant, and you get a nice mix). Data, so re-orderable.
export const CROP_ORDER = ['strawberry', 'wheat', 'carrot', 'blueberry', 'potato'];

// The growth stage a REGROWING crop's slot resets to after harvest (not all the way
// back to seed — the plant is already established, it just needs to fruit again).
// One stage before ripe, clamped so it's still valid even if GROWTH_STAGES ever shrinks.
export const REGROW_STAGE = Math.max(0, GROWTH_STAGES - 2);

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
