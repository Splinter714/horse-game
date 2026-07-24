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

// ─── Brushing timing mini-game (#296) ───────────────────────────────────────
// A SHORT, forgiving rhythm beat layered on top of the ordinary brush stroke —
// a marker sweeps back and forth across a little bar over the horse's head; tap
// Use again while it's over the highlighted zone for a bonus. It never punishes:
// letting it time out (or missing the zone) still applies the plain base amount,
// same as today. This is a bonus layer, not a skill gate — one sweep, ~1.6s.
const BRUSH_GAME_MS = 1600;      // total time the bar is live before auto-resolving as a miss
const BRUSH_GAME_W = 84;         // bar width (world px)
const BRUSH_GAME_H = 10;         // bar height (world px)
const BRUSH_GOOD_ZONE = 0.30;    // fraction of the bar width that counts as "good"
const BRUSH_PERFECT_ZONE = 0.10; // fraction of the bar width that counts as "perfect" (subset of good)
// Multiplier applied to the base action amount on a hit tier ('miss' → the plain 1×).
const BRUSH_TIER_MULT = { perfect: 1.6, good: 1.3, miss: 1 };

export const WithCareActions = (Base) => class extends Base {
  // ─── Item use ────────────────────────────────────────────────────────────

  // The brush is the only tool used directly on a horse (saddle/lead toggle through
  // their own handlers; food is dropped, not hand-fed). A dirty coat grooms out dust;
  // a fully-clean coat can't get cleaner, so a stroke becomes a bonding gesture (#116)
  // — it raises happiness like a pet, but keeps the brush sound and shows a heart.
  //
  // Grooming a dirty coat (the normal case) now starts the timing mini-game (#296)
  // instead of instantly applying the full amount — tapping Use again at the right
  // moment gives a bonus. A clean coat's petting gesture is unaffected (no bar; it's
  // already a flat bonding tap, not the thing being made more tactile).
  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    const brushClean = (horse.stats.grooming ?? 100) >= 99.5;

    if (brushClean) {
      // Clean coat → affection tap, unchanged (#116).
      horse.pet();
      this._saveHorses();
      this.game.events.emit(EVENTS.STATS_CHANGED);
      playBrush();
      this.showHeart(h.sprite);
      this._refreshOpenPanel(h.key, horse);
      return;
    }

    // Only one mini-game runs at a time; a second Use press while one's already
    // live on this horse is handled by _resolveBrushGame (via useActiveTool), not
    // by starting a new one here.
    if (this._brushGame && this._brushGame.horseKey === h.key) return;
    this._startBrushGame(item, h, horse);
  }

  // Kick off the timing bar above the horse's head. Purely a UI/timer overlay —
  // the actual stat effect is deferred until it resolves (hit tier or timeout-miss).
  _startBrushGame(item, h, horse) {
    this._cancelBrushGame(); // only one bar on screen at a time (a different horse, say)

    // The "good"/"perfect" target zone sits at a random spot along the bar each time
    // so it can't be memorized into a single muscle-memory tap.
    const center = Phaser.Math.Clamp(0.5 + (Math.random() - 0.5) * 0.5, BRUSH_GOOD_ZONE / 2 + 0.05, 1 - BRUSH_GOOD_ZONE / 2 - 0.05);

    const x = h.sprite.x, topY = h.sprite.y - h.sprite.displayHeight - 26;
    const bg = this.add.graphics().setDepth(20010);
    const fg = this.add.graphics().setDepth(20011); // zone + marker, redrawn each tick

    this._brushGame = {
      horseKey: h.key,
      item,
      horse,
      sprite: h.sprite,
      center,               // 0..1 position of the zone's centre along the bar
      elapsed: 0,
      bg, fg,
      x, topY,
      resolved: false,
    };

    this._drawBrushGameStatic();
    this._drawBrushGameMarker(0);
  }

  _drawBrushGameStatic() {
    const g = this._brushGame;
    if (!g) return;
    const { x, topY } = g;
    g.bg.clear();
    g.bg.fillStyle(0x2a2018, 0.55);
    g.bg.fillRoundedRect(x - BRUSH_GAME_W / 2 - 2, topY - 2, BRUSH_GAME_W + 4, BRUSH_GAME_H + 4, 4);
    g.bg.fillStyle(0x5a4a38, 1);
    g.bg.fillRoundedRect(x - BRUSH_GAME_W / 2, topY, BRUSH_GAME_W, BRUSH_GAME_H, 3);
    // Good zone (wider, amber) with the perfect zone (narrower, gold) centred inside it.
    const goodX = x - BRUSH_GAME_W / 2 + (g.center - BRUSH_GOOD_ZONE / 2) * BRUSH_GAME_W;
    g.bg.fillStyle(0xe8b04a, 0.85);
    g.bg.fillRoundedRect(goodX, topY, BRUSH_GOOD_ZONE * BRUSH_GAME_W, BRUSH_GAME_H, 2);
    const perfX = x - BRUSH_GAME_W / 2 + (g.center - BRUSH_PERFECT_ZONE / 2) * BRUSH_GAME_W;
    g.bg.fillStyle(0xfff1a8, 1);
    g.bg.fillRoundedRect(perfX, topY, BRUSH_PERFECT_ZONE * BRUSH_GAME_W, BRUSH_GAME_H, 2);
  }

  // Marker sweeps 0→1→0 across the bar (a simple back-and-forth ping-pong) once per
  // ~800ms leg, so the whole beat is one there-and-back sweep inside BRUSH_GAME_MS.
  _drawBrushGameMarker(frac) {
    const g = this._brushGame;
    if (!g) return;
    const t = Phaser.Math.Clamp(frac, 0, 1);
    // Ping-pong: 0→1 over the first half, 1→0 over the second half.
    const pos = t < 0.5 ? t * 2 : 2 - t * 2;
    const mx = g.x - BRUSH_GAME_W / 2 + pos * BRUSH_GAME_W;
    g.fg.clear();
    g.fg.fillStyle(0xffffff, 1);
    g.fg.fillRoundedRect(mx - 1.5, g.topY - 3, 3, BRUSH_GAME_H + 6, 1.5);
    g.lastPos = pos;
  }

  // Called from PaddockScene.update() each frame while a brush mini-game is live.
  // Advances the sweep and auto-resolves as a miss (still applies the base effect —
  // this is a bonus layer, never a punishment) once BRUSH_GAME_MS elapses.
  tickBrushGame(delta) {
    const g = this._brushGame;
    if (!g || g.resolved) return;
    if (!g.sprite?.active) { this._cancelBrushGame(); return; }

    g.elapsed += delta;
    const frac = Phaser.Math.Clamp(g.elapsed / BRUSH_GAME_MS, 0, 1);
    // Keep the bar tracking the horse (it can wander mid-sweep) and the marker sweeping.
    const dx = g.sprite.x - g.x, dtopY = (g.sprite.y - g.sprite.displayHeight - 26) - g.topY;
    if (dx || dtopY) { g.x = g.sprite.x; g.topY = g.sprite.y - g.sprite.displayHeight - 26; this._drawBrushGameStatic(); }
    this._drawBrushGameMarker(frac);

    if (frac >= 1) this._resolveBrushGame('miss');
  }

  // The player's next Use press while the bar is live resolves it — good/perfect if
  // the marker is over the zone, miss otherwise. Called from useActiveTool (the same
  // F key / gamepad X / on-screen Use button that started the mini-game) so it's a
  // single natural "tap again" gesture, not a new control to learn.
  _resolveActiveBrushGame() {
    if (!this._brushGame || this._brushGame.resolved) return false;
    const g = this._brushGame;
    const dist = Math.abs(g.lastPos - g.center);
    const tier = dist <= BRUSH_PERFECT_ZONE / 2 ? 'perfect'
               : dist <= BRUSH_GOOD_ZONE / 2 ? 'good' : 'miss';
    this._resolveBrushGame(tier);
    return true;
  }

  // Apply the deferred brush effect at the resolved tier, then tear down the bar.
  // A miss applies exactly the same base amount as before this feature (#296) — the
  // mini-game only ever adds a bonus on top, never withholds the baseline.
  _resolveBrushGame(tier) {
    const g = this._brushGame;
    if (!g || g.resolved) return;
    g.resolved = true;

    const { horse, sprite, horseKey } = g;
    const mult = BRUSH_TIER_MULT[tier] ?? 1;
    const before = horse.stats.grooming ?? 0;
    // Reuse the data-driven brush action, then apply the bonus fraction on top so
    // the amount still comes from the species' `actions.brush.amount` (#296 hooks
    // into the existing data-driven action system rather than replacing it).
    horse.brush();
    if (mult > 1) {
      const applied = (horse.stats.grooming ?? 0) - before;
      const bonus = applied * (mult - 1);
      horse.stats.grooming = Math.min(100, (horse.stats.grooming ?? 0) + bonus);
    }

    this._saveHorses();
    this.game.events.emit(EVENTS.STATS_CHANGED);

    playBrush();
    const preDirt = (100 - before) / 100;
    this.showDustPuff(sprite, preDirt);
    if (tier === 'perfect' || tier === 'good') this.showBrushTierPop(sprite, tier);
    this._refreshOpenPanel(horseKey, horse);

    this._cancelBrushGame();
  }

  // Tear down the bar's display objects without resolving it (e.g. the horse's
  // sprite went away, or a new mini-game is about to start).
  _cancelBrushGame() {
    if (!this._brushGame) return;
    this._brushGame.bg.destroy();
    this._brushGame.fg.destroy();
    this._brushGame = null;
  }

  // Little floating "Nice!"/"Perfect!" text pop for a good/perfect brush hit —
  // reuses the same throwaway-tween pattern as the other floating FX (effects.js).
  showBrushTierPop(sprite, tier) {
    const label = tier === 'perfect' ? 'Perfect!' : 'Nice!';
    const color = tier === 'perfect' ? '#fff1a8' : '#e8b04a';
    const txt = this.add.text(sprite.x, sprite.y - sprite.displayHeight - 44, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20012);
    this.tweens.add({
      targets: txt, y: txt.y - 26, alpha: 0, duration: 700, ease: 'Sine.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // Shared by both the clean-coat pet path and the resolved mini-game: refresh the
  // info panel's live stat bars if it's open on this exact horse.
  _refreshOpenPanel(key, horse) {
    if (this.scene.isActive('InfoPanelScene')) {
      const viewing = this.registry.get('viewingAnimal');
      if (viewing?.key === key) {
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
    const W = 28, H = 6;                                    // pill footprint (world px)
    const topY = a.sprite.y - a.sprite.displayHeight - 12;  // just above the sprite

    if (!a._regrowCue) {
      const bg = this.add.graphics().setDepth(20000);
      const icon = this.add.image(0, 0, 'iconBasketWool')
        .setScale(0.45).setDepth(20001);
      a._regrowCue = { bg, icon, w: W, h: H };
    }
    const cue = a._regrowCue;
    const x = a.sprite.x, y = topY;
    // Redraw the pill each tick (fill tracks progress). Track + fill + thin outline,
    // mirroring the InfoPanelScene stat-bar look (rounded track, flat-edged fill).
    //
    // Bug fix (#233 playtest 2026-07-24): the fill used to be drawn with the SAME
    // rounded corner radius as the full-width track, but its width shrinks with
    // progress down to a couple of px right after a shear. Phaser's fillRoundedRect
    // draws corner arcs sized to the given radius regardless of how narrow the rect
    // is — once the radius exceeds half the fill's width, the corner arcs overlap and
    // the "bar" renders as a pinched blob instead of a clean sliver. Drawing the fill
    // as a plain flat-edged rect (like InfoPanelScene doesn't need to worry about,
    // since its min width of 5 is never that narrow) sidesteps the degenerate-radius
    // case entirely — the fill simply grows out from the track's rounded left cap.
    cue.bg.clear();
    cue.bg.fillStyle(0x2a2018, 0.55); cue.bg.fillRoundedRect(x - W / 2 - 1, y - 1, W + 2, H + 2, 3);
    cue.bg.fillStyle(0x4a3a28, 1);    cue.bg.fillRoundedRect(x - W / 2, y, W, H, 2);
    const fillW = Math.max(2, W * p);
    cue.bg.fillStyle(0xe8d8c0, 1);    cue.bg.fillRect(x - W / 2, y, fillW, H);
    cue.icon.setPosition(x - W / 2 - 10, y + H / 2);
  }

  _clearRegrowCue(a) {
    if (!a?._regrowCue) return;
    a._regrowCue.bg.destroy();
    a._regrowCue.icon.destroy();
    a._regrowCue = null;
  }
};
