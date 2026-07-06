// Neighbor NPC (#294) — periodic visits, trading & a gift-based relationship score.
// Split from the #34 NPC umbrella. Arrival MIRRORS the farm-stand customer
// (farmStand.js _scheduleNextCustomer/_spawnCustomer): walks in from the right edge
// of the world on its own timer, using the same `npc_walk` animation — but a
// DIFFERENT purpose. Where a customer buys stock and leaves, the neighbor:
//   - walks to a small visiting spot near the farm stand and offers a TRADE (give
//     the player a crop/item for gold — see data/neighbor.js NEIGHBOR_TRADE_TIERS);
//   - can be GIFTED an item while they're visiting (Use, with a carrier held, like
//     any other toolWorld interactable — see interactables.js) — this increments a
//     persisted relationship score (data/neighbor.js giftNeighbor), mirroring the
//     bird-befriending shape (birdFriendship.js/paddock/birdFriendship.js) but with
//     a single flat running counter (v1-simple; not per-type — there's one neighbor).
// Reuses `this.npcs` (rendering.js depth-sorts it, dayNight.js clears it at night via
// the shared `_npcLeave`) so the neighbor gets that plumbing for free — it's pushed
// into the SAME array as farm-stand customers, just tagged `kind: 'neighbor'` so the
// generic per-npc code (which doesn't care about kind) still works unchanged.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { CONTENT_DEFS } from '../../data/items.js';
import { WORLD_W, PLAYER_SPEED, PLAYER_BOUNDS, S } from './constants.js';
import { giftNeighbor, neighborTradeOffer } from '../../data/neighbor.js';
import { loadNeighborFriendship, saveNeighborFriendship } from '../../data/save.js';

export const WithNeighbor = (Base) => class extends Base {
  // Called from create(): restore the persisted relationship score and schedule the
  // first visit. No new textures/anims needed — reuses the customer's npc_walk art.
  buildNeighbor() {
    this._neighborScore = loadNeighborFriendship().score;
    this._neighbor = null; // the currently-visiting neighbor npc record, or null
    this._scheduleNextNeighbor();
  }

  _saveNeighborFriendship() {
    saveNeighborFriendship({ score: this._neighborScore });
  }

  _scheduleNextNeighbor() {
    const delay = Phaser.Math.Between(60_000, 110_000); // a bit rarer than the customer
    this.time.delayedCall(delay, () => {
      if (!this.isNight) this._spawnNeighbor();
      this._scheduleNextNeighbor();
    });
  }

  _spawnNeighbor() {
    // Only one neighbor visiting at a time.
    if (!this.farmStand || this._neighbor) return;

    const spawnX = WORLD_W - 20;
    const spawnY = Phaser.Math.Clamp(
      this.farmStand.y + Phaser.Math.Between(-140, -90), // a distinct spot from the customer
      PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY
    );

    if (!this.anims.exists('npc_walk')) {
      this.anims.create({
        key: 'npc_walk',
        frames: [{ key: 'npc_walk_0' }, { key: 'npc_walk_1' }],
        frameRate: 7, repeat: -1,
      });
    }

    const shadow = this.add.image(spawnX, spawnY, 'shadow').setScale(S * 0.9).setDepth(spawnY - 1);
    const sprite = this.add.sprite(spawnX, spawnY, 'npc_walk_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(spawnY)
      .setTint(0xffe0b0); // a warm tint distinguishes the neighbor from the plain customer

    const npc = { sprite, shadow, tween: null, state: 'arriving', kind: 'neighbor' };
    this._neighbor = npc;
    this.npcs.push(npc);

    // Walk to a visiting spot near the stand (offset from the customer's spot).
    const tx = this.farmStand.x + Phaser.Math.Between(-30, 30);
    const ty = this.farmStand.y - 50;
    const dist = Phaser.Math.Distance.Between(spawnX, spawnY, tx, ty);

    sprite.setFlipX(true);
    sprite.play('npc_walk', true);

    npc.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: (dist / (PLAYER_SPEED * 0.85)) * 1000,
      ease: 'Linear',
      onComplete: () => {
        npc.tween = null;
        sprite.stop();
        sprite.setTexture('npc_walk_0');
        npc.state = 'visiting';
        // Leaves on its own after a while if the player never interacts.
        npc.leaveTimer = this.time.delayedCall(20_000, () => this._neighborLeave(npc));
      },
    });
  }

  // The neighbor's current trade offer, given the relationship score — item(s) for
  // gold (see data/neighbor.js NEIGHBOR_TRADE_TIERS). Called by the Trade interactable
  // (interactables.js will read this once wired) and directly by the smoke test.
  neighborTradeOffer() {
    return neighborTradeOffer(this._neighborScore);
  }

  // Complete a trade with the visiting neighbor: charge the player the offer's price,
  // hand over the offer's item into the active carrier (if it accepts the content —
  // mirrors gatherFrom's capacity handling), and send the neighbor on their way.
  // Returns true if the trade went through, false if it couldn't (no neighbor
  // visiting, can't afford it, or no compatible carrier equipped).
  tradeWithNeighbor() {
    const npc = this._neighbor;
    if (!npc || npc.state !== 'visiting') return false;
    const offer = this.neighborTradeOffer();
    if (this.money < offer.price) return false;

    const hot = this.scene.get('HotbarScene');
    const key = hot?._resolveKey?.(hot.hotbar[hot.activeSlot]);
    const item = hot?.getActiveItem?.();
    if (!item || item.type !== 'carrier' || !item.accepts?.includes(offer.give.content)) return false;

    const st = hot.carriers[key];
    // A carrier already holding a different content can't also take this trade's
    // goods (mirrors the gathering-source content-mismatch rule).
    if (st.count > 0 && st.content !== offer.give.content) return false;

    this.money -= offer.price;
    this.game.events.emit(EVENTS.MONEY_CHANGED, this.money);
    st.content = offer.give.content;
    st.count = (st.count || 0) + offer.give.qty;
    hot._saveCarriers?.();
    hot._buildHotbar?.();

    this._npcSpeech(npc, `Thanks!`);
    const icon = this.add.image(npc.sprite.x, npc.sprite.y - 60, CONTENT_DEFS[offer.give.content].icon)
      .setScale(1.8).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });

    npc.leaveTimer?.remove();
    this.time.delayedCall(1200, () => this._neighborLeave(npc));
    return true;
  }

  // Gift the visiting neighbor one unit of whatever's in the active carrier — builds
  // the relationship score (data/neighbor.js giftNeighbor), mirroring the bird
  // befriending commit moment with a little heart + a "friendship grew" beat on a
  // level-up. Returns true if the gift landed, false if there's no neighbor to gift
  // or nothing held to give.
  giftNeighborWithActiveItem() {
    const npc = this._neighbor;
    if (!npc || npc.state !== 'visiting') return false;
    const hot = this.scene.get('HotbarScene');
    const item = hot?.getActiveItem?.();
    if (!item || item.type !== 'carrier' || (item.count ?? 0) <= 0) return false;

    hot.useActiveCarrier(1);
    const step = giftNeighbor(this._neighborScore);
    this._neighborScore = step.score;
    this._saveNeighborFriendship();

    this.showHeart(npc.sprite);
    if (step.leveledUp) {
      this._npcSpeech(npc, 'We’re getting close!');
    } else {
      this._npcSpeech(npc, 'Aw, thank you!');
    }
    return true;
  }

  // Send the visiting neighbor back out the way the customer leaves (mirrors
  // _npcLeave in farmStand.js, but clears the dedicated `_neighbor` slot too so a
  // new one can be scheduled/spawned in).
  _neighborLeave(npc) {
    if (this._neighbor === npc) this._neighbor = null;
    npc.leaveTimer?.remove();
    this._npcLeave(npc);
  }
};
