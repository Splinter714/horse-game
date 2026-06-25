// Player movement & navigation — keyboard/stick steering (movePlayer), hold-to-move
// steering, tap-to-move with grid A* pathfinding (_findPath), and the per-frame
// navigation stepper. This is the biggest self-contained player subsystem; every
// mover (player, ridden horse, wandering animals) reuses _findPath. Extracted from
// player.js as its own concern (issue #167).

import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_BOUNDS, HOLD_MS, HOLD_DRAG_PX } from './constants.js';
import { dprOf } from '../uiUtils.js';

export const WithPlayerMovement = (Base) => class extends Base {
  movePlayer(delta) {
    if (this.riding) return;

    // Stop all movement while radial menu is open
    if (this.scene.get('HotbarScene')?.invOpen) {
      this._cancelTapMove();
      this._stopWalkAnim();
      return;
    }

    const { cursors, wasd, player } = this;
    const pad = this.gamePad;

    let vx = 0, vy = 0;

    if (cursors.left.isDown  || wasd.left.isDown)  vx -= 1;
    if (cursors.right.isDown || wasd.right.isDown)  vx += 1;
    if (cursors.up.isDown    || wasd.up.isDown)     vy -= 1;
    if (cursors.down.isDown  || wasd.down.isDown)   vy += 1;

    const rp = this._rawPad;
    if (rp) {
      // Left stick steers; the D-pad is reserved for the hotbar now (#121).
      if (Math.abs(rp.leftStickX) > 0.15) vx += rp.leftStickX;
      if (Math.abs(rp.leftStickY) > 0.15) vy += rp.leftStickY;
    }

    const kbActive  = cursors.left.isDown || cursors.right.isDown ||
                      cursors.up.isDown   || cursors.down.isDown  ||
                      wasd.left.isDown    || wasd.right.isDown    ||
                      wasd.up.isDown      || wasd.down.isDown;
    const padActive = rp && (
      Math.abs(rp.leftStickX) > 0.15 || Math.abs(rp.leftStickY) > 0.15
    );
    if (kbActive)  { this.usingPad = false; this.usingTouch = false; }
    if (padActive) { this.usingPad = true;  this.usingTouch = false; }

    // Manual input cancels any tap-to-move trip in progress, and dismisses the
    // info popup — moving is one of the "almost anything else" that closes it.
    if (kbActive || padActive) {
      this._cancelTapMove();
      if (this.scene.isActive('InfoPanelScene')) this.scene.get('InfoPanelScene').close();
    }

    if (this.navPath) {
      this._stepNav(delta);
      player.shadow.x = player.sprite.x;
      player.shadow.y = player.sprite.y;
      return;
    }

    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);
    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      const step = PLAYER_SPEED * (delta / 1000);
      const nx = Phaser.Math.Clamp(player.sprite.x + vx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
      const ny = Phaser.Math.Clamp(player.sprite.y + vy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
      // Slide: try each axis independently so player can slide along walls
      if (!this._collides(nx, player.sprite.y)) player.sprite.x = nx;
      if (!this._collides(player.sprite.x, ny)) player.sprite.y = ny;

      let newFacing;
      if (Math.abs(vx) >= Math.abs(vy)) {
        newFacing = vx < 0 ? 'left' : 'right';
      } else {
        newFacing = vy < 0 ? 'up' : 'down';
      }

      if (!player.moving || newFacing !== player.facing) {
        player.facing = newFacing;
        const animKey = newFacing === 'up'  ? 'player_walk_up' :
                        newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
        player.sprite.setFlipX(newFacing === 'left');
        player.sprite.play(animKey, true);
      }
      player.moving = true;

    } else if (player.moving) {
      const idleKey = player.facing === 'up'  ? 'player_up_0' :
                      player.facing === 'down' ? 'player_down_0' : 'player_side_0';
      player.sprite.setFlipX(player.facing === 'left');
      player.sprite.stop();
      player.sprite.setTexture(idleKey);
      player.moving = false;
    }

    player.shadow.x = player.sprite.x;
    player.shadow.y = player.sprite.y;
  }

  // Begin (or re-aim) a hold-to-move trip toward (x,y). Works mounted or on foot.
  _startHold(x, y) {
    this._holdMove       = true;
    this._holdTarget     = { x, y };
    this._holdPathTarget = { x, y };
    this._holdRepathAt   = this.time.now;
    this._moveToward(x, y);
  }

  _moveToward(x, y) {
    if (this.riding) this._rideMoveTo(x, y);
    else             this.tapMoveTo(x, y);
  }

  handlePointerMove(pointer) {
    if (!this._pointerDown || !this._holdMove) return;
    if (!pointer.isDown) return;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this._holdTarget = { x: w.x, y: w.y };
    // Only treat it as a drag once the finger has actually travelled — a couple of
    // pixels of tap jitter shouldn't short-circuit the hold delay.
    // pointer + _holdDown are physical (buffer) px, so the drag threshold scales by DPR.
    if (Phaser.Math.Distance.Between(pointer.x, pointer.y,
                                     this._holdDownX, this._holdDownY) > HOLD_DRAG_PX * dprOf(this)) {
      this._holdMoved = true;
    }
  }

  handlePointerUp() {
    if (this._holdMove) {
      // A real hold (long press or dragged) stops on release. A quick tap keeps
      // its route so you still walk all the way to where you tapped.
      const held = this.time.now - this._holdDownAt;
      if (held > HOLD_MS || this._holdMoved) {
        if (this.riding) this._cancelRideNav();
        else             this._cancelTapMove();
      }
    }
    this._pointerDown = false;
    this._holdMove    = false;
    this._holdTarget  = null;
  }

  // While the pointer is held, keep the active route pointed at the live finger
  // position — re-pathing only when it drifts a cell or the route runs out, and
  // throttled so the A* search doesn't run every frame.
  _updateHold() {
    if (!this._pointerDown || !this._holdMove || !this._holdTarget) return;
    const now = this.time.now;
    // Don't engage live steering until the press has been held a beat (unless the
    // finger is being dragged) — a brief press stays a plain walk-to-tap.
    if (!this._holdMoved && now - this._holdDownAt < HOLD_MS) return;
    if (now - this._holdRepathAt < 100) return;

    const t = this._holdTarget;
    const drifted = !this._holdPathTarget ||
      Phaser.Math.Distance.Between(t.x, t.y, this._holdPathTarget.x, this._holdPathTarget.y) > 24;
    const routeEmpty = this.riding ? !this.rideNav : !this.navPath;
    if (drifted || routeEmpty) {
      this._holdRepathAt   = now;
      this._holdPathTarget = { x: t.x, y: t.y };
      this._moveToward(t.x, t.y);
    }
  }

  tapMoveTo(tx, ty, onArrive) {
    this._cancelTapMove();

    const { sprite } = this.player;
    tx = Phaser.Math.Clamp(tx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    ty = Phaser.Math.Clamp(ty, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    if (Phaser.Math.Distance.Between(sprite.x, sprite.y, tx, ty) < 8) {
      onArrive?.();
      return;
    }

    // Find a route that steers around obstacles (the trough, fences, nests…) and
    // through the gate opening when it's open. If nothing connects (e.g. the gate
    // is shut and the target is on the far side), head straight and let _stepNav's
    // collision stop us where we can't proceed.
    const path = this._findPath(sprite.x, sprite.y, tx, ty);
    this.navPath     = (path && path.length) ? path : [{ x: tx, y: ty }];
    this.navDest     = { x: tx, y: ty };
    this.navOnArrive = onArrive ?? null;
    this._navStuck = 0;
  }

  // True if a straight segment from (x0,y0) to (x1,y1) stays clear of obstacles
  // for a body of radius R, sampled densely enough to not skip thin walls.
  // `obs` is the obstacle list to test against (defaults to all obstacles).
  _clearLine(x0, y0, x1, y1, R, obs = this.obstacles) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this._collides(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R, obs)) return false;
    }
    return true;
  }

  // Grid A* across the walkable area, returning a smoothed list of world-space
  // waypoints from just after (fromX,fromY) to (toX,toY), or null if unreachable.
  // Used by every mover (player, ridden horse, and wandering animals) so they
  // walk around obstacles instead of into them. `opts.R` is the body clearance
  // and `opts.obstacles` is the obstacle list to avoid (e.g. a chicken's list
  // omits its own coop/nests — its "home"). See _obstaclesFor.
  _findPath(fromX, fromY, toX, toY, opts = {}) {
    const R = opts.R ?? 16; // clearance — a touch more than the body's collision radius
    const obs = opts.obstacles ?? this.obstacles;
    // Straight shot? Skip the grid search entirely.
    if (this._clearLine(fromX, fromY, toX, toY, R, obs)) return [{ x: toX, y: toY }];

    const CELL = 24;
    const { minX, maxX, minY, maxY } = PLAYER_BOUNDS;
    const cols = Math.floor((maxX - minX) / CELL) + 1;
    const rows = Math.floor((maxY - minY) / CELL) + 1;
    const N = cols * rows;
    const wx = c => minX + c * CELL;
    const wy = r => minY + r * CELL;
    const toC = x => Phaser.Math.Clamp(Math.round((x - minX) / CELL), 0, cols - 1);
    const toR = y => Phaser.Math.Clamp(Math.round((y - minY) / CELL), 0, rows - 1);

    const blocked = new Uint8Array(N);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        blocked[r * cols + c] = this._collides(wx(c), wy(r), R, obs) ? 1 : 0;

    const startC = toC(fromX), startR = toR(fromY);
    let goalC = toC(toX), goalR = toR(toY);

    // Snap a blocked goal (e.g. tapping the trough itself) to the nearest free cell.
    if (blocked[goalR * cols + goalC]) {
      let best = -1, bestD = Infinity;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (blocked[r * cols + c]) continue;
          const d = (c - goalC) ** 2 + (r - goalR) ** 2;
          if (d < bestD) { bestD = d; best = r * cols + c; }
        }
      if (best < 0) return null;
      goalC = best % cols; goalR = Math.floor(best / cols);
    }
    const startIdx = startR * cols + startC;
    const goalIdx  = goalR * cols + goalC;
    blocked[startIdx] = 0; // never trap the search at the player's own cell

    const g = new Float64Array(N).fill(Infinity);
    const f = new Float64Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const h = (c, r) => {
      const dc = Math.abs(c - goalC), dr = Math.abs(r - goalR);
      return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr); // octile
    };
    g[startIdx] = 0;
    f[startIdx] = h(startC, startR);
    const open = new Set([startIdx]);
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    let found = false;
    while (open.size) {
      let cur = -1, curF = Infinity;
      for (const idx of open) if (f[idx] < curF) { curF = f[idx]; cur = idx; }
      if (cur === goalIdx) { found = true; break; }
      open.delete(cur);
      const cc = cur % cols, cr = (cur - cc) / cols;
      for (const [dc, dr] of DIRS) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const nidx = nr * cols + nc;
        if (blocked[nidx]) continue;
        // Don't cut across an obstacle corner on diagonal moves.
        if (dc !== 0 && dr !== 0 && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
        const ng = g[cur] + ((dc !== 0 && dr !== 0) ? Math.SQRT2 : 1);
        if (ng < g[nidx]) {
          g[nidx] = ng;
          came[nidx] = cur;
          f[nidx] = ng + h(nc, nr);
          open.add(nidx);
        }
      }
    }
    if (!found) return null;

    // Reconstruct, then string-pull: keep only waypoints we can't see past.
    const cells = [];
    for (let i = goalIdx; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map(i => ({ x: wx(i % cols), y: wy(Math.floor(i / cols)) }));
    pts[0] = { x: fromX, y: fromY };
    const last = pts[pts.length - 1];
    if (this._clearLine(last.x, last.y, toX, toY, R, obs)) pts.push({ x: toX, y: toY });

    const smooth = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      const tail = smooth[smooth.length - 1];
      while (j > i + 1 && !this._clearLine(tail.x, tail.y, pts[j].x, pts[j].y, R, obs)) j--;
      smooth.push(pts[j]);
      i = j;
    }
    smooth.shift(); // drop the player's current position
    return smooth.length ? smooth : [{ x: toX, y: toY }];
  }

  // Stop any in-progress tap-to-move and drop its arrival callback.
  _cancelTapMove() {
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    this._navStuck = 0;
  }

  // Drop the player onto an idle frame matching their current facing.
  _stopWalkAnim() {
    const player = this.player;
    if (!player.moving) return;
    const idleKey = player.facing === 'up'  ? 'player_up_0' :
                    player.facing === 'down' ? 'player_down_0' : 'player_side_0';
    player.sprite.setFlipX(player.facing === 'left');
    player.sprite.stop();
    player.sprite.setTexture(idleKey);
    player.moving = false;
  }

  // Advance the player one frame along navPath, sliding against obstacles like
  // keyboard movement. Reaching the last waypoint fires navOnArrive; getting
  // wedged (e.g. against a closed gate) abandons the trip.
  _stepNav(delta) {
    const { player } = this;
    const sprite = player.sprite;

    let wp = this.navPath[0];
    while (wp && Phaser.Math.Distance.Between(sprite.x, sprite.y, wp.x, wp.y) < 8) {
      this.navPath.shift();
      wp = this.navPath[0];
    }
    if (!wp) { this._stopWalkAnim(); this._finishNav(); return; }

    const dx = wp.x - sprite.x, dy = wp.y - sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = PLAYER_SPEED * (delta / 1000);
    const nx = Phaser.Math.Clamp(sprite.x + (dx / dist) * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    const ny = Phaser.Math.Clamp(sprite.y + (dy / dist) * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    const beforeX = sprite.x, beforeY = sprite.y;
    if (!this._collides(nx, sprite.y)) sprite.x = nx;
    if (!this._collides(sprite.x, ny)) sprite.y = ny;

    // If barely any progress was made, we're wedged against an obstacle — bail
    // after a short grace period rather than scrubbing in place forever. If we
    // wedged right next to the destination (e.g. the trough or a nest, which are
    // themselves obstacles), treat it as an arrival so the interaction still fires.
    if (Math.hypot(sprite.x - beforeX, sprite.y - beforeY) < step * 0.25) {
      this._navStuck += delta;
      if (this._navStuck > 350) {
        this._stopWalkAnim();
        const dest = this.navDest;
        if (dest && Phaser.Math.Distance.Between(sprite.x, sprite.y, dest.x, dest.y) < 60) {
          this._finishNav();
        } else {
          this._cancelTapMove();
        }
        return;
      }
    } else {
      this._navStuck = 0;
    }

    const newFacing = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    if (!player.moving || newFacing !== player.facing) {
      player.facing = newFacing;
      const animKey = newFacing === 'up' ? 'player_walk_up' :
                      newFacing === 'down' ? 'player_walk_down' : 'player_walk_side';
      sprite.setFlipX(newFacing === 'left');
      sprite.play(animKey, true);
    }
    player.moving = true;
  }

  _finishNav() {
    const cb = this.navOnArrive;
    this.navPath = null;
    this.navDest = null;
    this.navOnArrive = null;
    cb?.();
  }
};
