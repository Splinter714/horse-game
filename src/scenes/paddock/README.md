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
| Orchestration | `PaddockScene.js` (core) | `constructor`/`create`/`update`, `buildHorses`, `checkProximity`, `movePlayer`, sleep/wake |
| World build | `paddock/world.js` (`WithWorld`) | terrain/props, obstacles, collision helpers, stream + `streamPath` |
| Ambient wildlife | `paddock/wildlife.js` (`WithWildlife`) | scenery critters (stream fish, fly-by/peck birds, scampering raccoon) — spawn timers, tween movement, skittish flee. Not roster/care animals |
| Creatures | `paddock/creatures.js` (`WithCreatures`) | species-neutral spawn + shared wander/movement primitives, foals, horse spawn |
| Flock | `paddock/flock.js` (`WithFlock`) | chicken flock driver, follow/gather/peck, egg laying + collection |
| Herd | `paddock/herd.js` (`WithHerd`) | horse need-driven wander, herd separation/pairing, rolling, greeting |
| Charm | `paddock/charm.js` (`WithCharm`) | cross-animal charm "aww" moments (#187): dog↔sheep herding (`dogGoHerd`/`_sheepBunch`), chicken scatter (`chickenScatterFrom`), pig sunbathe nap (`_maybePigNap`/`_charmNap`), night settle-together (`_settleAnimalForNight`) + cat curl-up (`catCurlUp`). Cosmetic only |
| Farm stand | `paddock/farmStand.js` (`WithFarmStand`) | stand build + NPC customers |
| Day/night | `paddock/dayNight.js` (`WithDayNight`) | phase response, rest/wake, roosting, birds |
| Horse AI | `paddock/horseAI.js` (`WithHorseAI`) | horse eat/drink seeking + gate-aware pathing |
| Cat AI | `paddock/catAI.js` (`WithCatAI`) | cat fishing — `_catContext`, `_nearestStreamSpot`, `catGoFish` (hungry cat hunts fish at the stream, #163) |
| Behavior registry | `paddock/behaviors.js` (`WithBehaviors`) | data-driven AI dispatch (`runBehaviors`) |
| Riding | `paddock/riding.js` (`WithRiding`) | riding, saddle, leading |
| Player core | `paddock/player.js` (`WithPlayer`) | `buildPlayer` (sprite/camera/input bindings), `handleTap`, `_isDoubleTap` |
| Player movement | `paddock/playerMovement.js` (`WithPlayerMovement`) | `movePlayer`, hold-to-move, tap-to-move + A* (`_findPath`), `_stepNav` |
| Control prompts | `paddock/prompts.js` (`WithPrompts`) | hint panel, touch action-button labels, `checkToolProximity` |
| Interactables | `paddock/interactables.js` (`WithInteractables`) | gate/barn/trough/sources/nests/stand descriptors |
| Use dispatch | `paddock/useDispatch.js` (`WithUseDispatch`) | `useActiveTool`, cow-use resolution, `gatherFrom`, `getActiveItem` |
| Floating FX | `paddock/effects.js` (`WithEffects`) | `showHeart`, `showIcon`, `showDustPuff`, `hop` |
| Persistence/ticks | `paddock/persistence.js` (`WithPersistence`) | `_saveHorses`, `_saveAnimal`, `tickDecay`, `tickAutosave` |
| Rendering housekeeping | `paddock/rendering.js` (`WithRendering`) | `depthSort`, `updateSaddles`, `updateFoals`, `reskinHorse` |
| World objects | `paddock/worldObjects.js` (`WithWorldObjects`) | `placeFood`/`_freeFoodSpot`, trough (`fillTrough`/`_setTroughLevel`), `toggleGate` |
| Care actions | `paddock/careActions.js` (`WithCareActions`) | `useItemOnHorse`, cow `feedCow`/`waterCow`/`milkCow`, `doAction`, `SOUND_FNS` |
| Pet/info interaction | `paddock/interaction.js` (`WithInteraction`) | pet-preference cluster + info-panel openers (`openPortrait`…) |
| Input plumbing | `paddock/input.js` (`WithInput`) | `_pollRawPad`, `_togglePause`, `_syncInputMode`, `_onPromptsChanged` |
| Shared tuning | `paddock/constants.js` | layout/tuning constants (not a mixin) |

> Core dropped from ~1,236 → ~360 lines across issue #167 Phase A. Still in core
> by design: the orchestration (`create`/`update`), `checkProximity`, and
> `movePlayer` (movement is slated to move to the player mixin in Phase A2). Keep
> this table in sync as concerns move.

## Cross-cutting seams (don't hardcode a species in shared files)

Adding an animal should be **data**, not edits to shared orchestrators. The seams that
make that true are being made registry-driven (Phase B): roster persistence
(`data/save.js`), texture build (`BootScene.js`), and care dispatch (care actions).
When those land, the `C2` guards in `../modularity.test.js` enforce that the shared
files name no concrete species — if you find yourself writing `if (species === 'cow')`
or `feedCow()` in a shared file, it belongs in the species' `data/species/<name>/`
definition instead.
