// Shop launch hook (#29) + shopkeeper NPC (#244) — the PaddockScene-side glue for the
// market stall. `openShop` launches the buy/sell overlay (ShopScene) when the player
// interacts with the stall (see interactables.js `shop`); the shop UI itself lives in
// ShopScene, so this only launches it (once), matching how _openInfoPanel launches the
// info panel. `buildShopkeeper` places the vendor NPC standing at the stall with a
// subtle idle bob + blink — no dialogue in v1; the keeper is just the friendly face of
// the same shop-open interaction. Extracted as its own concern per the mixin convention.

import Phaser from 'phaser';

export const WithShop = (Base) => class extends Base {
  openShop() {
    if (this.scene.isActive('ShopScene')) return; // already open
    this.scene.launch('ShopScene');
    this.scene.bringToTop('ShopScene');
  }

  // The shopkeeper NPC (#244). Called from the world build once the stall prop exists.
  // Stands just in front of the counter so their head/torso read above the goods; a
  // gentle idle bob (tween) + occasional blink (frame swap) give a bit of life without
  // any walking or dialogue. Purely cosmetic — the shop opens via the stall interactable.
  buildShopkeeper() {
    const shop = this.props && this.props.shop;
    if (!shop) return;
    const kx = shop.x;
    const ky = shop.y - 8; // feet just in front of the counter base
    const shadow = this.add.image(kx, ky, 'shadow')
      .setScale(1.4).setDepth(shop.y + 0.5).setOrigin(0.5, 0.5);
    const sprite = this.add.sprite(kx, ky, 'shopkeeper_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(shop.y + 1);
    this.shopkeeper = { sprite, shadow };

    // Idle bob — a slow up/down of a couple pixels so they don't read as frozen.
    this.tweens.add({
      targets: sprite, y: ky - 3,
      duration: 1600, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1,
    });

    // Occasional blink — swap to the closed-eye frame briefly, then back.
    const blink = () => {
      if (!sprite.active) return;
      sprite.setTexture('shopkeeper_1');
      this.time.delayedCall(140, () => { if (sprite.active) sprite.setTexture('shopkeeper_0'); });
      this.time.delayedCall(Phaser.Math.Between(2600, 5200), blink);
    };
    this.time.delayedCall(Phaser.Math.Between(2600, 5200), blink);
  }
};
