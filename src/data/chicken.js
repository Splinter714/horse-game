// The Chicken model: identity, coat (drives the sprite), and basic stats.
// Similar to Horse but simpler — chickens just need name and appearance.

const MAX = 100;

export class Chicken {
  constructor(data = {}) {
    this.id = data.id ?? `chicken-${Math.random().toString(36).slice(2, 9)}`;
    this.name = data.name ?? 'Hen';
    this.breed = data.breed ?? 'Chicken';
    this.coat = data.coat ?? 0; // coat index 0-4
    this.age = data.age ?? 1;
    this.personality = data.personality ?? 'friendly'; // friendly, broody, adventurous, etc.
    this.lastSeen = data.lastSeen ?? Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      breed: this.breed,
      coat: this.coat,
      age: this.age,
      personality: this.personality,
      lastSeen: this.lastSeen
    };
  }
}
