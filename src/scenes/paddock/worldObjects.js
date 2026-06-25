// World-object plumbing — the interactive props the player acts on: dropping food
// piles, the water trough's level/sprite, and the pasture gate. Distinct from
// world.js (which *builds* the static world): this is the runtime state of those
// objects. Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { PLAYER_BOUNDS, TROUGH_CAP, TROUGH_PER_BUCKET, S } from './constants.js';
import { playSplash } from '../../audio/sounds.js';

export const WithWorldObjects = (Base) => class extends Base {
  // ─── Food placement ──────────────────────────────────────────────────────

  // A clear spot to drop food near (x,y) — never on an obstacle (trough, coop,
  // nests, fences, farm stand…) where animals couldn't reach it. Tries the point
  // itself, then widening rings around it; returns null if nothing nearby is free.
  _freeFoodSpot(x, y, R = 16) {
    const clamp = (px, py) => ({
      x: Phaser.Math.Clamp(px, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX),
      y: Phaser.Math.Clamp(py, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY),
    });
    let c = clamp(x, y);
    if (!this._collides(c.x, c.y, R)) return c;
    for (let r = 24; r <= 72; r += 24) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        c = clamp(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        if (!this._collides(c.x, c.y, R)) return c;
      }
    }
    return null;
  }

  // Drop one unit of food from the active basket onto the ground for horses to
  // eat. Consumes a unit from the carrier; does nothing if it's empty or if
  // there's no clear ground in front of the player to drop it on.
  placeFood(item) {
    if (!item || item.type !== 'carrier' || item.count <= 0) return;
    const content = item.content;
    const groundTex = CONTENT_DEFS[content]?.ground;
    if (!groundTex) return; // only feed-type contents drop as food

    const { sprite, facing } = this.player;
    let px = sprite.x, py = sprite.y;
    if      (facing === 'right') px += 70;
    else if (facing === 'left')  px -= 70;
    else if (facing === 'down')  py += 50;
    else                         py -= 50;
    px += Phaser.Math.Between(-15, 15);
    py += Phaser.Math.Between(-10, 10);

    // Refuse to drop onto an obstacle — find clear ground first, and only spend
    // the unit once we know we have somewhere valid to put it.
    const spot = this._freeFoodSpot(px, py);
    if (!spot) return;
    if ((this.scene.get('HotbarScene')?.useActiveCarrier(1) ?? 0) <= 0) return;

    const pileSprite = this.add.image(spot.x, spot.y, groundTex).setScale(S).setDepth(spot.y);
    // `content` rides along so a grazer can respect its diet (a pig walks past hay
    // but eats apples/carrots — see _nearestReachableHay + speciesEatsContent).
    const pile = { x: spot.x, y: spot.y, sprite: pileSprite, feedsLeft: 3, content };
    // Seed feeds chickens (seedPiles); everything else feeds horses (hayPiles).
    if (CONTENT_DEFS[content]?.feeds?.includes('chicken')) this.props.seedPiles.push(pile);
    else                                                   this.props.hayPiles.push(pile);
  }

  // ─── Trough ────────────────────────────────────────────────────────────────

  fillTrough() {
    const t = this.props.trough;
    if (!t || t.level >= TROUGH_CAP) return; // already brim-full
    const item = this.getActiveItem();
    if (item?.content !== 'water' || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(item.count); // empty the bucket
    this._setTroughLevel(t.level + TROUGH_PER_BUCKET); // pour raises the level (#103)
    playSplash();
  }

  // The trough sprite for a given water level (#109): each level has its own
  // texture (`trough` empty, then trough1..troughN built in worldArt.js), so the
  // visible water height matches the actual level 1:1 instead of bucketing many
  // levels into a single "full-looking" sprite (#103).
  _troughTexture(level) {
    if (level <= 0) return 'trough';
    return `trough${Phaser.Math.Clamp(Math.round(level), 1, TROUGH_CAP)}`;
  }

  // Set the trough's water level (clamped), keep the `filled` flag (read in lots
  // of places) in sync, and swap the sprite to match. The single owner of trough
  // level changes — both pouring (fillTrough) and drinking (horseGoDrink) go here.
  _setTroughLevel(level) {
    const t = this.props.trough;
    if (!t) return;
    t.level  = Phaser.Math.Clamp(level, 0, TROUGH_CAP);
    t.filled = t.level > 0;
    t.sprite.setTexture(this._troughTexture(t.level));
  }

  // ─── Gate ────────────────────────────────────────────────────────────────

  toggleGate() {
    const gate = this.props.gate;
    if (!gate) return;

    gate.open = !gate.open;
    gate.sprite.setTexture(gate.open ? 'gateOpen' : 'gateClosed');

    // Update gate obstacle — open gate is passable for everyone, closed gate blocks everyone
    const gateInList = this.obstacles.includes(this.gateObstacle);
    if (gate.open && gateInList) {
      // Remove gate from obstacles so player and horses can pass through
      this.obstacles = this.obstacles.filter(o => o !== this.gateObstacle);
    } else if (!gate.open && !gateInList) {
      // Add gate to obstacles to block passage
      this.obstacles.push(this.gateObstacle);
      // If the player is standing inside the gate footprint, nudge them out to
      // whichever side (farm-north or pasture-south) is closer so they don't get trapped.
      const p = this.player?.sprite;
      const g = this.gateObstacle;
      if (p && this._hits(p.x, p.y, 14, g)) {
        // Strongly favor nudging the player north (toward the farm). Only push
        // them south into the pasture if they're clearly in the bottom portion.
        const nudgeSouth = p.y > g.y + g.h * 0.8;
        p.y = nudgeSouth ? g.y + g.h + 15 : g.y - 15;
        p.y = Phaser.Math.Clamp(p.y, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
        if (this.player.shadow) this.player.shadow.y = p.y;
      }

      // Bounce any creature caught mid-stride in the gate doorway to its home
      // side so it isn't left standing in (or walking through) the shut gate.
      // Movers still approaching the gate are stopped by the _runPath guard.
      for (const m of [...this.horses, ...this.animals]) {
        if (!m.sprite?.active || !m.wanderTween) continue;
        if (this._hits(m.sprite.x, m.sprite.y, 16, g)) {
          m.wanderTween.stop();
          m.wanderTween = null;
          this._settleAtGate(m);
        }
      }
    }
  }
};
