// Dev tool: pasture-fence PATH editing — a SECOND instance of the exact same
// house-fence bendable-joint drag tool (houseFencePath.js/fencePath.js), not
// a separate system.
//
// HISTORY: #376 first gave the pasture perimeter the same joint/segment DATA
// MODEL as the house fence, but its own separate rendering technique (whole
// rotated 'fence' tiles at 50% overlap). #386 was initially scoped to just
// swap that rendering technique to match the house fence's (cropped/un-
// rotated posts + separate rail lines) — but the owner then asked to go
// further: delete the old auto-generated 4-sided perimeter entirely and
// replace it with a manually-placed second fence instance, built with the
// SAME tool as the house fence (via `fencePath.js`'s shared engine), starting
// from a small blank run near the gate. The owner places/bends it himself
// live with the drag tool, then exports the joint list (same `_pastureFenceExport`
// JSON blob other bake-ins this session have used) for baking into
// `world.js`'s `buildPastureFence` as the permanent shape.
//
// GATE LINKING: a joint can carry `gateLink: 'left' | 'right'` instead of a
// plain fixed {x, y} — `_applyPastureGateLinks` (the `applyGateLinks` name
// below) re-derives that joint's position from `this.props.gate`'s CURRENT
// x/y every respace, so it stays glued to the gate even if the gate moves.
// Unlike #376's original version (which auto-tagged two hardcoded joints at
// the perimeter's original gate-flanking corners), this blank instance starts
// with NO joint linked — the owner links whichever joint he wants by TAPPING
// it (a plain tap that never becomes a drag toggles the link; dragging still
// reshapes the fence as normal) via `fencePath.js`'s `toggleGateLink`, wired
// up in devDrag.js's tap/drop handling.
//
// This extends the SAME #330 dev-drag-tool lifecycle houseFencePath.js does —
// see that file's header for the shared mount/tap/move/drop machinery this
// hangs off of (devDrag.js calls `_mountPastureFencePath`/`_clearPastureFencePath`
// alongside their house-fence counterparts).

import { createFencePathMixin, respaceFenceRun, buildFencePosts } from './fencePath.js';
import { PASTURE_FENCE_SPACING } from './constants.js';

// Kept for anything that still refers to the pasture fence's own names.
export const respacePastureFence   = respaceFenceRun;
export const buildPastureFencePosts = buildFencePosts;

export const WithPastureFencePath = createFencePathMixin({
  jointsProp:  'pastureFenceJoints',
  postsProp:   'pastureFence',
  marksField:  '_pastureJointMarks',
  heldField:   '_pastureJointHeld',
  markDepth:   9504,    // above the house-fence joint marks (9503) so both are visible at once
  handleColor: 0x59c8ff, // blue — distinct from the house fence's magenta
  label:       'Pasture Fence Post',
  spacing:     PASTURE_FENCE_SPACING, // matches the house fence's spacing convention (96px)
  gateLinkable: true,    // the pasture fence's joints can attach to the gate
  buildRailsMethod: '_buildPastureFenceRails', // world.js
  refitMethod: 'refitPastureFence',            // world.js
  names: {
    mount: '_mountPastureFencePath',
    clear: '_clearPastureFencePath',
    posts: '_pasturePosts',
    joints: '_pastureJoints',
    applyGateLinks: '_applyPastureGateLinks',
    fillPosts: '_fillPastureFencePosts',
    tap: '_pastureFencePathTap',
    resolveJoint: '_pastureFenceResolveJoint',
    toggleGateLink: '_pastureFenceToggleGateLink',
    pathMove: '_pastureFencePathMove',
    respace: '_respacePastureFenceFromJoints',
    drawJoints: '_drawPastureFenceJoints',
    export: '_pastureFenceExport',
  },
});
