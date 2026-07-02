// Shop launch hook (#29) — the tiny PaddockScene-side glue that opens the buy panel
// when the player interacts with the market stall (see interactables.js `shop`). The
// buy UI itself lives in its own overlay scene (ShopScene); all this does is launch
// it (once), matching how _openInfoPanel launches the info panel. Extracted as its
// own concern file per the functional-mixin convention.

export const WithShop = (Base) => class extends Base {
  openShop() {
    if (this.scene.isActive('ShopScene')) return; // already open
    this.scene.launch('ShopScene');
    this.scene.bringToTop('ShopScene');
  }
};
