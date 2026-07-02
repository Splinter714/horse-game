// Pure companion decision for the farm dog (#186), unit-tested in companion.test.js.
// Kept Phaser-free (only DOG_COMPANION tuning) so the choice is testable in the node
// test env, mirroring gateNudge.js. updateDogCompanion (companion.js) just applies the
// verb this returns each frame.
//
// Given the player's motion, how long they've stood idle, and the dog's distance to
// its follow slot behind the player, choose:
//   'sit'    — player idle a beat AND dog parked near its slot → settle on haunches
//   'follow' — dog beyond slack from its slot → trot to catch up
//   'hold'   — within slack → stay put (loose rope, not dragged)

import { DOG_COMPANION } from './constants.js';

export function companionDecision({ playerMoving, playerIdleMs, slotDist }, cfg = DOG_COMPANION) {
  if (!playerMoving && playerIdleMs > cfg.SIT_IDLE_MS && slotDist < cfg.SIT_NEAR) return 'sit';
  if (slotDist > cfg.SLACK) return 'follow';
  return 'hold';
}
