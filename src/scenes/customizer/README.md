# `src/scenes/customizer/` — the general animal customizer

The data-driven appearance editor (#165), split into functional mixins (same pattern as
`paddock/` and `hotbar/`). It replaced the old monolithic `scenes/customizer.js` (#169).
Composed into two host scenes:

- **`InfoPanelScene`** — in-world horse editing (the "✎ Edit appearance" button). Persists
  the herd after each edit.
- **`CustomizerScene`** — a standalone host launched on top of the dev **Art Preview**
  gallery (#166): tap any creature to recolour it live. No persistence (live-recolor only).

## Files (concern → file)

| File | `WithX` | What it owns |
|------|---------|--------------|
| `shell.js` | `WithCustomizerShell` | Lifecycle (`custEnterFor`/`custExit`), split layout (panel RIGHT / preview LEFT), live preview sprite, pinned header, content dispatch, swatch/option/toggle section primitives, and the simple data-driven **parts** path (`_buildPartSections`/`_pickPartSwatch`). |
| `nav.js` | `WithCustomizerNav` | Scroll (wheel/drag) + controller/keyboard focus navigation + scrollbar. Split from `shell.js` purely to stay under the 500-line budget. |
| `horse.js` | `WithHorseSections` | The horse's rich, bespoke sections (coat/mane/patterns/face/legs/dark-markings/feather/breeds) + edit handlers + rename + a paddock-independent live re-skin. The shell delegates to `_buildHorseSections()` when `CUSTOMIZE.horse.sections === 'horse'`. |

A host composes all three: `WithCustomizerShell(WithCustomizerNav(WithHorseSections(Phaser.Scene)))`.
Method names are unique across the three (guarded by `modularity.test.js` groups
`infopanel` / `customizer`).

## The data (`src/data/customize.js`)

`CUSTOMIZE[speciesId]` declares either:
- `parts: [{ id, label, palette }]` — simple per-part recolour (sheep/cow/pig/dog/cat).
  Each palette swatch is `{ key, label, ramp }`; the chosen ramps form a `look` threaded
  into the species' art builder via `reskinAnimal()` (`art/index.js`), which redraws the
  `${key}_*` textures **in place** (so the on-screen sprite updates with no rebuild).
- `sections: 'horse'` — the horse's bespoke editor instead of a flat part list.

Adding a customizable part to an animal is just data + threading the colour into its
`src/art/<name>Art.js` draw fn (which must default to its original colours so an arg-less
build stays pixel-identical).
