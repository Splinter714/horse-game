// Dev tool: house-fence PATH editing (#370, reworked into a bendable polyline
// by #375) — drag the run's start/end posts to respace the whole fence, and
// (#375) drag any individual #330-style per-post grab point to PROMOTE that
// post into a permanent joint, bending the fence around it.
//
// This extends #330 (devDrag.js) rather than duplicating its gesture/export
// machinery: it hangs off the SAME `dragObjects` on/off toggle and the SAME
// mount/clear lifecycle — devDrag.js's `_mountDevDrag`/`_clearDevDrag` call
// `_mountHouseFencePath`/`_clearHouseFencePath` below, and its
// `_devDragTap`/`_devDragMove`/`_devDragDrop` check the fence posts here
// BEFORE falling through to the generic per-post pick. One toggle, no new
// pause-menu row.
//
// #386: the actual joint/segment/promote/rail/gate-link engine used to live
// entirely in this file; it's now shared with a SECOND instance (the pasture
// fence, pastureFencePath.js) via `fencePath.js`'s `createFencePathMixin`, so
// the two fences are literally the same tool rather than look-alikes built
// twice. This file is now just the house fence's SPEC — which `this.props`
// keys it reads/writes, which instance fields hold its drag state, its
// marker color/depth — handed to that shared engine. See fencePath.js for
// the full behavior (promotion, respace, rails, export) this spec drives.
//
// Joint handles are drawn as filled magenta circles — visually distinct from
// the #330 per-post amber/green squares — so "grab a joint" reads as a
// different gesture from "grab this auto-filled post" even though both live
// on the same fence line, and every joint (not just the run's ends) gets one.

import { createFencePathMixin, respaceFenceRun, buildFencePosts } from './fencePath.js';

// Kept under their original names — some comments elsewhere in the repo still
// refer to `respaceHouseFence`/`buildHouseFencePosts` by name.
export const respaceHouseFence   = respaceFenceRun;
export const buildHouseFencePosts = buildFencePosts;

export const WithHouseFencePath = createFencePathMixin({
  jointsProp:  'houseFenceJoints',
  postsProp:   'houseFence',
  marksField:  '_fenceJointMarks',
  heldField:   '_fenceJointHeld',
  markDepth:   9503,    // above the #330 per-post drag marks (devDrag.js's MARK_DEPTH)
  handleColor: 0xff59e0, // magenta — distinct from the amber (unmoved) / green (moved) post squares
  label:       'Fence Post',
  gateLinkable: false,   // the house fence has no gate
  buildRailsMethod: '_buildHouseFenceRails', // world.js
  refitMethod: 'refitHouseFence',            // world.js
  names: {
    mount: '_mountHouseFencePath',
    clear: '_clearHouseFencePath',
    posts: '_fencePosts',
    joints: '_fenceJoints',
    applyGateLinks: '_houseFenceApplyGateLinks', // unused (gateLinkable: false), kept for symmetry
    fillPosts: '_fillHouseFencePosts',
    tap: '_houseFencePathTap',
    resolveJoint: '_houseFenceResolveJoint',
    deleteNode: '_houseFenceDeleteNode', // #394 — double-tap-to-remove-a-bend
    toggleGateLink: '_houseFenceToggleGateLink', // unused (gateLinkable: false)
    pathMove: '_houseFencePathMove',
    respace: '_respaceHouseFenceFromJoints',
    drawJoints: '_drawFenceJoints',
    export: '_houseFenceExport',
  },
});
