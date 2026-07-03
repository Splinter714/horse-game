// Farm stand + NPC customers. Applied as a functional mixin so `this` is the
// scene. Owns this.farmStand and this.npcs.

import Phaser from 'phaser';
import { EVENTS } from '../../data/events.js';
import { CONTENT_DEFS } from '../../data/items.js';
import { playGather } from '../../audio/sounds.js';
import { WORLD_W, PLAYER_SPEED, PLAYER_BOUNDS, S, STAND_DEFS, STAND_TYPES } from './constants.js';

export const WithFarmStand = (Base) => class extends Base {
  // ─── Farm Stand ──────────────────────────────────────────────────────────

  buildFarmStand() {
    const sx = 1600, sy = 780;
    const sprite = this.add.image(sx, sy, 'farmStand')
      .setScale(S).setDepth(sy).setOrigin(0.5, 1);
    const stock = Object.fromEntries(STAND_TYPES.map(t => [t, 0]));
    this.farmStand = { x: sx, y: sy, stock, sprite, itemSprites: [] };

    // Count badge floating just above the eggs on the counter.
    this.farmStand.badge = this.add.text(sx, sy - 64, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#fffde0',
      backgroundColor: '#1c1f2eee',
      padding: { x: 9, y: 5 },
    }).setOrigin(0.5, 1).setDepth(sy + 10).setVisible(false);

    // Obstacle: the solid table/counter the player actually bumps into — NOT the
    // overhead canopy. The art's table body is texture x4–68, y22–44 (origin is
    // bottom-centre, scale S=2), i.e. ~128 wide, ~44 tall, with its base at sy.
    this.obstacles.push({ x: sx - 64, y: sy - 44, w: 128, h: 44, isFarmStand: true });

    this._refreshStand();
  }

  // Total units across every product the stand is holding.
  _standTotal() {
    const s = this.farmStand;
    return STAND_TYPES.reduce((sum, t) => sum + s.stock[t], 0);
  }

  // Show the stand's stock as actual produce on the counter, plus a small count
  // badge. Re-run whenever stock changes (stocking, or a customer buying).
  _refreshStand() {
    const s = this.farmStand;
    s.itemSprites.forEach(e => e.destroy());
    s.itemSprites = [];

    // Flatten the per-type stock into a single list of items to draw.
    const queue = [];
    for (const type of STAND_TYPES) {
      for (let i = 0; i < s.stock[type]; i++) queue.push(STAND_DEFS[type]);
    }

    const CAP = 8;                  // most items we draw before it's just the badge
    const shown = Math.min(queue.length, CAP);
    const perRow = 4, spacingX = 16, rowLift = 9;
    const counterY = s.y - 30;      // table surface in world space
    for (let i = 0; i < shown; i++) {
      const def = queue[i];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, shown - row * perRow);
      const ex = s.x - ((rowCount - 1) * spacingX) / 2 + col * spacingX;
      const ey = counterY - row * rowLift;
      s.itemSprites.push(
        this.add.image(ex, ey, def.tex).setScale(def.scale).setOrigin(0.5, 1).setDepth(s.y + 1 + row)
      );
    }

    if (this._standTotal() > 0) {
      s.badge.setText(STAND_TYPES.filter(t => s.stock[t] > 0)
        .map(t => `${STAND_DEFS[t].emoji}×${s.stock[t]}`).join('  '));
      s.badge.setVisible(true);
    } else {
      s.badge.setVisible(false);
    }
  }

  // Deposit a full basket's worth of produce at the farm stand.
  stockStand() {
    const active = this.getActiveItem();
    const type = active?.content;
    if (!STAND_DEFS[type] || active.count <= 0) return;
    const n = active.count;
    this.scene.get('HotbarScene')?.useActiveCarrier(n);
    this.farmStand.stock[type] += n;
    this._refreshStand();

    const icon = this.add.image(this.farmStand.x, this.farmStand.y - 60, STAND_DEFS[type].floatIcon)
      .setScale(1.8).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // Dump the shears' whole wool load into the farm stand's wool stock (#254), to be
  // sold to passing customers — the shears' equivalent of the scooper dumping compost
  // at the bin. Takes the load from the hotbar (which clears it), adds it to the stand,
  // and floats a wool icon as feedback. No-op when the shears are empty.
  dumpShearsWool() {
    const hot = this.scene.get('HotbarScene');
    const n = hot?.takeShearsLoad?.() ?? 0;
    if (n <= 0) return;
    this.farmStand.stock.wool = (this.farmStand.stock.wool ?? 0) + n;
    this._refreshStand();
    playGather('wool');

    const icon = this.add.image(this.farmStand.x, this.farmStand.y - 60, STAND_DEFS.wool.floatIcon)
      .setScale(1.8).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // ─── Spinning wheel — crafting (#233) ──────────────────────────────────────

  // Spin the active carrier's raw wool into yarn (1:1) at the spinning wheel. Reads
  // the wheel prop's `craft` block (from → to) so it's data-driven, not wool-specific.
  // No-op unless the carrier holds the craftable input. Floats the output icon as
  // feedback, mirroring stockStand's stock-float.
  spinWool() {
    const w = this.props.spinningWheel;
    if (!w) return;
    const { from, to } = w.craft;
    const n = this.scene.get('HotbarScene')?.convertActiveCarrier(from, to) ?? 0;
    if (n <= 0) return;
    playGather(to); // a soft whirr/click as the wheel turns
    this._spinWheelAnim(w);
    const icon = this.add.image(w.x, w.y - 40, CONTENT_DEFS[to].icon)
      .setScale(1.8).setDepth(10000);
    this.tweens.add({
      targets: icon, y: icon.y - 40, alpha: 0,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // Briefly spin the wheel's spoked disc so the craft reads as motion (#233 playtest).
  // The spokes overlay is normally hidden and pinned on the hub; here we reveal it and
  // rotate it a couple of turns over ~0.8s, easing out to a stop, then hide it again so
  // the static base wheel remains at rest. No-op if the wheel wasn't built with an
  // overlay (older saves / tests). Restarts cleanly if spun again mid-turn.
  _spinWheelAnim(w) {
    const spokes = w?.spokes;
    if (!spokes) return;
    this.tweens.killTweensOf(spokes);
    spokes.setVisible(true).setAngle(0);
    this.tweens.add({
      targets: spokes, angle: 360 * 2, duration: 800, ease: 'Cubic.easeOut',
      onComplete: () => spokes.setVisible(false).setAngle(0),
    });
  }

  // ─── NPC Customers ───────────────────────────────────────────────────────

  _scheduleNextCustomer() {
    const delay = Phaser.Math.Between(45_000, 90_000);
    this.time.delayedCall(delay, () => {
      if (!this.isNight) this._spawnCustomer();
      this._scheduleNextCustomer();
    });
  }

  _spawnCustomer() {
    // No stand or nothing for sale → no customer arrives at all. (Re-checked at
    // spawn time, not just scheduling, so stock that empties before the timer
    // fires still suppresses the visit.)
    if (!this.farmStand || this._standTotal() <= 0) return;

    // Spawn from the right edge of the world
    const spawnX = WORLD_W - 20;
    const spawnY = Phaser.Math.Clamp(
      this.farmStand.y + Phaser.Math.Between(-80, 80),
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
      .setOrigin(0.5, 1).setScale(3).setDepth(spawnY);

    const npc = { sprite, shadow, tween: null, state: 'arriving' };
    this.npcs.push(npc);

    // Walk to the stand
    const tx = this.farmStand.x + Phaser.Math.Between(-30, 30);
    const ty = this.farmStand.y + 20;
    const dist = Phaser.Math.Distance.Between(spawnX, spawnY, tx, ty);

    sprite.setFlipX(true); // walking left toward stand
    sprite.play('npc_walk', true);

    npc.tween = this.tweens.add({
      targets: sprite, x: tx, y: ty,
      duration: (dist / (PLAYER_SPEED * 0.85)) * 1000,
      ease: 'Linear',
      onComplete: () => {
        npc.tween = null;
        sprite.stop();
        sprite.setTexture('npc_walk_0');
        this._npcShop(npc);
      },
    });
  }

  _npcShop(npc) {
    npc.state = 'shopping';
    const stand = this.farmStand;

    if (this._standTotal() <= 0) {
      // Nothing to buy — show sad bubble and leave
      this._npcSpeech(npc, ':(');
      this.time.delayedCall(1200, () => this._npcLeave(npc));
      return;
    }

    // Pick a random product the stand has and buy 1–3 of it.
    const available = STAND_TYPES.filter(t => stand.stock[t] > 0);
    const type = Phaser.Utils.Array.GetRandom(available);
    const qty = Math.min(stand.stock[type], Phaser.Math.Between(1, 3));
    const price = qty * STAND_DEFS[type].price;
    stand.stock[type] -= qty;
    this.money += price;
    this._refreshStand();
    this.game.events.emit(EVENTS.MONEY_CHANGED, this.money);

    this._npcSpeech(npc, `$${price}!`);

    // Floating coin feedback over the stand
    const coin = this.add.image(stand.x, stand.y - 50, 'iconCoin')
      .setScale(2).setDepth(10000);
    this.tweens.add({
      targets: coin, y: coin.y - 48, alpha: 0,
      duration: 1100, ease: 'Sine.easeOut',
      onComplete: () => coin.destroy(),
    });

    this.time.delayedCall(1500, () => this._npcLeave(npc));
  }

  _npcSpeech(npc, text) {
    const bubble = this.add.text(npc.sprite.x, npc.sprite.y - 60, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px', color: '#fffef5',
      backgroundColor: '#2a3050f2',
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 1).setDepth(10001);
    this.tweens.add({
      targets: bubble, y: bubble.y - 24, alpha: 0,
      duration: 1400, ease: 'Sine.easeOut',
      onComplete: () => bubble.destroy(),
    });
  }

  _npcLeave(npc) {
    npc.state = 'leaving';
    const exitX = WORLD_W + 40;

    npc.sprite.setFlipX(false); // walking right off screen
    npc.sprite.play('npc_walk', true);

    const dist = Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, exitX, npc.sprite.y);
    npc.tween = this.tweens.add({
      targets: npc.sprite, x: exitX,
      duration: (dist / PLAYER_SPEED) * 1000,
      ease: 'Linear',
      onComplete: () => {
        npc.sprite.destroy();
        npc.shadow.destroy();
        this.npcs = this.npcs.filter(n => n !== npc);
      },
    });
  }

};
