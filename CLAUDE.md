# CLAUDE.md — Horse Game

Orientation for working in this repo. The owner is non-technical and won't read
the code, so changes must be verified, not just plausible.

## What it is

A cozy pixel-art horse-care / farming sim. **Phaser 3** game, **Vite** bundler,
plain JS (ESM, no TypeScript). All sprites and audio are **procedurally generated
at runtime** (no asset files). State persists to **localStorage**. Deploys to
GitHub Pages under base `/horse-game/`.

## Commands

- `npm run dev` — dev server at http://localhost:5173/horse-game/
- `npm test` — Vitest unit tests for the pure logic (`src/data/*.test.js`)
- `npm run smoke` — **headless-browser smoke test** (boots the real game, asserts
  runtime state). Requires the dev server running. See "Verification" below.
- `npm run build` — production build (also the fastest check that all modules resolve)

**Always run `npm test` and `npm run smoke` after changes** — they're the safety
net that lets us ship without the owner manually playing.

## Architecture

### Scenes (Phaser multi-scene; registered in `src/main.js`)
- `BootScene` — loads herd + flock from save, builds all procedural textures, then
  starts the others.
- `PaddockScene` — the gameplay world. **Thin orchestrator** composed from concern
  mixins (see below). Owns `create()`/`update()`, world state, and the care-action
  dispatch (`doAction`).
- `DayNightScene` — day/night cycle, lighting tint, sleep. (Dev-only: tap the time
  label to skip a phase — gated behind `import.meta.env.DEV`.)
- `HotbarScene` — hotbar, carriers, pause menu, money label.
- `PortraitScene` / `ChickenInfoScene` — slide-in info panels. (Unifying these into
  one data-driven panel is a planned next step — see Roadmap.)

Scenes share state via Phaser's **registry** and communicate via the **global event
emitter** (`this.game.events`).

### Registry keys
- `allHorses` — `{ [key]: Horse }` keyed by texture/registry key (`horse`, `horse2`…`horse7`).
- `allChickens` — `{ [key]: Chicken }` (`chicken0`…`chicken4`).
- `viewingHorse` / `viewingChicken` — what the info panel is showing (or null).

### Events — use the constants in `src/data/events.js`, never bare strings
`ANIMAL_ACTION` (`{type, horseKey}`), `PHASE_CHANGE` (`{isNight, phase}`), `SLEEP`,
`SLEEP_DONE`, `STATS_CHANGED`, `MONEY_CHANGED`, `INVENTORY_CHANGED`, `BASKET_CHANGED`.

## The data-driven entity model (`src/data/`) — the key generalization

Animals are **one generic model driven by data**, so adding an animal type is mostly
a data entry (mirrors how `coats.js` and `items.js` are data-driven).

- `Animal.js` — generic model: needs/decay, derived happiness, daily-care cycle,
  `applyAction(key)`, `mood()`, `toJSON()`. Knows nothing horse-specific.
- `species/index.js` — the `SPECIES` registry. Each entry declares `needs` (decay
  rates + defaults), optional `happiness`, care `actions` (stat/amount/care-flag/
  sound/icon), `dailyCare`, `mood` thresholds, `traits`, `optionalAttrs`, `capabilities`.
- `horse.js` / `chicken.js` — thin `class X extends Animal { super(SPECIES.x, data) }`.
  `Horse` keeps `feed/water/brush/pet` convenience wrappers around `applyAction`.
- `coats.js` — horse coat color tables. `items.js` — carrier/content inventory data.
- `save.js` — localStorage persistence (`loadAllHorses`/`saveAllHorses`,
  `loadAllChickens`/`saveAllChickens`, `loadGameState`/`saveGameState`). Applies
  forgiving offline decay on load.

### How to add things
- **A horse coat:** add an entry to `COATS` in `data/coats.js`.
- **A care action (e.g. `treat`):** add it to a species' `actions` in `species/index.js`
  (stat, amount, care flag, sound, icon). `doAction` and the model pick it up via data.
- **A new animal species:** add a `SPECIES` entry (needs/actions/capabilities), a
  thin model class (or reuse `Animal`), an art builder in `src/art/`, build its
  textures in `BootScene`, give it a roster + persistence in `save.js`, and a
  behavior set (today: hand-written in the `creatures`/`horseAI` mixins; see Roadmap).

## PaddockScene structure — functional mixins (`src/scenes/paddock/`)

PaddockScene was a ~3,100-line monolith; it's split into concern files composed via
the **functional mixin pattern**:

```js
class PaddockScene extends WithWorld(WithCreatures(WithFarmStand(
  WithDayNight(WithHorseAI(WithRiding(WithPlayer(Phaser.Scene))))))) { … }
```

Each mixin is `export const WithX = (Base) => class extends Base { …methods… }`, so
`this` is the scene and behavior is identical to the old class — it's purely a file
split for navigability. Method names are unique across all files (no overrides).

- `constants.js` — shared tuning/layout constants (world size, bounds, gate, scale,
  cleanliness thresholds, farm-stand product defs). Both the scene and mixins import these.
- `world.js` — world building + obstacle/collision helpers.
- `creatures.js` — generic animal + chicken behavior, foals, horse spawning + wander/
  need-driven movement/rolling.
- `farmStand.js` — farm stand + NPC customers.
- `dayNight.js` — phase response, dawn roll-over, rest/wake, roosting, birds.
- `horseAI.js` — horse eat/drink seeking + gate-aware pathing.
- `riding.js` — riding, saddle, leading.
- `player.js` — player build, input, pathfinding/navigation, world interactables.
- `PaddockScene.js` (core) — constructor/create/update, `buildHorses`, food/item
  placement, info-panel openers, `doAction`, depth-sort, decay/autosave ticks.

To extract another concern, follow the same pattern: move whole methods into a
`WithX` mixin, import any constants/audio it uses, add it to the class chain, and
confirm `npm run build` + `npm run smoke` stay green and no method name is duplicated.

## Verification

Two layers, both must pass:
1. **`npm test`** (Vitest, `node` env) — pure logic in `src/data`: decay, save/migration/
   offline-decay, items, chicken persistence. localStorage is stubbed in-test.
2. **`npm run smoke`** (`scripts/smoke.mjs`, Playwright headless Chromium) — boots the
   real game, asserts: no JS/console errors, scenes active, 7 horses + 5 chickens
   loaded, all PaddockScene mixin methods resolve on the prototype, and a single feed
   applies exactly +35 (guards the care-action double-apply regression). Saves a
   screenshot to `/tmp/horsegame-smoke.png`.

Headless Chromium lacks WebGL framebuffers, so the smoke test loads `?canvas` (a
dev-only `Phaser.CANVAS` override in `main.js`). The game logic verified there is
renderer-agnostic.

## Gotchas

- **OneDrive sync:** the repo lives in a OneDrive folder; sync can touch files mid-edit.
  Prefer the editor tools over long shell `sed` ranges on source files. `vite.config.js`
  already ignores OneDrive temp/lock files.
- Use `EVENTS.*` constants, not bare event strings.
- The owner can't verify code — lean on `npm test` + `npm run smoke` (extend them when
  you add behavior).

## Roadmap (planned, not yet done)

- **Behavior registry:** replace the hand-written AI tick functions in `creatures.js`/
  `horseAI.js` with data-driven, per-species behavior modules `(ctx, agent) => handled`,
  so a new animal picks a behavior list instead of needing new tick code. (Now isolated
  to those two mixins, so it's a contained change.)
- **Unify info panels:** merge `PortraitScene` + `ChickenInfoScene` into one panel that
  renders stat bars from `species.needs` and buttons from `species.actions`.
- Future features tracked in GitHub issues: breeding/genetics (#15), herd personalities
  (#31), other animal types (#4), crops/cooking (#27/#40/#41), economy/shop (#29), world
  expansion (#35/#36/#56).
