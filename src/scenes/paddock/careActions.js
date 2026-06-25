// Care-action dispatch — applying a care action (feed/water/brush/pet, saddle/lead,
// and the cow's feed/water/milk) to an animal and firing the right sound/icon
// feedback. The two entry points are `useItemOnHorse` (tool used on a horse in the
// world) and `doAction` (the model-side apply that InfoPanelScene's ANIMAL_ACTION
// routes through, kept the single owner so an action is never double-counted).
// Extracted from PaddockScene as its own concern (issue #167).
//
// Direct animal care (feed/water/produce on an in-world animal) is GENERIC: it reads
// the species' `actions` + `produces` data, so a new directly-cared-for animal is a
// data entry, not new methods (#167 B3). The C2 literal-tripwire seam guard checks
// this file names no per-species care method/branch.

import { EVENTS } from '../../data/events.js';
import { getSpecies } from '../../data/species/index.js';
import { playEat, playDrink, playBrush, playChime, playMilk } from '../../audio/sounds.js';

// Maps a species action's (or produce's) `sound` name (see data/species) to the
// synth function — the data-driven feedback table.
const SOUND_FNS = { eat: playEat, drink: playDrink, brush: playBrush, chime: playChime, milk: playMilk };

export const WithCareActions = (Base) => class extends Base {
  // ─── Item use ────────────────────────────────────────────────────────────

  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    // How dirty the coat is *before* this brush stroke, for dust-puff intensity.
    const preDirt = (100 - (horse.stats.grooming ?? 100)) / 100;
    // A fully-clean coat can't get cleaner, so brushing it becomes a bonding
    // gesture instead — it raises happiness like a pet, but keeps the brush sound
    // and shows a heart with no dust (#116). Brushing is therefore always allowed.
    const brushClean = item.action === 'brush' && (horse.stats.grooming ?? 100) >= 99.5;

    switch (item.action) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': if (brushClean) horse.pet(); else horse.brush(); break;
      case 'pet':   horse.pet();   break;
      case 'saddle': this.toggleSaddle(h); return;
      case 'lead':  this.toggleLead(h); return;
    }

    this._saveHorses();
    this.game.events.emit(EVENTS.STATS_CHANGED);

    if (item.action === 'pet') {
      this._petNicker(h);    // affection sounds happy, not a ding — rate-limited (#149)
      this.showHeart(h.sprite);
    } else if (item.action === 'brush') {
      playBrush();
      if (brushClean) this.showHeart(h.sprite);   // clean coat → affection (#116)
      else this.showDustPuff(h.sprite, preDirt);  // dirty coat → groom out dust
    } else {
      if (item.action === 'feed')  playEat(item.content); // crunchy apple/carrot vs munchy hay (#126)
      if (item.action === 'water') playDrink();
      this.showIcon(item.icon, h.sprite);
    }

    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === h.key) {
        this.scene.get('InfoPanelScene').refreshStats(horse);
      }
    }
  }

  // ─── Direct animal care (generic, #cow / #167 B3) ─────────────────────────
  // An in-world animal (this.animals) is fed/watered by using a food basket / water
  // bucket on it directly (mirrors brushing a horse), and harvested (milked) with an
  // empty bucket once a day when it's ready. Which carrier maps to which action is
  // resolved in useDispatch (_animalUseAction) from the species' `actions`/`produces`
  // data; these methods just apply the resolved action + its data-driven feedback,
  // so the cow — or any future feedable/milkable animal — needs no bespoke code.

  // Apply a consume-action (feed/water): spend from the active carrier, bump the
  // stat via the model, then run the shared feedback tail. Feed spends one unit;
  // water empties the bucket.
  _applyConsumeCare(animal, action) {
    const model = animal.model;
    if (!model) return;
    const item = this.getActiveItem();
    const amount = action === 'water' ? (item?.count ?? 0) : 1;
    if ((this.scene.get('HotbarScene')?.useActiveCarrier(amount) ?? 0) <= 0) return;
    model.applyAction(action);
    this._afterAnimalCare(animal, action);
  }

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

  // Shared tail of feed/water: persist, refresh stat bars (live panel + HUD), and
  // play the action's declared sound + float its icon over the animal.
  _afterAnimalCare(animal, action) {
    this._saveAnimal(animal.model);
    this.game.events.emit(EVENTS.STATS_CHANGED);
    const def = animal.model.actionDef?.(action);
    if (def?.sound) SOUND_FNS[def.sound]?.();
    if (def?.icon)  this.showIcon(def.icon, animal.sprite);
    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === animal.key) this.scene.get('InfoPanelScene').refreshStats(animal.model);
    }
  }

  // ─── Actions (from InfoPanelScene buttons) ───────────────────────────────

  // The single owner of applying a care action to the model. UI panels emit
  // ANIMAL_ACTION (intent only) and let this apply it, so an action is never
  // double-counted. Sound/icon feedback is driven by the species action def.
  doAction({ type, horseKey }) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[horseKey];
    if (!horseData) return;

    // Dirtiness before the action is applied, for brush dust-puff intensity.
    const preDirt = (100 - (horseData.stats.grooming ?? 100)) / 100;
    // Brushing a fully-clean coat is a bonding gesture (#116): raise happiness
    // like a pet (apply 'pet'), but keep the brush sound and a heart, no dust.
    const brushClean = type === 'brush' && (horseData.stats.grooming ?? 100) >= 99.5;

    if (!horseData.applyAction(brushClean ? 'pet' : type)) return; // unknown action

    this._saveHorses();

    const def = horseData.actionDef(type);
    SOUND_FNS[def.sound]?.();   // brush sound for brush (clean or dirty)

    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet' || brushClean) {
        this.showHeart(h.sprite);
      } else if (type === 'brush') {
        this.showDustPuff(h.sprite, preDirt); // dust off the coat, not a brush icon
      } else if (def.icon) {
        this.showIcon(def.icon, h.sprite);
      }
    }
  }
};
