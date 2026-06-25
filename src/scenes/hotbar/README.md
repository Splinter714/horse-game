# HotbarScene concerns — where does X go?

`HotbarScene` is a **thin orchestrator** composed from concern mixins via the same
functional-mixin pattern as PaddockScene (`export const WithX = (Base) => class
extends Base { … }`). `this` is the scene; the split is purely for navigability and
to keep parallel worktrees from colliding (issue #167). It was the last big monolith
(~1,175 lines) before the split.

**Rule:** method names are unique across the whole chain — the `C1` guard in
[`../modularity.test.js`](../modularity.test.js) fails the build if two mixins define
the same name. To add behaviour, find the concern below; if it fits none, add a new
`WithX` file rather than growing the core.

## Concern → file

| Concern | File | Owns |
|---|---|---|
| Lifecycle | `HotbarScene.js` (core) | `constructor`/`create`: load state, wire keyboard/pointer/event listeners, shutdown cleanup |
| Shared tuning | `hotbar/constants.js` | slot/inventory/fly-out sizes, `PAUSABLE_SCENES` (not a mixin) |
| Hotbar strip | `hotbar/slots.js` (`WithHotbarSlots`) | `_buildHotbar`, active-slot highlight, money label, slot press/hold input (#75/#131/#132), `navSlot` |
| Carriers | `hotbar/carriers.js` (`WithCarriers`) | `_slotView`, fill/use, grouped members + fly-out picker, `getActiveItem` (public API) |
| Inventory | `hotbar/inventory.js` (`WithInventory`) | the full item grid + assign-to-slot |
| Action buttons | `hotbar/actionButtons.js` (`WithActionButtons`) | the touch Interact/Info/Use buttons |
| Pause menu | `hotbar/pauseMenu.js` (`WithPauseMenu`) | settings overlay, volume sliders, dev tools, gamepad focus nav, world freeze/resume |

The chain (innermost → outermost) is in `HotbarScene.js`:

```js
HotbarScene extends WithPauseMenu(WithInventory(WithActionButtons(
  WithCarriers(WithHotbarSlots(Phaser.Scene)))))
```

Gamepad input is polled in PaddockScene (`_pollRawPad`) and routed here via
`navSlot` / `_padCycleMember` / `_padTrigger*` — the pad isn't read in this scene
except by the pause-menu `update()` while the world is frozen.
