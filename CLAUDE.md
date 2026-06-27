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
- `npm run sprites <key> [key…]` — **art preview**: renders a creature's runtime-generated
  sprite frames side-by-side to a PNG (`/tmp/sprite-preview.png`) so you can eyeball the
  art while iterating. Requires the dev server running. Works for any creature — reads the
  live textures and auto-detects frames/sizes. E.g. `npm run sprites cat horse chicken0 foal1`.
  Override with `SPRITE_SCALE` / `SPRITE_OUT`.

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
- `HotbarScene` — hotbar, carriers, pause menu (mute, control-prompt toggle, volume
  sliders), money label. Also a **thin orchestrator** composed from concern mixins
  under `src/scenes/hotbar/` (slots, carriers, inventory, action buttons, pause menu) —
  same functional-mixin pattern as PaddockScene. See `src/scenes/hotbar/README.md`.
- `InfoPanelScene` — the single data-driven info popup for **any** animal (horses,
  chickens, the cat). Renders stat bars from `species.needs` and identity/trait/portrait
  from the species' `panel` block. Purely informational — care is done in-world, so it
  has no action buttons. (This is the unified panel that replaced the old
  `PortraitScene` + `ChickenInfoScene`.)

Scenes share state via Phaser's **registry** and communicate via the **global event
emitter** (`this.game.events`).

### Registry keys
- `allHorses` — `{ [key]: Horse }` keyed by texture/registry key (`horse`, `horse2`…`horse7`).
- `allChickens` — `{ [key]: Chicken }` (`chicken0`…`chicken4`).
- `allCows` / `allPigs` / `allCats` — `{ [key]: Cow|Pig|Cat }` (one each: `cow` / `pig` / `cat`).
- `viewingAnimal` — `{ animal, portraitKey, key }` for whatever the info panel is showing
  (or null). Every in-world animal is a persisted roster now, so the info-panel
  customizer's per-part `look` survives reloads (the cat too).

### Events — use the constants in `src/data/events.js`, never bare strings
`ANIMAL_ACTION` (`{type, horseKey}`), `PHASE_CHANGE` (`{isNight, phase}`), `SLEEP`,
`SLEEP_DONE`, `STATS_CHANGED`, `MONEY_CHANGED`, `INVENTORY_CHANGED`, `BASKET_CHANGED`,
`PROMPTS_CHANGED` (control-prompt visibility toggled, payload = boolean).

### Animal interaction (in-world)
Care happens in the world, not via panel buttons. Interact (E / gamepad A / tap) always
**pets** the nearest animal; **info** is a separate input (C key / gamepad Y / double-tap).
Tools/carriers act on **Use** (F / gamepad X / on-screen Use button) — brush/saddle/lead on
the nearest horse, feed drops at your feet (or stocks the farm stand when you're at it),
carriers gather/fill/sell at the matching world spot. Contextual prompts for both interact
and Use are shown near the target (toggleable in the pause menu).

## The data-driven entity model (`src/data/`) — the key generalization

Animals are **one generic model driven by data**, so adding an animal type is mostly
a data entry (mirrors how coat tables and `items.js` are data-driven). **Everything
about one species is co-located** under `src/data/species/<name>/` (the one exception
is procedural art, which lives in `src/art/`).

- `Animal.js` — generic model: needs/decay, derived happiness, daily-care cycle,
  `applyAction(key)`, `mood()`, `toJSON()`. Knows nothing horse-specific.
- `species/index.js` — aggregator: imports each species def, exports the `SPECIES`
  registry, `getSpecies(id)`, the `BEHAVIORS` map, and the pure `chooseBehavior(id, ctx)`.
- `species/<name>/index.js` — the species definition. Declares `needs` (decay rates +
  defaults), optional `happiness`, care `actions` (stat/amount/care-flag/sound/icon),
  `dailyCare`, `mood` thresholds, `traits`, `optionalAttrs`, `capabilities`, and the
  ordered `behaviors` AI priority list.
- `species/<name>/model.js` — thin `class X extends Animal { super(SPECIES.x, data) }`.
  `Horse` keeps `feed/water/brush/pet` convenience wrappers around `applyAction`.
- `species/horse/coats.js` — horse coat color tables. `items.js` — carrier/content data.
- `species/<name>/behaviors.js` — the AI behavior modules `{ id, test(ctx), run(scene,
  agent) }`. `test` is pure (unit-tested in `behaviors.test.js`); `run` reuses the
  scene movement primitives. See "behavior registry" below.
- `save.js` — localStorage persistence (`loadAllHorses`/`saveAllHorses`,
  `loadAllChickens`/`saveAllChickens`, `loadGameState`/`saveGameState`). Applies
  forgiving offline decay on load.

### The behavior registry (data-driven AI)
Each species declares an ordered `behaviors` list; the generic dispatcher
(`scenes/paddock/behaviors.js`, `WithBehaviors`) walks it via `runBehaviors(agent)`
and the first behavior whose `test(ctx)` fires and whose `run` claims the agent wins
(wander is the implicit fallback). `horseTickForHorse` and `chickenTick` just delegate
to `runBehaviors`. The eat/drink/beg and chicken movement *primitives* still live in
the `horseAI`/`creatures` mixins — behaviors only wire condition → primitive.

### How to add things
- **A horse coat:** add an entry to `COATS` in `species/horse/coats.js`.
- **A care action (e.g. `treat`):** add it to a species' `actions` in its
  `species/<name>/index.js` (stat, amount, care flag, sound, icon). `doAction` and the
  model pick it up via data.
- **A new AI behavior:** add a module to the species' `behaviors.js` and its id to the
  `behaviors` list in `index.js`. Add a pure-decision case to `behaviors.test.js`.
- **A new animal species:** mostly **data** now (#167 Phase B/B4) — the cross-cutting
  seams are registry-driven, so you do **not** edit `save.js`, `BootScene.js`,
  `creatures.js`, or the care dispatch (the C2 seam guards in `src/seams.test.js`
  enforce this). To add one:
  - Create `src/data/species/<name>/`: an `index.js` def (needs/actions/capabilities/
    behaviors, plus a `spawn` block for placement+visuals and an optional `produces`
    block for milk-style harvest), a `model.js` class (or reuse `Animal`), a
    `behaviors.js`.
  - Register it in `species/index.js`; add a persistence entry to `data/rosters.js`;
    add its texture builder to `art/index.js` (+ an art file under `src/art/`).
  - **Dissect tags**: sprinkle `g.layer('name')` calls before each logical part in
    the draw function (legs, tail, body, neck, head, ears, eye, snout/muzzle, etc.).
    These are no-ops in production — only the dev dissect tool consumes them — but
    without them the dissect overlay shows everything in one unlabelled bucket. Every
    existing animal art file has them; new ones must too.
  - Direct care is data: declare `actions` (feed/water/pet) and optional `produces`.
    Spawn behaviour is capability-driven: `grazes` wires the food/water goal tick,
    `pecks`/`roosts` the flock hooks. The generic dispatch picks it all up — no
    bespoke `feedX`/`spawnX` methods. (Spawn placement: `spawn.placements`, one per
    roster individual.)
  This is what lets two new animals be added in **parallel git worktrees** without
  colliding: each lives in its own `species/<name>/` folder + one-line registry
  entries, not shared orchestrator files.

## PaddockScene structure — functional mixins (`src/scenes/paddock/`)

PaddockScene was a ~3,100-line monolith; it's split into concern files composed via
the **functional mixin pattern**:

```js
class PaddockScene extends WithWorld(WithCreatures(WithFarmStand(WithDayNight(
  WithHorseAI(WithBehaviors(WithRiding(WithPlayer(WithEffects(WithPersistence(
  WithRendering(WithWorldObjects(WithCareActions(WithInteraction(WithInput(
  WithPlayerMovement(WithPrompts(WithInteractables(WithUseDispatch(
  Phaser.Scene))))))))))))))))))) { … }
```

Each mixin is `export const WithX = (Base) => class extends Base { …methods… }`, so
`this` is the scene and behavior is identical to the old class — it's purely a file
split for navigability. Method names are unique across all files (no overrides).

**`src/scenes/paddock/README.md` is the authoritative concern→file map** (where does
X go?). After issue #167 the core dropped ~1,236 → ~270 lines and `player.js` ~1,030 →
~235; the concerns now live in `effects/persistence/rendering/worldObjects/careActions/
interaction/input` plus the player split (`playerMovement/prompts/interactables/
useDispatch`), alongside the original `world/creatures/farmStand/dayNight/horseAI/
behaviors/riding/player`. `constants.js` holds shared tuning. `PaddockScene.js` (core)
keeps only `constructor`/`create`/`update`, `buildHorses`, `checkProximity`, sleep/wake.

To extract another concern, follow the same pattern: move whole methods into a
`WithX` mixin, import any constants/audio it uses, add it to the class chain, update
the README, and confirm `npm run build` + `npm test` + `npm run smoke` stay green.
**Don't hardcode a species** in a shared file (save/boot/care) — that belongs in the
species' `data/species/<name>/` def; the seam guards in `modularity.test.js` enforce it.

## Verification

Two layers, both must pass:
1. **`npm test`** (Vitest, `node` env) — pure logic in `src/data`: decay, save/migration/
   offline-decay, items, chicken persistence. localStorage is stubbed in-test. Also the
   **modularity guards** (`src/scenes/modularity.test.js`, issue #167): no two mixins in a
   composition group define the same method name, and no scene file exceeds the line budget.
   These are static source checks (Phaser doesn't load in `node`).
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

## Working an issue across parallel worktrees

The owner runs multiple git worktrees with agents in parallel. To avoid two
worktrees grabbing the same GitHub issue, **claim it when work actually starts**
(first commit on an issue branch — *not* when it's merely queued):

1. Add the **`in-progress`** label to the issue.
2. Comment the branch/worktree name + a timestamp (so a stale claim is visible).
3. The label is redundant once a PR exists (`Closes #N`) — drop it on merge/close.

Claims are reconciled against git: an `in-progress` issue with no matching branch
or open PR is an abandoned claim and gets swept clear during triage. Claiming at
*real start* (not at queue time) is what keeps unlaunched issues from getting stuck.

## Roadmap (planned, not yet done)

- **Unify info panels — DONE.** `PortraitScene` + `ChickenInfoScene` are now the single
  data-driven `InfoPanelScene` (stat bars from `species.needs`, identity/portrait from the
  species `panel` block). It's purely informational (no action buttons).
- Future features tracked in GitHub issues: breeding/genetics (#15), herd personalities
  (#31), animal personality & preferences (#88), other animal types (#4),
  crops/cooking (#27/#40/#41), economy/shop (#29), world expansion (#35/#36/#56).
