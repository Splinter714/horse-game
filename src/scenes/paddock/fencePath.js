// Shared engine behind the #375/#370 house-fence bendable-joint drag tool —
// factored out by #386 so a SECOND fence instance (the pasture fence) can be
// the literal SAME tool operating on a different joint/post prop pair, not a
// parallel reimplementation. `createFencePathMixin(spec)` builds one mixin;
// houseFencePath.js and pastureFencePath.js each call it once with their own
// spec (which props keys to read/write, which instance fields to keep drag
// state in, marker color/depth, and whether gate-linked joints are supported)
// and get back a mixin exposing the SAME externally-named methods devDrag.js
// already calls for both fences (`_mount<K>FencePath`, `_<k>FencePathTap`,
// etc. — see each spec's `names` block for the exact strings, chosen to match
// what devDrag.js already expected before this split).
//
// PATTERN (unchanged from the pre-#386 houseFencePath.js/pastureFencePath.js):
// an ordered list of JOINTS (`this.props[spec.jointsProp]`) — a chain of
// straight SEGMENTS the fence bends around. `respaceFenceRun` "how many posts
// fit at ~96px spacing" maths runs once PER SEGMENT; `buildFencePosts`
// stitches every segment's posts into the flat ordered list
// (`this.props[spec.postsProp]`) the rest of the game reads, tagging each
// post with either `jointIndex` (it IS a joint) or `segIndex` (an auto-filled
// interior post of that segment). Dragging an existing joint moves it;
// dragging an interior post PROMOTES it into a new joint, splitting its
// segment in two (`resolveJoint`, deferred until the press actually becomes a
// drag past TAP_SLOP in devDrag.js, so a stray tap can't silently plant one).
//
// GATE-LINKING (#376, generalized by #386 for the second instance): a joint
// can carry `gateLink: 'left' | 'right'` instead of a plain fixed {x, y} —
// `applyGateLinks` re-derives that joint's position from `this.props.gate`'s
// CURRENT x/y (at a fixed half-gate-width offset) every respace, so it stays
// glued to the gate even if the gate itself moves. #376 only ever tagged two
// hardcoded joints (the original perimeter's gate-flanking ends); #386's
// blank/manually-placed instance instead lets the owner toggle the link on
// WHICHEVER joint he taps (a plain tap, not a drag, on an existing joint —
// see `pathTap`/devDrag.js's drop handling), since there's no fixed shape to
// derive it from anymore.
//
// Posts are rendered with the house fence's #372/#375 technique: cropped to
// just the post column and drawn UN-ROTATED, split into a cap sprite (above
// the top rail, drawn in front of the rail Graphics) and a body sprite (the
// rest, drawn behind it) — see `_buildHouseFencePostSprites`'s original
// comment in the pre-split file (now here) for why. The rails themselves are
// drawn by world.js's `_buildFenceRails` (also generalized by #386), called
// from `respaceFromJoints` below via `spec.buildRailsMethod`.

import { S, FENCE_TEX_H, FENCE_POST_CROP_W, FENCE_POST_TOP_SPLIT_Y, GATE_HALF_W } from './constants.js';

const DEFAULT_SPACING = 96; // world px between posts — matches the fence's original fixed spacing
const POST_PICK_R     = 40; // world px: how close a tap must be to grab ANY post (joint or auto-fill)
const HANDLE_R         = 12; // drawn radius of a joint marker, world px

// Pure: given a desired start/end world point, how many posts fit at
// `spacing` and where they land, evenly spread along the straight line
// between them. Exported so it can be sanity-checked without Phaser.
export function respaceFenceRun(start, end, spacing = DEFAULT_SPACING) {
  const dist  = Math.hypot(end.x - start.x, end.y - start.y);
  const count = Math.max(2, Math.round(dist / spacing) + 1);
  const posts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    posts.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return posts;
}

// Pure: the average y of two consecutive joints — the depth ONE rail segment
// (the straight run between joints[i] and joints[i+1]) is drawn at. #396: this
// used to be computed once for the WHOLE run (every joint averaged together),
// which is wrong for any fence whose span crosses a character's y — a player
// standing near the south end of a long fence would sort against a depth
// dragged north by the run's far joints. Every OTHER sprite in this game
// (player/horses/chickens/birds) is depth-sorted by its own actual y
// (`.setDepth(sprite.y)`); a fence segment doesn't move, but it still needs
// its BASE depth to reflect only the stretch of fence it actually draws, so a
// moving player's live-y depth sorts against it correctly no matter where
// along the run they are. Shared by both fence instances AND world.js's
// `_buildFenceRails` (a plain function, not a per-instance method, so it
// isn't defined twice across the two `createFencePathMixin` classes — see the
// "unique method names" convention in the paddock README).
export function fenceSegmentDepth(a, b) {
  return (a.y + b.y) / 2;
}

// The two split sprites for one post (#375 owner ask, carried over to a
// second fence instance by #386): a cap (above the top rail's centerline)
// drawn IN FRONT of the rail Graphics, and a body (the rest, including where
// the bottom rail crosses it) drawn BEHIND it. Plain functions (not instance
// methods) for the same "not defined twice across two mixin classes" reason
// as `fenceSegmentDepth` above — `scene` is passed in explicitly. #396: the
// base depth passed in is now the POST'S OWN y (matching the "depth = actual
// y" convention every other sprite in the game follows), not a run-wide
// average, so a post sorts correctly against a character standing near IT
// specifically, not near wherever the run's average happened to land.
export function buildFencePostSprites(scene, x, y, baseDepth) {
  const topSprite = scene.add.image(x, y, 'fence').setScale(S).setOrigin(0, 0.5)
    .setDepth(baseDepth + 1)
    .setCrop(0, 0, FENCE_POST_CROP_W, FENCE_POST_TOP_SPLIT_Y);
  const bottomSprite = scene.add.image(x, y, 'fence').setScale(S).setOrigin(0, 0.5)
    .setDepth(baseDepth - 1)
    .setCrop(0, FENCE_POST_TOP_SPLIT_Y, FENCE_POST_CROP_W, FENCE_TEX_H - FENCE_POST_TOP_SPLIT_Y);
  return { topSprite, bottomSprite };
}

export function destroyFencePostSprites(post) {
  post.topSprite?.destroy();
  post.bottomSprite?.destroy();
}

// Pure: the full ordered post list for a JOINT polyline — one
// `respaceFenceRun` call per segment (joints[i] → joints[i+1]), stitched
// together without double-counting the post shared at each segment boundary.
// Every post is tagged with either `jointIndex` (it IS joints[jointIndex]) or
// `segIndex` (it's an auto-filled interior post of segment `segIndex`, i.e.
// between joints[segIndex] and joints[segIndex+1]).
export function buildFencePosts(joints, spacing = DEFAULT_SPACING) {
  if (!joints || joints.length < 2) return [];
  const posts = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const segPosts = respaceFenceRun(joints[i], joints[i + 1], spacing);
    segPosts.forEach((p, j) => {
      const isStart = j === 0;
      const isEnd   = j === segPosts.length - 1;
      if (i > 0 && isStart) return; // shared joint post — already pushed by the previous segment
      const rec = { x: p.x, y: p.y };
      if (isStart) rec.jointIndex = i;
      else if (isEnd) rec.jointIndex = i + 1;
      else rec.segIndex = i;
      posts.push(rec);
    });
  }
  return posts;
}

// `spec` shape:
//   jointsProp, postsProp   — keys under `this.props` this instance reads/writes
//   marksField, heldField   — instance fields (unique per instance) for the
//                             joint-marker Graphics + the in-progress drag state
//   markDepth, handleColor  — how the joint markers are drawn
//   label                   — post label prefix, e.g. "Fence Post"
//   spacing                 — world px between posts (default 96)
//   gateLinkable            — whether joints on this instance may carry `gateLink`
//   buildRailsMethod        — name of the scene method (world.js) that (re)draws
//                             this instance's rail Graphics, e.g. `_buildHouseFenceRails`
//   refitMethod             — name of the scene method (world.js) that refits collision
//   names                   — the externally-called method names devDrag.js/world.js
//                             use for THIS instance (see houseFencePath.js/
//                             pastureFencePath.js for the exact strings each passes)
export function createFencePathMixin(spec) {
  const {
    jointsProp, postsProp, marksField, heldField,
    markDepth, handleColor, label, spacing = DEFAULT_SPACING,
    gateLinkable = false, buildRailsMethod, refitMethod, names,
  } = spec;

  return (Base) => class extends Base {
    [names.mount]() {
      this[marksField] = this.add.graphics().setDepth(markDepth);
      this[heldField]  = null; // { pending: post } | { index } | null
      this[names.drawJoints]();
    }

    [names.clear]() {
      this[marksField]?.destroy();
      this[marksField] = null;
      this[heldField]  = null;
    }

    [names.posts]()  { return this.props[postsProp]  ?? []; }
    [names.joints]() { return this.props[jointsProp] ?? []; }

    // Re-derive the position of any `gateLink`-tagged joint from
    // `this.props.gate`'s CURRENT x/y, before the segment respace maths
    // below consumes the joint list. No-op for a non-gate-linkable instance.
    //
    // #392: a joint's x is a post sprite's ANCHOR, not its visual center —
    // `buildFencePostSprites` draws with origin (0, 0.5), so the post's actual
    // visible body sits `cx` (half the cropped post width) to the right of the
    // anchor, always, regardless of which side of the gate the joint is on
    // (`_buildFenceRails` in world.js applies this same `+cx` shift so the
    // rails hit the post's real center instead of its anchor). Setting the
    // anchor to exactly `gate.x ± GATE_HALF_W` therefore put the LEFT post's
    // visible body `cx` px too far toward the gate (into the opening) and the
    // RIGHT post's visible body `cx` px too far away from it — the two sides
    // read as asymmetric even though the joint coordinates were mirrored.
    // Subtracting `cx` from the anchor on both sides (uniformly, same as the
    // rail shift) puts each post's actual VISUAL center at `gate.x ±
    // GATE_HALF_W`, so both sides attach the same way relative to the gate.
    [names.applyGateLinks](joints) {
      if (!gateLinkable) return;
      const gate = this.props.gate;
      if (!gate) return;
      const cx = (FENCE_POST_CROP_W * S) / 2;
      for (const j of joints) {
        if (j.gateLink === 'left')  { j.x = gate.x - GATE_HALF_W - cx; j.y = gate.y; }
        if (j.gateLink === 'right') { j.x = gate.x + GATE_HALF_W - cx; j.y = gate.y; }
      }
    }

    // Build every post for `joints` and push them onto `this.props[postsProp]`
    // (assumed already emptied by the caller). #396: each post's depth is
    // derived from ITS OWN y, not one shared run-wide average — see
    // `buildFencePostSprites`'s comment.
    [names.fillPosts](joints) {
      const posts = this.props[postsProp];
      const specs = buildFencePosts(joints, spacing);
      specs.forEach((p, i) => {
        const { topSprite, bottomSprite } = buildFencePostSprites(this, p.x, p.y, p.y);
        posts.push({
          x: p.x, y: p.y, topSprite, bottomSprite, label: `${label} ${i + 1}`,
          jointIndex: p.jointIndex, segIndex: p.segIndex,
        });
      });
    }

    // Called from devDrag.js's `_devDragTap`, in WORLD space, BEFORE the
    // generic per-post pick — so grabbing ANY post on this fence always means
    // "reshape the fence", never "move this one sprite". Returns a PENDING
    // descriptor so a plain tap that never becomes a drag can't silently
    // promote an interior post — see `resolveJoint`.
    [names.tap](w) {
      const posts = this[names.posts]();
      let best = null, bestD = POST_PICK_R;
      for (const p of posts) {
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best ? { pending: best } : null;
    }

    // Called from devDrag.js's `_devDragMove` the FIRST tick a press on a
    // post actually travels past TAP_SLOP — i.e. it's definitely a drag, not
    // a tap. If the grabbed post is already a joint, resolves to its index;
    // if it's an auto-filled interior post, PROMOTES it — splices a new
    // joint at its current position, splitting its segment into two.
    [names.resolveJoint](held) {
      if (!held || held.index !== undefined) return held;
      const post = held.pending;
      if (post.jointIndex !== undefined) return { index: post.jointIndex };
      const joints = this[names.joints]();
      const idx = post.segIndex + 1;
      joints.splice(idx, 0, { x: post.x, y: post.y });
      this[names.respace]();
      return { index: idx };
    }

    // A gate-linkable instance only: called from devDrag.js's drop handler
    // when a press on an EXISTING joint never became a drag (a plain tap) —
    // toggles that joint's gate link on/off, so the owner can attach/detach
    // whichever joint he taps to the gate while placing the fence live.
    // No-op for a non-gate-linkable instance or a pending (not-yet-a-joint) post.
    [names.toggleGateLink](held) {
      if (!gateLinkable || !held) return false;
      const post = held.pending ?? held;
      const jointIndex = held.index ?? post.jointIndex;
      if (jointIndex === undefined) return false;
      const joints = this[names.joints]();
      const j = joints[jointIndex];
      if (!j) return false;
      if (j.gateLink) {
        delete j.gateLink;
      } else {
        const gate = this.props.gate;
        if (!gate) return false;
        j.gateLink = j.x < gate.x ? 'left' : 'right';
      }
      this[names.respace]();
      return true;
    }

    // #394: given an EXISTING joint (already resolved — `held.index`, or a
    // `{ pending: post }` whose post already turned out to be a joint), splice
    // it back OUT of the joint list so the fence goes straight between its
    // former neighbors again — the inverse of `resolveJoint` promoting an
    // auto-fill post INTO a joint. Never removes the run's absolute first/last
    // joint (those are the anchors, not a bend, and removing one would need a
    // whole different "shorten the run" gesture this isn't) — a no-op on an
    // endpoint or on a not-yet-a-joint pending post. Because only an INTERIOR
    // joint can ever be deleted, and only the two endpoint joints are ever
    // gate/endpoint-linked cross-references, deleting a joint never leaves a
    // dangling link to clean up — the joint (and whatever `gateLink` tag it
    // carried) is simply removed with it.
    [names.deleteNode](held) {
      if (!held) return false;
      const post = held.pending ?? held;
      const jointIndex = held.index ?? post.jointIndex;
      if (jointIndex === undefined) return false;
      const joints = this[names.joints]();
      if (jointIndex <= 0 || jointIndex >= joints.length - 1) return false; // anchors — never deletable
      joints.splice(jointIndex, 1);
      this[names.respace]();
      return true;
    }

    // Called from devDrag.js's `_devDragMove` on every tick while a joint is held.
    [names.pathMove](jointIndex, w) {
      const joints = this[names.joints]();
      if (!joints[jointIndex]) return;
      joints[jointIndex].x = w.x;
      joints[jointIndex].y = w.y;
      this[names.respace]();
      this._dragHud?.setText(
        `${label}: ${this[names.posts]().length} posts (dragging joint ${jointIndex + 1}/${joints.length})`);
    }

    // Destroy/recreate every post sprite for the current joint list, mutating
    // `this.props[postsProp]` IN PLACE (same array object, not a new one) so
    // the collision segments and #330 drag-tool object list keep following
    // it, then redraw the rails and refit collision.
    [names.respace]() {
      const posts = this[names.posts]();
      if (!posts.length) return;
      const joints = this[names.joints]();
      this[names.applyGateLinks](joints);
      for (const p of posts) destroyFencePostSprites(p);
      posts.length = 0;
      this[names.fillPosts](joints);
      this[buildRailsMethod]?.(joints);
      this[refitMethod]?.();
      this._refreshDragEntries?.();
      this[names.drawJoints]();
    }

    [names.drawJoints]() {
      const g = this[marksField];
      if (!g) return;
      g.clear();
      const joints = this[names.joints]();
      joints.forEach((p, i) => {
        const held = this[heldField]?.index === i;
        g.fillStyle(handleColor, held ? 0.45 : 0.25);
        g.fillCircle(p.x, p.y, HANDLE_R);
        g.lineStyle(2, handleColor, held ? 1 : 0.85);
        g.strokeCircle(p.x, p.y, HANDLE_R);
        if (gateLinkable && p.gateLink) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeCircle(p.x, p.y, HANDLE_R + 4); // extra ring: linked to the gate
        }
      });
    }

    // The current run's full joint list (rounded) + post count, for the #330-
    // style export — bakeable straight into world.js. Null while there's no fence.
    [names.export]() {
      const joints = this[names.joints]();
      const posts  = this[names.posts]();
      if (joints.length < 2 || posts.length < 2) return null;
      return {
        joints: joints.map(j => ({
          x: Math.round(j.x), y: Math.round(j.y),
          ...(gateLinkable && j.gateLink ? { gateLink: j.gateLink } : {}),
        })),
        count: posts.length,
      };
    }
  };
}
