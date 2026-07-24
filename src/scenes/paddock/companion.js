// Dog companion charm (#186 v1) — the farm dog trots alongside the player with some
// slack, then sits down near them when the player stands idle. Autonomous (no lead
// rope): a self-contained per-frame follow driven from PaddockScene.update, modelled
// on the led-horse easing (riding.js updateLeading) but decided entirely by the dog.
//
// Applied as a functional mixin so `this` is the scene. Purely cosmetic — no stats,
// no care effect, and lower priority than nothing (it's the dog's default job now).
// Herding/watch-dog/recall are deferred follow-ups; this pass is companion only.
//
// State machine (on the dog creature `a`):
//   'following'     — easing toward its slot behind the player (walk anim)
//   'companion-sit' — parked on its haunches beside an idle player (sit pose)
// It only ever takes a dog that's free (idle/wandering/following/companion-sit), so
// it never yanks the dog out of a herding bout or the night settle — those own it.

import Phaser from 'phaser';
import { DOG_COMPANION, PLAYER_BOUNDS } from './constants.js';
import { companionDecision } from './companionDecision.js';

export const WithCompanion = (Base) => class extends Base {
  // The one farm dog, if it's spawned and active. Cached by key so we don't rescan
  // this.animals every frame once we've found it.
  _companionDog() {
    if (this._dogCompanion?.sprite?.active) return this._dogCompanion;
    this._dogCompanion = this.animals?.find(
      (o) => o.model?.species === 'dog' && o.sprite?.active) ?? null;
    return this._dogCompanion;
  }

  // Ensure the dog's single-frame sit animation exists (built lazily so it doesn't
  // matter what order textures/spawn happen in). Mirrors spawnAnimal's idle/walk.
  _ensureSitAnim(key) {
    if (this.anims.exists(`sit_${key}`)) return;
    if (!this.textures.exists(`${key}_sit_0`)) return;
    this.anims.create({ key: `sit_${key}`, frames: [{ key: `${key}_sit_0` }], frameRate: 1, repeat: -1 });
  }

  // Per-frame companion follow. Called from update() after movePlayer so the player's
  // position/moving flag for this frame are current.
  updateDogCompanion(delta) {
    const a = this._companionDog();
    if (!a || !this.player) return;

    // Hands off while another beat owns the dog: a herding bout (#187), the night
    // settle, or resting. The dog resumes companion duty the moment it's free again.
    if (this.isNight) return;
    if (!['idle', 'wandering', 'following', 'companion-sit'].includes(a.state)) return;

    const px = this.player.sprite.x, py = this.player.sprite.y;
    // The follow slot sits a little behind the player, opposite their facing, so the
    // dog trails rather than crowding the front. Falls back to straight-down.
    const behind = { right: Math.PI, left: 0, down: -Math.PI / 2, up: Math.PI / 2 }[this.player.facing]
                   ?? -Math.PI / 2;
    const tx = Phaser.Math.Clamp(px + Math.cos(behind) * DOG_COMPANION.GAP,
                                 PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ty = Phaser.Math.Clamp(py + Math.sin(behind) * DOG_COMPANION.GAP,
                                 PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const dx = tx - a.sprite.x, dy = ty - a.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Track how long the player has stood still (reset the moment they move).
    if (this.player.moving) this._playerIdleMs = 0;
    else this._playerIdleMs = (this._playerIdleMs || 0) + delta;

    const verb = companionDecision(
      { playerMoving: this.player.moving, playerIdleMs: this._playerIdleMs, slotDist: dist });

    if (verb === 'sit') {
      if (a.state !== 'companion-sit') this._dogSitDown(a, px);
      return;
    }

    // Leaving the sit (player moved or drifted): pop back up before doing anything.
    if (a.state === 'companion-sit') this._dogStandUp(a);

    if (verb === 'hold') {
      // Within slack — hold position, settle to idle (loose rope, not dragged).
      if (a.state === 'following') {
        a.state = 'idle';
        if (a.sprite.anims.currentAnim?.key !== `idle_${a.key}`) a.sprite.play(`idle_${a.key}`, true);
      }
      return;
    }

    // Beyond slack — take the dog and ease it toward the slot. Cancel any wander tween
    // so the two movers don't fight. A brisk trot, breaking into a run past CATCH_UP.
    // wanderTween holds both plain wanders and in-flight A* path moves (_runPath), so
    // stopping it cancels either — the two movers never fight over the sprite.
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    a.state = 'following';

    const runMult = dist > DOG_COMPANION.CATCH_UP ? DOG_COMPANION.RUN_MULT : 1;
    const step = DOG_COMPANION.SPEED * runMult * (delta / 1000);
    const pull = Math.min(dist - DOG_COMPANION.SLACK, step);
    const ux = dx / dist, uy = dy / dist;

    // Axis-separated move with collision so the dog slides along the fence, same
    // discipline as a led horse — except the dog always passes through the gate
    // regardless of open/closed state (#314), so it uses its own obstacle list
    // (_obstaclesFor strips the gate obstacle for the dog specifically) rather than
    // the raw shared list a led horse would collide against.
    const R = a.bodyR ?? 11;
    const obstacles = this._obstaclesFor(a.key);
    const fromX = a.sprite.x, fromY = a.sprite.y;
    const nx = a.sprite.x + ux * pull, ny = a.sprite.y + uy * pull;
    if (!this._collides(nx, a.sprite.y, R, obstacles)) a.sprite.x = nx;
    if (!this._collides(a.sprite.x, ny, R, obstacles)) a.sprite.y = ny;

    const movedX = a.sprite.x - fromX;
    if (Math.abs(movedX) > 0.2) a.sprite.setFlipX(movedX < 0);
    const moved = Math.hypot(a.sprite.x - fromX, a.sprite.y - fromY);
    if (moved > 0.2 && a.sprite.anims.currentAnim?.key !== `walk_${a.key}`) {
      a.sprite.play(`walk_${a.key}`, true);
    }
  }

  // Settle the dog onto its haunches facing the player.
  _dogSitDown(a, px) {
    if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    a.state = 'companion-sit';
    this._ensureSitAnim(a.key);
    a.sprite.setFlipX(px < a.sprite.x); // look toward the player
    if (this.anims.exists(`sit_${a.key}`)) a.sprite.play(`sit_${a.key}`, true);
    else a.sprite.play(`idle_${a.key}`, true); // graceful fallback if art missing
  }

  // Pop the dog back up from a sit and hand it to the follow branch.
  _dogStandUp(a) {
    a.state = 'idle';
    a.sprite.play(`idle_${a.key}`, true);
  }
};
