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

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { getSpecies } from '../../data/species/index.js';
import { lookFromKeys } from '../../data/customize.js';
import { reskinAnimal } from '../../art/index.js';
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

  // Harvest the animal's produce (e.g. milk, wool) into the active empty carrier,
  // gated on the generic readiness check (daily gate for the cow, regrowth timer for
  // the sheep, #233). Sound/icon come from the species `produces` def — no per-species
  // code. A cooldown-produce animal (the sheep) also flips to its shorn look until the
  // fleece regrows (see _refreshShornLook + the update-loop regrowth check).
  _produceFromAnimal(animal) {
    const model = animal.model;
    const prod = model && getSpecies(model.species).produces;
    if (!prod || !model.canProduce?.()) return;
    // Fill the carrier first; only mark it harvested if the produce actually went in.
    const added = this.scene.get('HotbarScene')?.fillActiveCarrier(prod.content, 1) ?? 0;
    if (added <= 0) return;
    model.markProduced();
    this._saveAnimal(model);
    SOUND_FNS[prod.sound]?.();        // squirty milk / shear-snip harvest sound
    this.showIcon(prod.icon, animal.sprite);
    if (prod.mode === 'cooldown') this._refreshShornLook(animal); // shorn until regrown
  }

  // ─── Shorn / regrowth visual (generic cooldown-produce, #233) ──────────────
  // Rebuild a cooldown-produce animal's frame textures IN PLACE to match its current
  // regrowth state — shorn (fleece trimmed) right after a shear, full again once the
  // regrowth timer elapses. Reads the model's saved customizer `look` (per-part swatch
  // keys) and threads a `shorn` flag into the art builder, reusing the same in-place
  // reskin the customizer uses (art re-draws under the same texture key, so the live
  // sprite updates with no re-spawn). Registry-driven — no species name here.
  _refreshShornLook(animal) {
    const model = animal?.model;
    if (!model) return;
    const spec = getSpecies(model.species);
    if (spec.produces?.mode !== 'cooldown') return;
    const look = model.look ? lookFromKeys(model.species, model.look)
                            : (lookFromKeys(model.species, undefined) ?? {});
    reskinAnimal(this, model.species, animal.key, { ...look, shorn: model.isShorn() });
  }

  // Each tick, regrow any animal whose fleece has grown back since it was sheared
  // (flip the shorn look off once the regrowth timer completes) AND keep the visible
  // "regrowing" cue in sync (#233 playtest — the timer used to be silent). Cheap: it
  // only touches cooldown-produce animals; the sprite re-skin still fires once, at the
  // moment fleece crosses back to full. Called from the update loop.
  tickRegrowth() {
    for (const a of this.animals) {
      const model = a.model;
      if (!model?.lastProducedAt) continue;                 // never sheared / not cooldown
      const spec = getSpecies(model.species);
      if (spec.produces?.mode !== 'cooldown') continue;
      const shorn = model.isShorn();
      if (a._shownShorn !== shorn) {                        // visual fleece change → re-skin once
        a._shownShorn = shorn;
        this._refreshShornLook(a);
      }
      this._updateRegrowCue(a, model);                      // keep the floating cue current
    }
  }

  // A small floating "wool regrowing" cue above a freshly-sheared animal so the 6-min
  // regrowth timer is legible instead of silent (#233 playtest). It's a tiny progress
  // pill that fills as the fleece grows back, with a wool tuft icon; it appears while
  // shorn and is removed the moment the fleece is full again. Built lazily per animal
  // and reused across ticks. Positioned just above the sprite each frame so it tracks
  // the wandering sheep.
  _updateRegrowCue(a, model) {
    const shorn = model.isShorn();
    if (!shorn) { this._clearRegrowCue(a); return; }

    const p = Phaser.Math.Clamp(model.regrowthProgress(), 0, 1);
    const W = 28, H = 5;                                    // pill footprint (world px)
    const topY = a.sprite.y - a.sprite.displayHeight - 12;  // just above the sprite

    if (!a._regrowCue) {
      const bg = this.add.graphics().setDepth(20000);
      const icon = this.add.image(0, 0, 'iconBasketWool')
        .setScale(0.7).setDepth(20001);
      a._regrowCue = { bg, icon, w: W, h: H };
    }
    const cue = a._regrowCue;
    const x = a.sprite.x, y = topY;
    // Redraw the pill each tick (fill tracks progress). Track + fill + thin outline.
    cue.bg.clear();
    cue.bg.fillStyle(0x2a2018, 0.55); cue.bg.fillRoundedRect(x - W / 2 - 1, y - 1, W + 2, H + 2, 3);
    cue.bg.fillStyle(0x4a3a28, 1);    cue.bg.fillRoundedRect(x - W / 2, y, W, H, 2);
    cue.bg.fillStyle(0xe8d8c0, 1);    cue.bg.fillRoundedRect(x - W / 2, y, Math.max(1, W * p), H, 2);
    cue.icon.setPosition(x - W / 2 - 8, y + H / 2);
  }

  _clearRegrowCue(a) {
    if (!a?._regrowCue) return;
    a._regrowCue.bg.destroy();
    a._regrowCue.icon.destroy();
    a._regrowCue = null;
  }
};
