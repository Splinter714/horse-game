// The Horse model: identity, coat (drives the sprite), needs, and the gentle
// decay/care logic. Kid-friendly: needs fall slowly and offline decay is capped
// so a horse is never neglected into misery just because the game was closed.

const MAX = 100;

// Per-second decay while playing. Tuned so a well-fed horse stays content for a
// long play session; full depletion would take ~2 hours of continuous play.
const DECAY = {
  hunger: 0.014,
  thirst: 0.018,
  grooming: 0.008
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
    this.stats = {
      hunger: data.stats?.hunger ?? 80,
      thirst: data.stats?.thirst ?? 75,
      grooming: data.stats?.grooming ?? 60,
      happiness: data.stats?.happiness ?? 85
    };
    this.lastSeen = data.lastSeen ?? Date.now();
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

  feed() { this.stats.hunger = clamp(this.stats.hunger + 35); }
  water() { this.stats.thirst = clamp(this.stats.thirst + 40); }
  brush() { this.stats.grooming = clamp(this.stats.grooming + 30); }
  pet() { this.stats.happiness = clamp(this.stats.happiness + 8); }

  // Overall mood label for friendly feedback.
  mood() {
    const h = this.stats.happiness;
    if (h >= 80) return 'happy';
    if (h >= 55) return 'content';
    if (h >= 30) return 'a bit down';
    return 'needs you';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      breed: this.breed,
      coat: this.coat,
      age: this.age,
      stats: { ...this.stats },
      lastSeen: this.lastSeen
    };
  }
}
