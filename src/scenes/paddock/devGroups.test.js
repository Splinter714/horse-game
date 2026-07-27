import { describe, it, expect } from 'vitest';
import { WithDevDrag } from './devDrag.js';
import { WithDevGroups, groupOf, withGroup, withoutGroups, normalizeGroups, nextGroupName } from './devGroups.js';

// Multi-select / drag-together / grouping for the drag tool (#337).
//
// Two layers are worth testing without Phaser: the pure group list maths, and the
// scene-level decisions it drives — "what does a drag on THIS object move?" and
// "does a group move as a rigid unit?" (the fence-run case that started the issue).

const Scene = WithDevDrag(WithDevGroups(class {}));

// A drag-tool entry, as `_mountDevDrag` builds them.
const entry = (name, x, y) => ({ name, obj: { x, y }, also: [], ox: x, oy: y });

// Six fence posts 96px apart, exactly like world.js builds props.houseFence.
function fenceScene() {
  const s = new Scene();
  s._dragEntries = Array.from({ length: 6 }, (_, i) => entry(`Fence Post ${i + 1}`, 300 + i * 96, 320));
  s._dragEntries.push(entry('beehive', 1450, 300));
  s._dragSel    = new Set();
  s._dragGroups = [];
  return s;
}

describe('group list maths (#337)', () => {
  it('finds the group an object belongs to', () => {
    const groups = [{ name: 'Group 1', members: ['a', 'b'] }];
    expect(groupOf(groups, 'b').name).toBe('Group 1');
    expect(groupOf(groups, 'c')).toBe(null);
    expect(groupOf(undefined, 'a')).toBe(null);
  });

  it('keeps groups disjoint — regrouping pulls members out of their old group', () => {
    const g1 = withGroup([], ['a', 'b', 'c'], 'Fence');
    const g2 = withGroup(g1, ['c', 'd'], 'Gate');
    expect(groupOf(g2, 'c').name).toBe('Gate');
    expect(groupOf(g2, 'a').members).toEqual(['a', 'b']);
  });

  it('drops a group left with fewer than 2 members, and refuses to make one', () => {
    const g1 = withGroup([], ['a', 'b'], 'Pair');
    expect(withGroup(g1, ['b', 'z'], 'New')).toHaveLength(1); // 'Pair' would be just 'a'
    expect(withGroup([], ['solo'], 'Nope')).toEqual([]);
  });

  it('dissolves every group touched by the given names', () => {
    const groups = [{ name: 'A', members: ['a', 'b'] }, { name: 'B', members: ['c', 'd'] }];
    expect(withoutGroups(groups, ['c'])).toEqual([{ name: 'A', members: ['a', 'b'] }]);
  });

  it('auto-names without colliding with an existing name', () => {
    expect(nextGroupName([])).toBe('Group 1');
    expect(nextGroupName([{ name: 'Group 2', members: ['a', 'b'] }])).toBe('Group 3');
  });

  it('normalizes junk out of persisted groups', () => {
    expect(normalizeGroups(null)).toEqual([]);
    expect(normalizeGroups([{ name: 'ok', members: ['a', 'b', 7] }, { members: ['x'] }, 'nope']))
      .toEqual([{ name: 'ok', members: ['a', 'b'] }]);
  });
});

describe('selection (#337)', () => {
  it('toggles one ungrouped object in and out', () => {
    const s = fenceScene();
    const bee = s._dragEntries.at(-1);
    s._devSelToggle(bee);
    expect(s._devSelEntries()).toEqual([bee]);
    s._devSelToggle(bee);
    expect(s._devSelEntries()).toEqual([]);
  });

  it('toggling any member of a group selects the whole group', () => {
    const s = fenceScene();
    s._dragGroups = [{ name: 'House Fence', members: s._dragEntries.slice(0, 6).map(e => e.name) }];
    s._devSelToggle(s._dragEntries[3]);
    expect(s._dragSel.size).toBe(6);
    s._devSelToggle(s._dragEntries[0]);
    expect(s._dragSel.size).toBe(0);
  });

  it('recognises a selection that is exactly one group (the Ungroup case)', () => {
    const s = fenceScene();
    s._dragGroups = [{ name: 'House Fence', members: s._dragEntries.slice(0, 6).map(e => e.name) }];
    s._devSelToggle(s._dragEntries[0]);
    expect(s._devSelGroup().name).toBe('House Fence');
    // Adding an outsider means the selection is no longer that group.
    s._devSelToggle(s._dragEntries.at(-1));
    expect(s._devSelGroup()).toBe(null);
  });
});

describe('what a drag moves (#337)', () => {
  it('moves just the object when it is neither selected nor grouped', () => {
    const s = fenceScene();
    expect(s._devDragSet(s._dragEntries[2])).toEqual([s._dragEntries[2]]);
  });

  it('moves the whole selection when the grabbed object is part of it', () => {
    const s = fenceScene();
    s._devSelToggle(s._dragEntries[0]);
    s._devSelToggle(s._dragEntries[1]);
    expect(s._devDragSet(s._dragEntries[1])).toHaveLength(2);
    // An object outside the selection still drags alone.
    expect(s._devDragSet(s._dragEntries[4])).toEqual([s._dragEntries[4]]);
  });

  it('moves the whole group when the grabbed object is grouped, selected or not', () => {
    const s = fenceScene();
    s._dragGroups = [{ name: 'House Fence', members: s._dragEntries.slice(0, 6).map(e => e.name) }];
    expect(s._devDragSet(s._dragEntries[5])).toHaveLength(6);
  });

  it('falls back to the object alone when a saved group names nothing in this world', () => {
    const s = fenceScene();
    s._dragGroups = [{ name: 'Stale', members: ['Gone A', 'Gone B'] }];
    expect(s._devDragSet(s._dragEntries[0])).toEqual([s._dragEntries[0]]);
  });
});

describe('drag-together preserves relative positions (the fence-run case)', () => {
  it('shifts every member of the group by the same delta', () => {
    const s = fenceScene();
    const posts = s._dragEntries.slice(0, 6);
    s._dragGroups = [{ name: 'House Fence', members: posts.map(e => e.name) }];

    // What _devDragMove does once the press passes TAP_SLOP: one delta, whole set.
    const set = s._devDragSet(posts[2]);
    for (const m of set) s._devDragShiftEntry(m, 40, -25);

    expect(posts.map(p => [p.obj.x, p.obj.y]))
      .toEqual([[340, 295], [436, 295], [532, 295], [628, 295], [724, 295], [820, 295]]);
    // The ungrouped beehive stayed put.
    expect(s._dragEntries.at(-1).obj).toEqual({ x: 1450, y: 300 });
  });

  it('exports every moved member individually, so the source edit is unambiguous', () => {
    const s = fenceScene();
    const posts = s._dragEntries.slice(0, 6);
    s._dragGroups = [{ name: 'House Fence', members: posts.map(e => e.name) }];
    for (const m of s._devDragSet(posts[0])) s._devDragShiftEntry(m, 0, 60);

    const moved = s._devMovedPositions();
    expect(Object.keys(moved)).toHaveLength(6);
    expect(moved['Fence Post 1']).toEqual({ x: 300, y: 380, from: { x: 300, y: 320 } });
    expect(moved['Fence Post 6']).toEqual({ x: 780, y: 380, from: { x: 780, y: 320 } });
  });
});
