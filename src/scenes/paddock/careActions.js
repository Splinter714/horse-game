// Care-action dispatch — applying a care action to an animal and firing the right
// sound/icon feedback. The entry points are `useItemOnHorse` (the brush used on a
// horse in the world) and `_produceFromAnimal` (harvesting an animal's daily produce,
// e.g. the cow's milk). Extracted from PaddockScene as its own concern (issue #167).
//
// Animals are no longer hand-fed or hand-watered: feeding/watering happen only via
// the grazing/drinking AI (dropped food + trough/stream), so there's no direct
// carrier-on-animal feed/water path here. Produce harvesting stays GENERIC — it reads
// the species' `produces` data, so a new milkable animal is a data entry, not new
// methods (#167 B3). The C2 literal-tripwire seam guard checks this file names no
// per-species care method/branch.

import { EVENTS } from '../../data/events.js';
import { getSpecies } from '../../data/species/index.js';
import { playEat, playDrink, playBrush, playChime, playMilk } from '../../audio/sounds.js';

// Maps a species action's (or produce's) `sound` name (see data/species) to the
// synth function — the data-driven feedback table.
const SOUND_FNS = { eat: playEat, drink: playDrink, brush: playBrush, chime: playChime, milk: playMilk };

export const WithCareActions = (Base) => class extends Base {
  // ─── Item use ────────────────────────────────────────────────────────────

  // The brush is the only tool used directly on a horse (saddle/lead toggle through
  // their own handlers; food is dropped, not hand-fed). A dirty coat grooms out dust;
  // a fully-clean coat can't get cleaner, so a stroke becomes a bonding gesture (#116)
  // — it raises happiness like a pet, but keeps the brush sound and shows a heart.
  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    // How dirty the coat is *before* this brush stroke, for dust-puff intensity.
    const preDirt = (100 - (horse.stats.grooming ?? 100)) / 100;
    const brushClean = (horse.stats.grooming ?? 100) >= 99.5;

    if (brushClean) horse.pet(); else horse.brush();

    this._saveHorses();
    this.game.events.emit(EVENTS.STATS_CHANGED);

    playBrush();
    if (brushClean) this.showHeart(h.sprite);   // clean coat → affection (#116)
    else this.showDustPuff(h.sprite, preDirt);  // dirty coat → groom out dust

    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === h.key) {
        this.scene.get('InfoPanelScene').refreshStats(horse);
      }
    }
  }

  // ─── Produce harvesting (generic, #cow / #167 B3) ─────────────────────────
  // An in-world animal (this.animals) is harvested (milked) with an empty bucket once
  // a day when it's ready. The carrier→action mapping is resolved in useDispatch
  // (_animalUseAction) from the species' `produces` data; this method just applies the
  // harvest + its data-driven feedback, so the cow — or any future milkable animal —
  // needs no bespoke code. (Feeding/watering are no longer direct: animals graze
  // dropped food and drink at the trough/stream via their AI.)

  // Harvest the animal's daily produce (e.g. milk) into the active empty carrier,
  // gated on it being ready and not already harvested today. Sound/icon come from
  // the species `produces` def — no per-species code.
  _produceFromAnimal(animal) {
    const model = animal.model;
    const prod = model && getSpecies(model.species).produces;
    if (!prod || !model.readyToProduce || model.producedToday) return;
    // Fill the carrier first; only mark it harvested if the produce actually went in.
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier(prod.content, 1) ?? 0;
    if (added <= 0) return;
    model.producedToday = true;
    this._saveAnimal(model);
    SOUND_FNS[prod.sound]?.();        // squirty milk-into-the-pail sound (#cow)
    this.showIcon(prod.icon, animal.sprite);
  }
};
