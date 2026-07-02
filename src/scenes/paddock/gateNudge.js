// Pure geometry for the gate-close nudge (#117). When the gate shuts on an entity
// standing in its footprint, we push it clear on whichever side it's already on.
// The switchover between "push north (farm)" and "push south (pasture)" must sit at
// the true fence line — the actual north/south divide — not at an offset point inside
// the gate footprint, or an entity a hair south of the line reads as getting shoved
// the unnatural direction back into the farm.

// Given an entity's current y, the gate obstacle rect ({y, h}), and the fence line
// y that divides farm (north) from pasture (south), return the y just clear of the
// gate on the side the entity is currently on. `margin` is how far past the gate edge
// to place it. Kept pure so the side decision is unit-testable.
export function gateNudgeY(entityY, gate, fenceLineY, margin = 15) {
  const south = entityY >= fenceLineY;
  return south ? gate.y + gate.h + margin : gate.y - margin;
}
