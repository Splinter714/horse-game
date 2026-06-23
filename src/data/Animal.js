// Generic animal model. All species-specific differences (which needs decay, what
// care actions do, daily-care rules, mood labels, identity defaults, extra traits)
// come from a species definition (see ./species/index.js) — so adding a new animal
// is mostly *data*, not new model code. Mirrors the data-driven approach already
// used by coats.js and items.js.
//
// Kid-friendly tuning carries over from the original Horse model: needs fall slowly
// and offline decay is capped (OFFLINE_FLOOR) so an animal is never neglected into
// misery just because the game was closed.

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
    this.age = data.age ?? def.age;
    this.lastSeen = data.lastSeen ?? Date.now();

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
    this.neglected = req.length ? !req.every((k) => this.caredToday[k]) : false;
    for (const k of Object.keys(this.caredToday)) this.caredToday[k] = false;
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
      lastSeen: this.lastSeen,
    };
    for (const key of Object.keys(this._spec.traits ?? {})) out[key] = this[key];
    for (const key of this._spec.optionalAttrs ?? []) {
      if (this[key] !== undefined) out[key] = this[key];
    }
    if (Object.keys(this.stats).length) out.stats = { ...this.stats };
    return out;
  }
}
