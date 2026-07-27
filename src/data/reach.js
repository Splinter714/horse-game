// Did a mover actually GET to the spot it set out for? (#346)
//
// Every goal-directed animal trip in the paddock walks via moveCreatureTo and
// applies its effect in the arrival callback — eat the hay pile, drink from the
// trough, lap at the stream. That callback used to fire unconditionally, even on
// trips that never happened: when the A* pathfinder finds no route it calls the
// arrival callback anyway ("nowhere reachable — stay put"), and a trip aborted at
// a shut gate parks the animal at the gate. The result was an animal applying a
// care action from wherever it happened to be standing — e.g. a horse shut inside
// the barn drinking from the trough straight through the barn wall.
//
// So arrival is now checked, not assumed: the effect only lands if the animal is
// genuinely at the goal. Kept here as pure maths so it's unit-testable without
// Phaser (the scene mixins can't be imported in the node test env).

// How far from its goal an arriving animal may still be and count as "there".
// Generous on purpose — the pathfinder snaps a blocked goal cell to the nearest
// free one (grid CELL is 24px), and the eat/drink stand-offs already aim a body's
// width short of the target — but far below any "across a wall" distance, which
// is hundreds of px (the barn's west wall is ~200px from the trough's east end,
// and a horse inside the barn is 280px+ from it).
export const ARRIVE_TOL = 90;

// True when (x,y) is within `tol` of the goal (tx,ty).
export function reachedGoal(x, y, tx, ty, tol = ARRIVE_TOL) {
  return Math.hypot(x - tx, y - ty) <= tol;
}
