# PaddockScene concerns — where does X go?

`PaddockScene` is a **thin orchestrator** composed from concern mixins via the
functional-mixin pattern (`export const WithX = (Base) => class extends Base { … }`).
`this` is always the scene; the split is purely for navigability and to keep parallel
worktrees from colliding in one mega-file (issue #167).

**Rule:** method names are unique across the whole chain (no overrides) — the
`C1` guard in [`../modularity.test.js`](../modularity.test.js) fails the build if two
mixins define the same name. To add behaviour, find the concern below and put it there;
if it fits none, that's a sign it's a new concern (add a `WithX` file) — don't grow the
core orchestrator.

## Concern → file

| Concern | File | Owns |
|---|---|---|
| Orchestration | `PaddockScene.js` (core) | `constructor`/`create`/`update`, `buildHorses`, `checkProximity`, sleep/wake |
| World build | `paddock/world.js` (`WithWorld`) | terrain/props, obstacles, collision helpers |
| Creatures | `paddock/creatures.js` (`WithCreatures`) | spawning, generic animal + chicken movement, foals, rolling |
| Farm stand | `paddock/farmStand.js` (`WithFarmStand`) | stand build + NPC customers |
| Day/night | `paddock/dayNight.js` (`WithDayNight`) | phase response, rest/wake, roosting, birds |
| Horse AI | `paddock/horseAI.js` (`WithHorseAI`) | horse eat/drink seeking + gate-aware pathing |
| Behavior registry | `paddock/behaviors.js` (`WithBehaviors`) | data-driven AI dispatch (`runBehaviors`) |
| Riding | `paddock/riding.js` (`WithRiding`) | riding, saddle, leading |
| Player | `paddock/player.js` (`WithPlayer`) | player build, input, pathfinding, interactables |
| Floating FX | `paddock/effects.js` (`WithEffects`) | `showHeart`, `showIcon`, `showDustPuff`, `hop` |
| Persistence/ticks | `paddock/persistence.js` (`WithPersistence`) | `_saveHorses`, `_saveAnimal`, `tickDecay`, `tickAutosave` |
| Rendering housekeeping | `paddock/rendering.js` (`WithRendering`) | `depthSort`, `updateSaddles`, `updateFoals`, `reskinHorse` |
| Shared tuning | `paddock/constants.js` | layout/tuning constants (not a mixin) |

> This table grows as the remaining concerns are extracted (care actions, pet/info
> interaction, world objects, input — issue #167 Phase A). Keep it in sync.

## Cross-cutting seams (don't hardcode a species in shared files)

Adding an animal should be **data**, not edits to shared orchestrators. The seams that
make that true are being made registry-driven (Phase B): roster persistence
(`data/save.js`), texture build (`BootScene.js`), and care dispatch (care actions).
When those land, the `C2` guards in `../modularity.test.js` enforce that the shared
files name no concrete species — if you find yourself writing `if (species === 'cow')`
or `feedCow()` in a shared file, it belongs in the species' `data/species/<name>/`
definition instead.
