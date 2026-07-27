// Water-trough drinking spots (#336) — pure geometry + claim logic, no Phaser.
//
// The trough runs north–south (its art was rotated 90°, see art/worldArt.js), so
// its two LONG sides face west and east. Instead of the old single pair of end
// anchors (which capped the trough at two drinkers), each long side carries a few
// discrete standing spots, so several horses can drink shoulder to shoulder.
//
// A spot is only usable if the drinker can actually get to it: the scene supplies
// `canStand` / `clearLine` / `canPath` predicates (its obstacle + pathfinding
// helpers), and the ordering below prefers a spot the drinker can walk STRAIGHT
// to — which is what stops a horse on the west side "drinking through" the trough
// from an east-side spot, since the straight line would cross the trough's own
// collision box.

// Offsets from the trough's centre. dx ≈ half the trough's collision width (22) +
// a horse's body radius + a little margin, so the anchor is genuinely standable;
// dy spreads three spots along each 200px-long side.
export const TROUGH_SPOT_OFFSETS = [
  { side: 'west', dx: -62, dy: -56 },
  { side: 'west', dx: -62, dy: 0 },
  { side: 'west', dx: -62, dy: 56 },
  { side: 'east', dx: 62, dy: -56 },
  { side: 'east', dx: 62, dy: 0 },
  { side: 'east', dx: 62, dy: 56 },
];

// Two drinkers' claims must be at least this far apart (≈ a horse body), so a
// spot next to one that's already claimed still counts as free.
export const TROUGH_SPOT_SPACING = 44;

// World-space drinking spots for a trough prop ({x, y}).
export function troughDrinkSpots(trough) {
  if (!trough) return [];
  return TROUGH_SPOT_OFFSETS.map((o, i) => ({
    i, side: o.side, x: trough.x + o.dx, y: trough.y + o.dy,
  }));
}

// Nearest free + reachable spot for a drinker at `from`, or null if there isn't
// one (caller wanders instead). `taken` is the list of spots other drinkers have
// already claimed. Predicates default to permissive so the maths can be tested
// on its own.
export function pickTroughSpot(spots, from, taken = [], opts = {}) {
  const spacing   = opts.spacing ?? TROUGH_SPOT_SPACING;
  const canStand  = opts.canStand  ?? (() => true);
  const clearLine = opts.clearLine ?? (() => true);
  const canPath   = opts.canPath   ?? (() => true);
  const dist = (s) => Math.hypot(s.x - from.x, s.y - from.y);

  const free = spots
    .filter(s => canStand(s))
    .filter(s => !taken.some(t => t && Math.hypot(t.x - s.x, t.y - s.y) < spacing))
    .sort((a, b) => dist(a) - dist(b));

  // Prefer a spot on the side the drinker is already on — one it can walk to in a
  // straight line, never across the trough itself.
  const direct = free.find(s => clearLine(s));
  if (direct) return direct;

  // Otherwise it has to walk around the end of the trough: only allow it when a
  // real route exists (a blocked side stays off-limits). `canPath` is the full
  // A* search, so only the nearest couple of candidates are probed — a thirsty
  // animal that can't get to those simply wanders and tries again later.
  const probes = opts.maxPathProbes ?? 2;
  return free.slice(0, probes).find(s => canPath(s)) ?? null;
}
