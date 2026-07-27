import { describe, it, expect } from 'vitest';
import { WithDevDrag } from './devDrag.js';
import { WithDevLabels } from './devLabels.js';

// The two halves worth testing without Phaser: the SHIFT (a prop is usually a
// plain `{x, y, sprite}` record, so both the record's numbers and its child
// sprites have to move together — a half-move is the bug this guards) and the
// EXPORT (only things actually moved, with their original coordinates alongside).
//
// `_devLabelTargets` comes from the #329 mixin on purpose: the drag tool must
// keep enumerating the world through that one shared function.

const Scene = WithDevDrag(WithDevLabels(class {}));

// Minimal stand-in for a Phaser GameObject: x/y + setPosition/setDepth.
function fakeSprite(x, y, depth = y) {
  return {
    x, y, depth,
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
    setDepth(d) { this.depth = d; return this; },
  };
}

describe('dev drag: moving a placed object (#330)', () => {
  it('shifts a prop record AND its child sprite together', () => {
    const s = new Scene();
    const sprite = fakeSprite(300, 1000);
    const prop = { x: 300, y: 1000, sprite, level: 0 };
    s._devDragShiftEntry({ obj: prop, also: [] }, 25, -40);

    expect(prop).toMatchObject({ x: 325, y: 960 });
    expect(sprite.x).toBe(325);
    expect(sprite.y).toBe(960);
    // Depth is y-sorted in this game — a sprite whose depth tracked its y keeps doing so.
    expect(sprite.depth).toBe(960);
  });

  it('moves same-spot duplicates (`also`) by the same delta', () => {
    const s = new Scene();
    const a = fakeSprite(100, 100);
    const b = fakeSprite(100, 100);
    s._devDragShiftEntry({ obj: a, also: [b] }, 10, 10);
    expect([a.x, a.y]).toEqual([110, 110]);
    expect([b.x, b.y]).toEqual([110, 110]);
  });

  it('leaves a sprite whose depth is not y-sorted alone', () => {
    const s = new Scene();
    const sprite = fakeSprite(50, 50, 4000);
    s._devDragShiftEntry({ obj: sprite, also: [] }, 5, 5);
    expect(sprite.depth).toBe(4000);
  });

  it('is a no-op for a zero delta', () => {
    const s = new Scene();
    const sprite = fakeSprite(10, 20);
    s._devDragShiftEntry({ obj: sprite, also: [] }, 0, 0);
    expect([sprite.x, sprite.y]).toEqual([10, 20]);
  });
});

// Collision has to follow the art (#330 follow-up). Obstacles are built once at
// create() from the props' live coordinates, so each rect carries `own` — the prop
// record it came from — and a drag shifts every rect owned by what's being dragged.
describe('dev drag: collision follows the dragged object (#330)', () => {
  it('shifts the dragged prop’s obstacle rect by the same delta', () => {
    const s = new Scene();
    const trough = { x: 600, y: 500, sprite: fakeSprite(600, 500) };
    const rect = { x: 512, y: 478, w: 176, h: 44, isTrough: true, own: trough };
    s.obstacles = [rect];

    s._devDragShiftEntry({ obj: trough, also: [] }, 40, -20);
    expect(trough).toMatchObject({ x: 640, y: 480 });
    expect([rect.x, rect.y]).toEqual([552, 458]);
    expect([rect.w, rect.h]).toEqual([176, 44]); // size untouched, only the position
  });

  it('moves every rect of a multi-rect object (the barn walls) together', () => {
    const s = new Scene();
    const barn = { x: 1000, y: 700, sprite: fakeSprite(1000, 700) };
    const walls = [
      { x: 900, y: 600, w: 200, h: 14, isBarn: true, own: barn },
      { x: 900, y: 600, w: 14, h: 120, isBarn: true, own: barn },
    ];
    s.obstacles = [...walls];
    s._devDragShiftEntry({ obj: barn, also: [] }, -50, 30);
    for (const w of walls) expect([w.x, w.y]).toEqual([850, 630]);
  });

  it('leaves unowned rects (the pasture fence, the stream) alone', () => {
    const s = new Scene();
    const prop = { x: 300, y: 300 };
    const fence = { x: 0, y: 0, w: 900, h: 20, isFence: true };
    s.obstacles = [fence, { x: 280, y: 280, w: 40, h: 40, own: prop }];
    s._devDragShiftEntry({ obj: prop, also: [] }, 100, 100);
    expect([fence.x, fence.y]).toEqual([0, 0]);
  });

  it('shifts rects owned by same-spot duplicates (`also`) too', () => {
    const s = new Scene();
    const bowl = { x: 165, y: 420 };
    const dupe = { x: 165, y: 420 }; // the same bowl reached via a generic list
    const rect = { x: 143, y: 392, w: 44, h: 24, isPetBowl: true, own: dupe };
    s.obstacles = [rect];
    s._devDragShiftEntry({ obj: bowl, also: [dupe] }, 10, 10);
    expect([rect.x, rect.y]).toEqual([153, 402]);
  });

  it('moves the gate rect even while it sits outside this.obstacles (gate open)', () => {
    const s = new Scene();
    const gate = { x: 960, y: 320, open: true, sprite: fakeSprite(960, 320) };
    s.gateObstacle = { x: 904, y: 310, w: 112, h: 20, isGate: true, own: gate };
    s.obstacles = []; // an open gate is spliced out of the list until it's shut again
    s._devDragShiftEntry({ obj: gate, also: [] }, 0, 60);
    expect([s.gateObstacle.x, s.gateObstacle.y]).toEqual([904, 370]);
  });

  it('puts collision back where it started when the drag is reset', () => {
    const s = new Scene();
    const prop = { x: 300, y: 1000 };
    const rect = { x: 260, y: 960, w: 80, h: 40, own: prop };
    s.obstacles = [rect];
    s._dragEntries = [{ name: 'compostBin', obj: prop, also: [], ox: 300, oy: 1000 }];
    s._devDragShiftEntry(s._dragEntries[0], 120, -75);
    expect([rect.x, rect.y]).toEqual([380, 885]);

    // resetDevPositions replays the inverse delta through the same path.
    s._devDragShiftEntry(s._dragEntries[0], 300 - prop.x, 1000 - prop.y);
    expect([rect.x, rect.y]).toEqual([260, 960]);
  });
});

// A rect derived from SEVERAL prop records — the house fence's six posts (#344) —
// can't be delta-shifted, because moving one post changes the band's size, not just
// its position. Those carry `ownGroup` + `refit()` and get re-derived instead.
describe('dev drag: group-owned collision (the house fence, #344)', () => {
  const fenceScene = () => {
    const s = new Scene();
    const posts = Array.from({ length: 6 }, (_, i) => ({ x: 300 + i * 96, y: 320 }));
    const rect = {
      x: 300, y: 300, w: 576, h: 40, isFence: true, ownGroup: posts,
      refit() { // stands in for world.js's _fitHouseFenceRect
        const xs = posts.map((p) => p.x), ys = posts.map((p) => p.y);
        this.x = Math.min(...xs); this.w = Math.max(...xs) + 96 - this.x;
        this.y = Math.min(...ys) - 20; this.h = Math.max(...ys) + 20 - this.y;
      },
    };
    s.obstacles = [rect];
    return { s, posts, rect };
  };

  it('re-derives the band when the whole run is group-dragged', () => {
    const { s, posts, rect } = fenceScene();
    // The #337 multi-select drag: every post moves by the same delta as one entry.
    for (const p of posts) s._devDragShiftEntry({ obj: p, also: [] }, -436, -263);
    expect([rect.x, rect.y, rect.w, rect.h]).toEqual([-136, 37, 576, 40]);
  });

  it('grows the band when a single post is dragged out of the run', () => {
    const { s, rect, posts } = fenceScene();
    s._devDragShiftEntry({ obj: posts[5], also: [] }, 120, 0);
    expect(rect.x).toBe(300);
    expect(rect.w).toBe(696); // 780+120+96 − 300 — a delta-shift would have kept 576
  });

  it('leaves a group-owned rect alone when something else is dragged', () => {
    const { s, rect } = fenceScene();
    s._devDragShiftEntry({ obj: { x: 900, y: 900 }, also: [] }, 50, 50);
    expect([rect.x, rect.y, rect.w, rect.h]).toEqual([300, 300, 576, 40]);
  });
});

describe('dev drag: export (#330)', () => {
  it('reports only objects that actually moved, with where they came from', () => {
    const s = new Scene();
    s._dragEntries = [
      { name: 'beehive', obj: { x: 1450, y: 380 }, also: [], ox: 1450, oy: 300 },
      { name: 'coop',    obj: { x: 900,  y: 470 }, also: [], ox: 900,  oy: 470 },
    ];
    expect(s._devMovedPositions()).toEqual({
      beehive: { x: 1450, y: 380, from: { x: 1450, y: 300 } },
    });
  });

  it('reports nothing before anything is dragged', () => {
    const s = new Scene();
    s._dragEntries = [{ name: 'coop', obj: { x: 900, y: 470 }, also: [], ox: 900, oy: 470 }];
    expect(s._devMovedPositions()).toEqual({});
  });
});

describe('dev drag: object enumeration is shared with the #329 label tool', () => {
  it('carries the live object and its same-spot duplicates', () => {
    const s = new Scene();
    const bowl = { x: 400, y: 300 };
    const dupe = { x: 400, y: 300 }; // same spot, e.g. a generic list member
    s.props = { catBowl: bowl, petBowls: [dupe] };

    const targets = s._devLabelTargets();
    const entry = targets.find(t => t.name === 'catBowl');
    expect(entry.obj).toBe(bowl);          // draggable handle, not just coordinates
    expect(entry.also).toContain(dupe);    // stacked object comes along for the ride
    // The duplicate is still deduped out of the label list itself.
    expect(targets).toHaveLength(1);
  });
});

// Minimal stand-in for a Phaser Text label: just enough of the getData/setData/
// setVisible surface `_updateDevLabelVisibility` touches.
function fakeLabel(at, obj) {
  const data = { at, obj };
  return {
    visible: false,
    getData(k) { return data[k]; },
    setData(k, v) { data[k] = v; return this; },
    setVisible(v) { this.visible = v; return this; },
  };
}

describe('dev labels: the dragged/held object always shows its label (#330)', () => {
  it('forces the held object visible even outside LABEL_RADIUS', () => {
    const s = new Scene();
    s.player = { sprite: { x: 0, y: 0 } };
    const farObj = { x: 5000, y: 5000 }; // way outside LABEL_RADIUS (80px)
    const nearObj = { x: 10, y: 10 };
    const farLabel = fakeLabel({ x: 5000, y: 5000 }, farObj);
    const nearLabel = fakeLabel({ x: 10, y: 10 }, nearObj);
    s._devObjLabels = [farLabel, nearLabel];
    s._devLabelsAt = null;

    // Nothing held: normal proximity rule applies.
    s._dragHeld = null;
    s._updateDevLabelVisibility();
    expect(farLabel.visible).toBe(false);
    expect(nearLabel.visible).toBe(true);

    // Now the far object is grabbed — its label must show despite the distance,
    // and the near one still follows the ordinary proximity rule.
    s._dragHeld = { obj: farObj };
    s._updateDevLabelVisibility();
    expect(farLabel.visible).toBe(true);
    expect(nearLabel.visible).toBe(true);
  });

  it('bypasses the movement throttle while something is held', () => {
    const s = new Scene();
    s.player = { sprite: { x: 0, y: 0 } };
    const heldObj = { x: 5000, y: 5000 };
    const label = fakeLabel({ x: 5000, y: 5000 }, heldObj);
    s._devObjLabels = [label];
    s._dragHeld = { obj: heldObj };

    // Simulate an already-up-to-date throttle bucket for this (stationary) player —
    // without the held-object bypass this would short-circuit and skip the pass.
    s._devLabelsAt = `${Math.round(0 / 8)},${Math.round(0 / 8)}`;
    s._updateDevLabelVisibility();
    expect(label.visible).toBe(true);
  });
});
