// The Horse model: identity, coat (drives the sprite), needs, and the gentle
// decay/care logic. Kid-friendly: needs fall slowly and offline decay is capped
// so a horse is never neglected into misery just because the game was closed.

const MAX = 100;

// Tunable base stats for the Friesian "Ebony" — easy to adjust here.
export const EBONY_BASE_STATS = {
  health:  95,
  speed:   80,
  stamina: 70,
};

// Per-second decay while playing. Tuned so needs visibly tick down during play
// (hunger fully depletes in ~30 min of continuous play) while still being gentle.
const DECAY = {
  hunger: 0.05,
  thirst: 0.06,
  grooming: 0.03
};

// Offline decay is the same rates but capped, so coming back after days still
// leaves the horse okay (won't fall below this floor from absence alone).
const OFFLINE_FLOOR = 30;

function clamp(v) {
  return Math.max(0, Math.min(MAX, v));
}

export class Horse {
  constructor(data = {}) {
    this.id = data.id ?? 'horse-1';
    this.name = data.name ?? 'Buttercup';
    this.breed = data.breed ?? 'Palomino';
    this.coat = data.coat ?? 'palomino';
    this.age = data.age ?? 3;
    // Temperament shapes how the horse behaves in the paddock (how eagerly it
    // greets you, how often it rolls, etc.). Groundwork for herd personalities
    // (#31). 'calm' | 'spirited' | 'lazy' | 'shy' | 'needy'.
    this.temperament = data.temperament ?? 'calm';
    this.stats = {
      hunger: data.stats?.hunger ?? 80,
      thirst: data.stats?.thirst ?? 75,
      grooming: data.stats?.grooming ?? 60,
      happiness: data.stats?.happiness ?? 85
    };
    // Optional fixed attributes (not affected by decay).
    if (data.health  !== undefined) this.health  = data.health;
    if (data.speed   !== undefined) this.speed   = data.speed;
    if (data.stamina !== undefined) this.stamina = data.stamina;
    // Whether a saddle is equipped (persists; required before the horse can be ridden).
    this.saddled = data.saddled ?? false;
    this.lastSeen = data.lastSeen ?? Date.now();

    // ── Daily care cycle (runtime only — not serialized) ───────────────────
    // What the horse received today; reset each morning by rollNewDay(). If it
    // didn't get fed AND watered yesterday it starts the new day `neglected`
    // and greets you grumpily until you tend it (recovers fast — see _tended).
    this.caredToday = { fed: false, watered: false, brushed: false };
    this.neglected  = false;
  }

  // Apply time-based decay for `seconds` of elapsed time. `offline` caps how far
  // needs can fall so absence is forgiving.
  applyDecay(seconds, offline = false) {
    const floor = offline ? OFFLINE_FLOOR : 0;
    for (const key of ['hunger', 'thirst', 'grooming']) {
      const next = this.stats[key] - DECAY[key] * seconds;
      this.stats[key] = clamp(offline ? Math.max(floor, next) : next);
    }
    this.recomputeHappiness(seconds, offline);
  }

  // Happiness drifts toward how well the horse's needs are being met.
  recomputeHappiness(seconds, offline = false) {
    const target = (this.stats.hunger + this.stats.thirst + this.stats.grooming) / 3;
    const rate = 0.02 * seconds; // gentle drift
    let next = this.stats.happiness + (target - this.stats.happiness) * Math.min(1, rate);
    if (offline) next = Math.max(OFFLINE_FLOOR, next);
    this.stats.happiness = clamp(next);
  }

  feed() { this.stats.hunger = clamp(this.stats.hunger + 35); this._tended('fed'); }
  water() { this.stats.thirst = clamp(this.stats.thirst + 40); this._tended('watered'); }
  brush() { this.stats.grooming = clamp(this.stats.grooming + 30); this._tended('brushed'); }
  pet() { this.stats.happiness = clamp(this.stats.happiness + 8); this._tended('pet'); }

  // Record care for today's cycle. Any attention soothes a grumpy horse
  // immediately ("recovers fast"); whether it's neglected *tomorrow* still
  // depends on getting both fed and watered today (see rollNewDay).
  _tended(kind) {
    if (kind in this.caredToday) this.caredToday[kind] = true;
    this.neglected = false;
  }

  // Advance to a new day: a horse that missed food or water yesterday wakes up
  // neglected (grumpy on interaction). Then clear the day's care record.
  rollNewDay() {
    this.neglected = !(this.caredToday.fed && this.caredToday.watered);
    this.caredToday = { fed: false, watered: false, brushed: false };
  }

  // Overall mood label for friendly feedback.
  mood() {
    const h = this.stats.happiness;
    if (h >= 80) return 'happy';
    if (h >= 55) return 'content';
    if (h >= 30) return 'a bit down';
    return 'needs you';
  }

  toJSON() {
    const out = {
      id: this.id,
      name: this.name,
      breed: this.breed,
      coat: this.coat,
      age: this.age,
      temperament: this.temperament,
      stats: { ...this.stats },
      saddled: this.saddled,
      lastSeen: this.lastSeen
    };
    if (this.health  !== undefined) out.health  = this.health;
    if (this.speed   !== undefined) out.speed   = this.speed;
    if (this.stamina !== undefined) out.stamina = this.stamina;
    return out;
  }
}
