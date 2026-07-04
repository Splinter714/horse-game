// Generic animal model. All species-specific differences (which needs decay, what
// care actions do, daily-care rules, mood labels, identity defaults, extra traits)
// come from a species definition (see ./species/index.js) — so adding a new animal
// is mostly *data*, not new model code. Mirrors the data-driven approach already
// used by coats.js and items.js.
//
// Kid-friendly tuning carries over from the original Horse model: needs fall slowly
// and offline decay is capped (OFFLINE_FLOOR) so an animal is never neglected into
// misery just because the game was closed.

import { assignPersonality } from './personality.js';

export const MAX = 100;
export const OFFLINE_FLOOR = 30;

function clamp(v) {
  return Math.max(0, Math.min(MAX, v));
}

function resolveDefault(d) {
  return typeof d === 'function' ? d() : d;
}

export class Animal {
  constructor(species, data = {}) {
    this._spec = species;          // full species def (not serialized)
    this.species = species.id;     // species tag (serialized, so load knows the kind)

    // ── Identity ────────────────────────────────────────────────────────────
    const def = species.defaults;
    this.id = data.id ?? resolveDefault(def.id);
    this.name = data.name ?? def.name;
    this.breed = data.breed ?? def.breed;
    this.coat = data.coat ?? def.coat;
    // Optional per-animal marking overrides set by the customization panel (#2/#17):
    // an object of marking flags merged over the coat colour's defaults. null = use
    // the coat preset's own markings.
    this.markings = data.markings ?? null;
    // Optional per-part customizer selection (swatch keys), e.g. cow → { coat:'brown',
    // spots:'rust' } / chicken → { style:'2' }. null until the player customizes; the
    // art is rebuilt from it on boot (data/customize.js lookFromKeys). Horses use the
    // richer coat/markings system above instead of `look`. (#165 info-panel editor.)
    this.look = data.look ?? null;
    this.age = data.age ?? def.age;
    // Biological sex ('female' | 'male') — shown in the info panel and used by
    // breeding later (#113/#15). Falls back to the species default for older
    // saves that predate the attribute.
    this.sex = data.sex ?? def.sex ?? 'female';
    this.lastSeen = data.lastSeen ?? Date.now();

    // ── Breeding / foals (#15) ────────────────────────────────────────────────
    // A newborn born from pairing two horses is flagged `isFoal` (smaller baby art +
    // the grow-up gate) and carries a `stayBaby` toggle — a foal only grows up when
    // the player allows it (kids get attached). `parents` records the two parent ids
    // for flavour. All optional: an ordinary animal has isFoal=false and no parents.
    this.isFoal = data.isFoal ?? false;
    // Default true so a foal stays a baby until the player opts it into growing up.
    // BINDING for every species with babies, not just horses — see CLAUDE.md
    // "Breeding & baby-animal design constraints" (rule 1).
    this.stayBaby = data.stayBaby ?? true;
    this.parents = data.parents ?? null;

    // ── Always-present traits with defaults (e.g. horse temperament/saddled,
    //    chicken personality). Stored top-level so existing call sites that read
    //    `animal.temperament` keep working. ───────────────────────────────────
    for (const [key, fallback] of Object.entries(species.traits ?? {})) {
      this[key] = data[key] ?? fallback;
    }

    // ── Optional fixed attributes, only attached when provided (e.g. Ebony's
    //    health/speed/stamina). Not affected by decay. ─────────────────────────
    for (const key of species.optionalAttrs ?? []) {
      if (data[key] !== undefined) this[key] = data[key];
    }

    // ── Personality & preferences profile (#88 v1) — positively-framed traits
    //    that make each animal an individual (temperament + favorite activity/food/
    //    treat + affinities). Display-only for now (surfaced in the info panel).
    //    Stored as `profile` (an OBJECT) so it doesn't collide with the existing
    //    single-word `traits.personality` string some species declare. A persisted
    //    `data.profile` wins so it's stable across reloads; otherwise it's assigned
    //    deterministically from the animal's stable id, so even animals never
    //    explicitly seeded get the *same* traits every load. Pools are data
    //    (co-located per species; shared defaults in personality.js).
    this.profile = data.profile ?? assignPersonality(species, this.id);

    // ── Needs (decaying stats) + optional derived happiness ──────────────────
    this.stats = {};
    for (const key of Object.keys(species.needs)) {
      this.stats[key] = data.stats?.[key] ?? species.needs[key].default;
    }
    if (species.happiness) {
      this.stats.happiness = data.stats?.happiness ?? species.happiness.default;
    }

    // ── Daily care cycle (runtime only — not serialized). Reset each morning by
    //    rollNewDay(); missing a required care action makes the animal wake up
    //    `neglected` (a grumpy greeting until tended). ──────────────────────────
    this.caredToday = {};
    for (const k of species.dailyCare?.track ?? []) this.caredToday[k] = false;
    this.neglected = false;

    // ── Produce (e.g. the cow's milk, the sheep's wool). Two modes:
    //    • daily (default): `readyToProduce` is set each morning from whether
    //      yesterday's required care was met; `producedToday` flips once harvested.
    //    • cooldown (`produces.mode === 'cooldown'`, e.g. shearing wool): readiness
    //      is a regrowth TIMER — `lastProducedAt` stamps the harvest, and the animal
    //      is ready again once `produces.cooldownMs` has elapsed. Independent of the
    //      daily-care cycle. `lastProducedAt === 0` means never harvested → ready
    //      immediately when `readyAtStart`.
    //    All fields persist so the gate (and regrowth timer) survive a reload. ──────
    if (species.produces) {
      if (species.produces.mode === 'cooldown') {
        // A never-sheared animal starts ready (readyAtStart) with no timestamp; once
        // sheared, lastProducedAt drives the regrowth countdown.
        this.lastProducedAt = data.lastProducedAt ??
          (species.produces.readyAtStart ? 0 : Date.now());
      } else {
        // `readyAtStart` lets a fresh animal be harvestable on day one (the cow is
        // milkable immediately) without first living a well-cared-for day.
        this.readyToProduce = data.readyToProduce ?? !!species.produces.readyAtStart;
        this.producedToday  = data.producedToday ?? false;
      }
    }
  }

  // Apply `seconds` of time-based decay. `offline` caps how far needs fall so a
  // return after time away is forgiving.
  applyDecay(seconds, offline = false) {
    const floor = offline ? OFFLINE_FLOOR : 0;
    for (const key of Object.keys(this._spec.needs)) {
      const next = this.stats[key] - this._spec.needs[key].decay * seconds;
      this.stats[key] = clamp(offline ? Math.max(floor, next) : next);
    }
    this.recomputeHappiness(seconds, offline);
  }

  // Happiness eases toward how well the animal's needs are being met (species with
  // needs), or toward a resting `baseline` (needs-less companions like chickens /
  // the cat) so a pet's cheer gently fades and petting stays meaningful and
  // renewable (#104/#105). No-op for species without happiness, or a needs-less
  // species that sets no baseline (happiness then only moves when petted).
  recomputeHappiness(seconds, offline = false) {
    const hap = this._spec.happiness;
    if (!hap) return;
    const keys = Object.keys(this._spec.needs);
    const target = keys.length
      ? keys.reduce((s, k) => s + this.stats[k], 0) / keys.length
      : (hap.baseline ?? this.stats.happiness);
    const rate = hap.driftRate * seconds;
    let next = this.stats.happiness + (target - this.stats.happiness) * Math.min(1, rate);
    if (offline) next = Math.max(OFFLINE_FLOOR, next);
    this.stats.happiness = clamp(next);
  }

  // The species definition for a care action (stat/amount/care/sound/icon), or
  // undefined if this species doesn't support it. Lets the view layer drive
  // sound/icon feedback from data instead of a hardcoded switch.
  actionDef(key) {
    return this._spec.actions[key];
  }

  // Perform a care action by key (feed/water/brush/pet/…). Reads the species
  // `actions` table: which stat to bump, by how much, and which care flag to set.
  // Returns true if the action exists for this species.
  applyAction(key) {
    const a = this._spec.actions[key];
    if (!a) return false;
    this.stats[a.stat] = clamp(this.stats[a.stat] + a.amount);
    this._tended(a.care);
    return true;
  }

  // Record care for today's cycle. Any attention clears a grumpy mood immediately;
  // whether the animal is neglected *tomorrow* depends on rollNewDay().
  _tended(kind) {
    if (kind && kind in this.caredToday) this.caredToday[kind] = true;
    this.neglected = false;
  }

  // Advance to a new day: wake neglected if a required care action was missed
  // yesterday, then clear the day's care record.
  rollNewDay() {
    const req = this._spec.dailyCare?.requiredForContentment ?? [];
    const metCare = req.length ? req.every((k) => this.caredToday[k]) : true;
    this.neglected = req.length ? !metCare : false;
    // A daily-produce animal (the cow) becomes ready to give milk only if she was
    // well cared for the day that just ended, and hasn't been milked yet today.
    // Cooldown produce (wool) is timer-driven, not tied to the day roll — skip it.
    if (this._spec.produces && this._spec.produces.mode !== 'cooldown') {
      this.readyToProduce = metCare;
      this.producedToday  = false;
    }
    for (const k of Object.keys(this.caredToday)) this.caredToday[k] = false;
  }

  // ── Produce readiness (generic, both modes) ────────────────────────────────
  // True if the animal's produce can be harvested right now. Daily mode reads the
  // once-a-day gate; cooldown mode (wool) reads the regrowth timer against `now`.
  canProduce(now = Date.now()) {
    const prod = this._spec.produces;
    if (!prod) return false;
    if (prod.mode === 'cooldown') {
      return (now - (this.lastProducedAt || 0)) >= prod.cooldownMs;
    }
    return !!this.readyToProduce && !this.producedToday;
  }

  // Record a harvest. Daily mode flips the once-a-day flag; cooldown mode stamps the
  // regrowth clock so `canProduce` counts down from `now`.
  markProduced(now = Date.now()) {
    const prod = this._spec.produces;
    if (!prod) return;
    if (prod.mode === 'cooldown') this.lastProducedAt = now;
    else this.producedToday = true;
  }

  // Fraction of the regrowth timer elapsed (0 = just harvested, 1 = fully regrown),
  // for cooldown produce. Drives the "shorn" visual: shorn while below 1, regrown at
  // 1. Always 1 for daily/non-producing species (never looks shorn).
  regrowthProgress(now = Date.now()) {
    const prod = this._spec.produces;
    if (!prod || prod.mode !== 'cooldown' || !this.lastProducedAt) return 1;
    return Math.min(1, (now - this.lastProducedAt) / prod.cooldownMs);
  }

  // True while a cooldown-produce animal is visibly shorn (wool not yet regrown).
  isShorn(now = Date.now()) {
    return this.regrowthProgress(now) < 1;
  }

  // Friendly mood label from happiness, using the species' threshold table.
  mood() {
    const table = this._spec.mood;
    if (!table) return '';
    const h = this.stats.happiness ?? 0;
    for (const [threshold, label] of table) if (h >= threshold) return label;
    return table[table.length - 1][1];
  }

  toJSON() {
    const out = {
      species: this.species,
      id: this.id,
      name: this.name,
      breed: this.breed,
      coat: this.coat,
      age: this.age,
      sex: this.sex,
      lastSeen: this.lastSeen,
    };
    if (this.markings) out.markings = this.markings;
    if (this.look) out.look = this.look;
    // Breeding/foal fields (#15) — only persisted for an actual foal, so an ordinary
    // animal's save is unchanged. isFoal gates the smaller art + grow-up path;
    // stayBaby is the player's "stay a baby forever" toggle; parents is flavour.
    if (this.isFoal) {
      out.isFoal = true;
      out.stayBaby = this.stayBaby;
      if (this.parents) out.parents = this.parents;
    }
    // Persist the assigned personality profile so it's stable across reloads (it
    // would also re-derive deterministically from the id, but saving it pins it even
    // if the pools ever change).
    if (this.profile) out.profile = this.profile;
    for (const key of Object.keys(this._spec.traits ?? {})) out[key] = this[key];
    for (const key of this._spec.optionalAttrs ?? []) {
      if (this[key] !== undefined) out[key] = this[key];
    }
    if (Object.keys(this.stats).length) out.stats = { ...this.stats };
    if (this._spec.produces) {
      if (this._spec.produces.mode === 'cooldown') {
        out.lastProducedAt = this.lastProducedAt;
      } else {
        out.readyToProduce = this.readyToProduce;
        out.producedToday  = this.producedToday;
      }
    }
    return out;
  }
}
