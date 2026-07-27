// Dev tool: multi-select + persistent grouping for the #330 object-drag mode (#337).
//
// The drag tool (devDrag.js) moves ONE object at a time. That's fine for a beehive
// and miserable for a fence run — six posts that only ever want to move together.
// This file is the "which objects are we talking about" half of the tool:
//
//   • SELECTION — a session-only set of entries. Tapping an object (a press that
//     doesn't turn into a drag) toggles it in or out. Dragging any member moves
//     the whole set by the same delta, so relative positions are preserved.
//   • GROUPS — a named, PERSISTED set of object names. Once objects are grouped,
//     touching any member implies the whole group, so "the house fence run" is one
//     handle forever rather than a multi-select you have to rebuild every session.
//
// Why groups persist when the drags themselves deliberately don't (devDrag.js
// constraint 1): a group is TOOL CONFIG, the same kind of thing as the on/off
// toggle — it says how the editor should behave, not where anything in the world
// belongs. Positions still live only in the source; a reload still puts every
// object back. Groups are stored by NAME (the `_devLabelTargets()` name, e.g.
// `Fence Post 3`), so they re-resolve against a freshly built world and a group
// naming an object that no longer exists simply contributes nothing.
//
// The pure list maths lives in the exported helpers below rather than in methods,
// so it can be unit-tested without Phaser (devGroups.test.js).

import { loadDevSettings, saveDevSettings } from '../../data/save.js';

// ─── Pure helpers (no scene, no Phaser) ──────────────────────────────────────

// The group containing `name`, or null. Groups never overlap (see `withGroup`).
export const groupOf = (groups, name) =>
  (groups ?? []).find(g => g.members.includes(name)) ?? null;

export const nextGroupName = (groups) => {
  let n = (groups ?? []).length + 1;
  const taken = new Set((groups ?? []).map(g => g.name));
  while (taken.has(`Group ${n}`)) n++;
  return `Group ${n}`;
};

// Add a group of `members`, first pulling those names out of any group they were
// already in — groups stay disjoint, so "which group is this object in" always has
// exactly one answer. A group stripped down to fewer than 2 members is dropped
// (a one-object group is just an object).
export function withGroup(groups, members, name) {
  const set  = new Set(members);
  const kept = (groups ?? [])
    .map(g => ({ ...g, members: g.members.filter(m => !set.has(m)) }))
    .filter(g => g.members.length >= 2);
  if (set.size < 2) return kept;
  return [...kept, { name: name ?? nextGroupName(kept), members: [...set] }];
}

// Dissolve every group that contains any of `names`.
export function withoutGroups(groups, names) {
  const set = new Set(names);
  return (groups ?? []).filter(g => !g.members.some(m => set.has(m)));
}

// Sanitising loader shape — tolerates anything at all in localStorage.
export function normalizeGroups(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue;
    const members = Array.isArray(g.members) ? g.members.filter(m => typeof m === 'string') : [];
    if (members.length < 2) continue;
    out.push({ name: typeof g.name === 'string' ? g.name : nextGroupName(out), members });
  }
  return out;
}

// ─── The mixin ───────────────────────────────────────────────────────────────

export const WithDevGroups = (Base) => class extends Base {
  // Called from _mountDevDrag once `this._dragEntries` exists.
  initDevSelection() {
    this._dragSel    = new Set();                                   // selected entries (session-only)
    this._dragGroups = normalizeGroups(loadDevSettings().dragGroups); // [{ name, members: [name] }]
  }

  // Every entry whose name is in `names` (a group can legitimately resolve to
  // several entries, or to none if the world changed since it was saved).
  _devEntriesNamed(names) {
    const set = new Set(names);
    return (this._dragEntries ?? []).filter(e => set.has(e.name));
  }

  // What "acting on this entry" actually means: its whole group when it's in one,
  // otherwise just itself.
  _devSelExpand(entry) {
    const g = groupOf(this._dragGroups, entry.name);
    const members = g ? this._devEntriesNamed(g.members) : [];
    return members.length ? members : [entry];
  }

  // The set that a drag on `entry` should move: its group, else the current
  // selection when the entry is part of it, else just the entry. (So an unselected
  // object can still be nudged on its own without wrecking a selection in progress.)
  _devDragSet(entry) {
    const members = this._devSelExpand(entry);
    if (members.length > 1) return members;
    if (this._dragSel?.has(entry)) return [...this._dragSel];
    return [entry];
  }

  // Tap toggle. Toggling any member of a group toggles the whole group, which is
  // what makes a group feel like one object.
  _devSelToggle(entry) {
    const set = this._dragSel;
    if (!set) return;
    const members = this._devSelExpand(entry);
    const on = !set.has(entry);
    for (const m of members) { if (on) set.add(m); else set.delete(m); }
  }

  _devSelClear() { this._dragSel?.clear(); }

  _devSelEntries() { return [...(this._dragSel ?? [])]; }

  // The group the current selection exactly is, if any — that's what turns the
  // group button into an "Ungroup" button.
  _devSelGroup() {
    const sel = this._devSelEntries();
    if (!sel.length) return null;
    const g = groupOf(this._dragGroups, sel[0].name);
    if (!g) return null;
    const names = new Set(sel.map(e => e.name));
    return names.size === g.members.length && g.members.every(m => names.has(m)) ? g : null;
  }

  // Save the current selection as a new named group (session choice → persisted
  // tool config). Returns the group, or null when there's nothing to group.
  _devGroupSelection() {
    const names = [...new Set(this._devSelEntries().map(e => e.name))];
    if (names.length < 2) return null;
    this._dragGroups = withGroup(this._dragGroups, names);
    this._devSaveGroups();
    return this._dragGroups[this._dragGroups.length - 1];
  }

  // Dissolve whatever group(s) the current selection touches.
  _devUngroupSelection() {
    const names = this._devSelEntries().map(e => e.name);
    const before = this._dragGroups?.length ?? 0;
    this._dragGroups = withoutGroups(this._dragGroups, names);
    if ((this._dragGroups?.length ?? 0) !== before) this._devSaveGroups();
    return before - (this._dragGroups?.length ?? 0);
  }

  _devSaveGroups() {
    saveDevSettings({ dragGroups: this._dragGroups ?? [] });
  }

  // One-line readout of what's selected, for the HUD.
  _devSelSummary() {
    const n = this._dragSel?.size ?? 0;
    if (!n) return '';
    const g = this._devSelGroup();
    return g ? `  [${g.name}: ${n} selected]` : `  [${n} selected]`;
  }
};
