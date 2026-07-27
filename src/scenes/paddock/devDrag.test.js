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
