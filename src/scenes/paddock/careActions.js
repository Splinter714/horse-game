// Care-action dispatch — applying a care action (feed/water/brush/pet, saddle/lead,
// and the cow's feed/water/milk) to an animal and firing the right sound/icon
// feedback. The two entry points are `useItemOnHorse` (tool used on a horse in the
// world) and `doAction` (the model-side apply that InfoPanelScene's ANIMAL_ACTION
// routes through, kept the single owner so an action is never double-counted).
// Extracted from PaddockScene as its own concern (issue #167).
//
// NOTE: the cow's feedCow/waterCow/milkCow are per-species methods that duplicate
// the generic path (model.applyAction + carrier + feedback). That's a cross-cutting
// seam slated to fold into the generic dispatch in Phase B3; kept verbatim here so
// this step stays a pure structural move.

import { EVENTS } from '../../data/events.js';
import { playEat, playDrink, playBrush, playChime, playMilk } from '../../audio/sounds.js';

// Maps a species action's `sound` name (see data/species) to the synth function.
const SOUND_FNS = { eat: playEat, drink: playDrink, brush: playBrush, chime: playChime };

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

  // ─── Cow care (direct interaction, #cow) ──────────────────────────────────
  // The cow is fed/watered by using a food basket / water bucket on her directly
  // (mirrors brushing a horse), and milked with an empty bucket once a day if she
  // was well cared for the day before. Dispatched from player.js (useActiveTool).

  // Feed the cow one unit from the active food basket.
  feedCow(cow) {
    const model = cow.model;
    if (!model) return;
    if ((this.scene.get('HotbarScene')?.useActiveCarrier(1) ?? 0) <= 0) return;
    model.applyAction('feed');
    playEat();
    this._afterCowCare(cow, 'iconFeed');
  }

  // Water the cow, emptying the active water bucket.
  waterCow(cow) {
    const model = cow.model;
    if (!model) return;
    const item = this.getActiveItem();
    if (item?.content !== 'water' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(item.count);
    model.applyAction('water');
    playDrink();
    this._afterCowCare(cow, 'iconWater');
  }

  // Milk the cow into the active (empty) bucket. Gated on her being ready (well
  // cared for yesterday) and not already milked today — the bucket fills with milk.
  milkCow(cow) {
    const model = cow.model;
    if (!model?.readyToProduce || model.producedToday) return;
    // Fill the bucket first; only mark her milked if the milk actually went in.
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier('milk', 1) ?? 0;
    if (added <= 0) return;
    model.producedToday = true;
    this._saveAnimal(model);
    playMilk(); // squirty milk-into-the-pail sound (#cow)
    this.showIcon('iconBucketMilk', cow.sprite);
  }

  // Shared tail of feed/water: persist, refresh stat bars (live panel + HUD), and
  // float the care icon over the cow.
  _afterCowCare(cow, icon) {
    this._saveAnimal(cow.model);
    this.game.events.emit(EVENTS.STATS_CHANGED);
    this.showIcon(icon, cow.sprite);
    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === cow.key) this.scene.get('InfoPanelScene').refreshStats(cow.model);
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
