import Phaser from 'phaser';
import { saveHorse } from '../data/save.js';

const WORLD_W = 1920;
const WORLD_H = 1280;

// How close the player needs to be to a horse to interact.
const INTERACT_DIST = 100;
const PLAYER_SPEED  = 180; // px / second

// Horse wander area (expanded for larger world).
const BOUNDS = { minX: 180, maxX: 1740, minY: 360, maxY: 1060 };

// Player movement area (keeps player away from edges).
const PLAYER_BOUNDS = { minX: 40, maxX: 1880, minY: 80, maxY: 1220 };

const S = 2;

export default class PaddockScene extends Phaser.Scene {
  constructor() {
    super('PaddockScene');
  }

  create() {
    this.horse    = this.registry.get('horse');
    this.decayAccum = 0;
    this.saveAccum  = 0;
    this.horses     = []; // { sprite, shadow, key }

    this.buildWorld();
    this.buildHorses();
    this.buildPlayer();

    // Action events from PortraitScene carry { type, horseKey }.
    this.game.events.on('horse-action', this.doAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('horse-action', this.doAction, this);
    });
  }

  // ─── World ───────────────────────────────────────────────────────────────

  buildWorld() {
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    // Scattered grass-variant patches.
    [
      [160, 300], [480, 200], [800, 450], [1100, 300], [1400, 180],
      [1700, 400], [300, 700], [700, 900], [1000, 750], [1300, 1000],
      [1600, 850], [200, 1050], [500, 1150], [900, 1100], [1700, 1100],
    ].forEach(([x, y]) => {
      this.add.image(x, y, 'grass2').setScale(S).setDepth(-99).setAlpha(0.9);
    });

    // Flowers scattered across the full world.
    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    [
      [80, 400], [140, 600], [260, 360], [340, 620], [460, 410],
      [580, 580], [700, 370], [800, 610], [920, 450], [1000, 350],
      [60, 540], [420, 560], [640, 520], [190, 290], [860, 560],
      [1100, 450], [1200, 620], [1340, 390], [1460, 570], [1580, 430],
      [1700, 600], [1800, 380], [1860, 520], [1050, 800], [1180, 950],
      [1380, 850], [1520, 980], [1650, 780], [1780, 900], [280, 880],
      [420, 1020], [560, 900], [700, 1040], [850, 820], [980, 1020],
      [120, 750], [240, 1100], [360, 980], [500, 800], [630, 1100],
    ].forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length])
        .setScale(S).setDepth(y);
    });
  }

  // ─── Horses ──────────────────────────────────────────────────────────────

  buildHorses() {
    this.spawnHorse(680, 730, 'horse',  1500);
    this.spawnHorse(380, 530, 'horse2',  800);
    this.spawnHorse(1380, 860, 'horse3', 2200);
  }

  spawnHorse(startX, startY, key, wanderDelay) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` }
        ],
        frameRate: 6, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    const h = { sprite, shadow, key };
    this.horses.push(h);
    this.scheduleWander(h, wanderDelay);
    return h;
  }

  scheduleWander(h, delay) {
    this.time.delayedCall(delay, () => this.wander(h));
  }

  wander(h) {
    if (!h.sprite.active) return;
    const tx = Phaser.Math.Between(BOUNDS.minX, BOUNDS.maxX);
    const ty = Phaser.Math.Between(BOUNDS.minY, BOUNDS.maxY);
    const dist = Phaser.Math.Distance.Between(h.sprite.x, h.sprite.y, tx, ty);

    h.sprite.setFlipX(tx < h.sprite.x);
    h.sprite.play(`walk_${h.key}`, true);

    this.tweens.add({
      targets: h.sprite,
      x: tx, y: ty,
      duration: Math.max(600, dist * 11),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!h.sprite.active) return;
        h.sprite.play(`idle_${h.key}`, true);
        this.scheduleWander(h, Phaser.Math.Between(2000, 5000));
      }
    });
  }

  // ─── Player ──────────────────────────────────────────────────────────────

  buildPlayer() {
    // Animations.
    const makeAnim = (key, frames, rate) => {
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames, frameRate: rate, repeat: -1 });
      }
    };
    makeAnim('player_walk_down', [{ key: 'player_down_0' }, { key: 'player_down_1' }], 7);
    makeAnim('player_walk_up',   [{ key: 'player_up_0'   }, { key: 'player_up_1'   }], 7);
    makeAnim('player_walk_side', [{ key: 'player_side_0' }, { key: 'player_side_1' }], 7);

    const startX = WORLD_W / 2;
    const startY = WORLD_H / 2 + 60;

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S * 1.0).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, 'player_down_0')
      .setOrigin(0.5, 1).setScale(3).setDepth(startY);

    this.player    = { sprite, shadow, facing: 'down', moving: false };
    this.moveTween = null; // active tap-to-move tween

    // Camera follows the player, bounded to world.
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(sprite, true, 0.12, 0.12);

    // Keyboard input.
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Tap / click to move.
    this.input.on('pointerdown', this.handleTap, this);

    // Gamepad — track which pad is active; use events (not polling) for buttons
    // so they work reliably on iOS PWA where polling can miss frames.
    this.gamePad      = null;
    this.usingPad     = false;
    this.padAJustDown = false; // set by 'down' event, consumed in checkProximity

    this.input.gamepad.on('connected', pad => { this.gamePad = pad; });
    if (this.input.gamepad.total > 0) this.gamePad = this.input.gamepad.getPad(0);

    // A button (index 0) → interact; B button (index 1) → close portrait.
    this.input.gamepad.on('down', (_pad, button) => {
      this.usingPad = true;
      if (button.index === 0) this.padAJustDown = true;
      if (button.index === 1 && this.scene.isActive('PortraitScene')) {
        this.scene.stop('PortraitScene');
      }
    });

    // Interact prompt — label updates based on active input method.
    this.interactPrompt = this.add.text(0, 0, '[ E ]  interact', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#1c1f2ecc',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5, 1).setDepth(9999).setVisible(false);
  }

  // Tap/click on the world to walk there; tap near a horse to interact with it.
  handleTap(pointer) {
    // Ignore if the portrait is open — taps go to that scene instead.
    if (this.scene.isActive('PortraitScene')) return;
    if (pointer.button !== 0) return; // primary button / tap only

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Check if the tap landed near a horse.
    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(world.x, world.y, h.sprite.x, h.sprite.y);
      if (d < 80) {
        const tx = h.sprite.x + (world.x < h.sprite.x ? -70 : 70);
        this.tapMoveTo(tx, h.sprite.y, () => {
          const item = this.getActiveItem();
          if (item) {
            this.useItemOnHorse(item, h);
          } else {
            this.openPortrait(h.key);
          }
        });
        return;
      }
    }

    // Otherwise just walk to the tapped position.
    this.tapMoveTo(world.x, world.y);
  }

  // Tween the player to (tx, ty) at walking speed; call onArrive when done.
  tapMoveTo(tx, ty, onArrive) {
    if (this.moveTween) { this.moveTween.stop(); this.moveTween = null; }

    const { sprite } = this.player;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty);
    if (dist < 8) { onArrive?.(); return; }

    // Pick facing direction from the movement vector.
    const dx = tx - sprite.x;
    const dy = ty - sprite.y;
    const facing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');

    this.player.facing = facing;
    sprite.setFlipX(facing === 'left');
    const animKey = facing === 'up' ? 'player_walk_up' :
                    facing === 'down' ? 'player_walk_down' : 'player_walk_side';
    sprite.play(animKey, true);
    this.player.moving = true;

    this.moveTween = this.tweens.add({
      targets: sprite,
      x: tx, y: ty,
      duration: (dist / PLAYER_SPEED) * 1000,
      ease: 'Linear',
      onComplete: () => {
        this.moveTween = null;
        this.player.moving = false;
        const idleKey = facing === 'up'   ? 'player_up_0' :
                        facing === 'down'  ? 'player_down_0' : 'player_side_0';
        sprite.stop();
        sprite.setTexture(idleKey);
        onArrive?.();
      },
    });
  }

  // Returns the active hotbar item, or null.
  getActiveItem() {
    const hotbar = this.scene.get('HotbarScene');
    return hotbar?.getActiveItem() ?? null;
  }

  // Apply an item's action to a horse immediately (no panel needed).
  useItemOnHorse(item, h) {
    const allHorses = this.registry.get('allHorses');
    const horse = allHorses[h.key];
    if (!horse) return;

    switch (item.action) {
      case 'feed':  horse.feed();  break;
      case 'water': horse.water(); break;
      case 'brush': horse.brush(); break;
      case 'pet':   horse.pet();   break;
    }

    if (h.key === 'horse') saveHorse(horse);
    this.game.events.emit('stats-changed');

    if (item.action === 'pet') {
      this.showHeart(h.sprite);
      this.hop(h.sprite);
    } else {
      this.showIcon(item.icon, h.sprite);
    }

    // Refresh portrait panel if it's open for this horse.
    if (this.scene.isActive('PortraitScene')) {
      const viewing = this.registry.get('viewingHorse');
      if (viewing?.horseKey === h.key) {
        this.scene.get('PortraitScene').refreshStats(horse);
      }
    }
  }

  // ─── Portrait ────────────────────────────────────────────────────────────

  openPortrait(key) {
    const allHorses = this.registry.get('allHorses');
    this.registry.set('viewingHorse', {
      horse:      allHorses[key],
      portraitKey: `portrait_${key}`,
      horseKey:   key,
    });
    if (this.scene.isActive('PortraitScene')) {
      this.scene.get('PortraitScene').refresh();
      return;
    }
    this.scene.launch('PortraitScene');
    this.scene.bringToTop('PortraitScene');
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  doAction({ type, horseKey }) {
    const allHorses = this.registry.get('allHorses');
    const horseData = allHorses[horseKey];
    if (!horseData) return;

    switch (type) {
      case 'feed':  horseData.feed();  break;
      case 'water': horseData.water(); break;
      case 'brush': horseData.brush(); break;
      case 'pet':   horseData.pet();   break;
    }

    if (horseKey === 'horse') saveHorse(horseData);

    const h = this.horses.find(h => h.key === horseKey);
    if (h) {
      if (type === 'pet') {
        this.showHeart(h.sprite);
        this.hop(h.sprite);
      } else {
        const icons = { feed: 'iconFeed', water: 'iconWater', brush: 'iconBrush' };
        this.showIcon(icons[type], h.sprite);
      }
    }
  }

  showHeart(sprite) {
    const heart = this.add.image(sprite.x, sprite.y - 100, 'heart')
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: heart,
      y: heart.y - 56, alpha: 0, scale: S * 1.4,
      duration: 900, ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  showIcon(key, sprite) {
    const icon = this.add.image(sprite.x, sprite.y - 112, key)
      .setScale(S).setDepth(10000);
    this.tweens.add({
      targets: icon,
      y: icon.y - 44, alpha: 0,
      duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  hop(sprite) {
    this.tweens.add({
      targets: sprite,
      y: sprite.y - 12, duration: 120,
      yoyo: true, ease: 'Quad.easeOut',
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    this.movePlayer(delta);
    this.checkProximity();
    this.depthSort();
    this.tickDecay(delta);
    this.tickAutosave(delta);
  }

  movePlayer(delta) {
    const { cursors, wasd, player } = this;
    const pad = this.gamePad;

    let vx = 0, vy = 0;

    // Keyboard
    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;

    // Gamepad left stick (dead-zone 0.15) and D-pad.
    // pad.left/right/up/down return float 0-1, not GamepadButton objects.
    if (pad) {
      const sx = pad.leftStick.x;
      const sy = pad.leftStick.y;
      if (Math.abs(sx) > 0.15) vx += sx;
      if (Math.abs(sy) > 0.15) vy += sy;
      if (pad.left  > 0.5) vx -= 1;
      if (pad.right > 0.5) vx += 1;
      if (pad.up    > 0.5) vy -= 1;
      if (pad.down  > 0.5) vy += 1;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = pad && (
      Math.abs(pad.leftStick.x) > 0.15 || Math.abs(pad.leftStick.y) > 0.15 ||
      pad.left > 0.5 || pad.right > 0.5 || pad.up > 0.5 || pad.down > 0.5
    );
    if (kbActive)  this.usingPad = false;
    if (padActive) this.usingPad = true;

    // Keyboard/gamepad cancels any active tap-to-move tween.
    if ((kbActive || padActive) && this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }

    // If a tap tween is running, let it handle position — don't also apply input.
    if (this.moveTween) {
      player.shadow.x = player.sprite.x;
      player.shadow.y = player.sprite.y;
      return;
    }

    // Clamp combined input to unit range.
    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);

    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      // Normalize diagonal so diagonal speed = straight speed.
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

      const dist = PLAYER_SPEED * (delta / 1000);
      player.sprite.x = Phaser.Math.Clamp(player.sprite.x + vx * dist, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      player.sprite.y = Phaser.Math.Clamp(player.sprite.y + vy * dist, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

      // Determine facing direction from dominant axis.
      let newFacing;
      if (Math.abs(vx) >= Math.abs(vy)) {
        newFacing = vx < 0 ? 'left' : 'right';
      } else {
        newFacing = vy < 0 ? 'up' : 'down';
      }

      if (!player.moving || newFacing !== player.facing) {
        player.facing = newFacing;
        const animKey = newFacing === 'up'   ? 'player_walk_up' :
                        newFacing === 'down'  ? 'player_walk_down' :
                        'player_walk_side';
        player.sprite.setFlipX(newFacing === 'left');
        player.sprite.play(animKey, true);
      }
      player.moving = true;

    } else if (player.moving) {
      // Stopped — freeze on the correct idle frame for the last direction.
      const idleKey = player.facing === 'up'  ? 'player_up_0' :
                      player.facing === 'down' ? 'player_down_0' :
                      'player_side_0';
      player.sprite.setFlipX(player.facing === 'left');
      player.sprite.stop();
      player.sprite.setTexture(idleKey);
      player.moving = false;
    }

    player.shadow.x = player.sprite.x;
    player.shadow.y = player.sprite.y;
  }

  checkProximity() {
    const { player } = this;
    let nearest = null;
    let nearestDist = Infinity;

    for (const h of this.horses) {
      const d = Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y,
        h.sprite.x, h.sprite.y
      );
      if (d < nearestDist) { nearestDist = d; nearest = h; }
    }

    const inRange = nearest && nearestDist < INTERACT_DIST;

    if (inRange) {
      const item = this.getActiveItem();
      const verb = item ? `Use ${item.label}` : 'Info';
      const btn  = this.usingPad ? '[ A ]' : '[ E ]';
      const label = `${btn}  ${verb}`;
      if (this.interactPrompt.text !== label) this.interactPrompt.setText(label);
      this.interactPrompt.setPosition(nearest.sprite.x, nearest.sprite.y - 118);
      this.interactPrompt.setVisible(true);
    } else {
      this.interactPrompt.setVisible(false);
    }

    const eJust = Phaser.Input.Keyboard.JustDown(this.eKey);
    const aJust = this.padAJustDown;
    this.padAJustDown = false;

    if (inRange && (eJust || aJust)) {
      const item = this.getActiveItem();
      if (item) {
        this.useItemOnHorse(item, nearest);
      } else {
        this.openPortrait(nearest.key);
      }
    }
  }

  depthSort() {
    const p = this.player;
    p.shadow.setDepth(p.sprite.y - 1);
    p.sprite.setDepth(p.sprite.y);

    for (const h of this.horses) {
      h.shadow.x = h.sprite.x;
      h.shadow.y = h.sprite.y;
      h.shadow.setDepth(h.sprite.y - 1);
      h.sprite.setDepth(h.sprite.y);
    }
  }

  tickDecay(delta) {
    this.decayAccum += delta;
    if (this.decayAccum >= 1000) {
      this.horse.applyDecay(this.decayAccum / 1000, false);
      this.decayAccum = 0;
      this.game.events.emit('stats-changed');
    }
  }

  tickAutosave(delta) {
    this.saveAccum += delta;
    if (this.saveAccum >= 15000) {
      this.saveAccum = 0;
      saveHorse(this.horse);
    }
  }
}
