// Shop launch hook (#29) — the PaddockScene-side glue for the market stall (tool
// upgrades only, post-#312). `openShop` launches the buy/sell overlay (ShopScene)
// when the player interacts with the stall (see interactables.js `shop`); the shop
// UI itself lives in ShopScene, so this only launches it (once), matching how
// _openInfoPanel launches the info panel. Extracted as its own concern per the
// mixin convention.
//
// (The shopkeeper NPC that used to live here — #244, relocated to the unified
// store by #312 — was removed per #388: no vendor stands at the general store now,
// the store's own interactable still opens the shop UI directly.)

export const WithShop = (Base) => class extends Base {
  openShop() {
    if (this.scene.isActive('ShopScene')) return; // already open
    this.scene.launch('ShopScene');
    this.scene.bringToTop('ShopScene');
  }
};
