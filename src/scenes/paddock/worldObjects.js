// World-object plumbing — the interactive props the player acts on: dropping food
// piles, the water trough's level/sprite, and the pasture gate. Distinct from
// world.js (which *builds* the static world): this is the runtime state of those
// objects. Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { fillBowlLevel, bowlHasFood } from '../../data/bowls.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, TROUGH_CAP, TROUGH_PER_BUCKET, BOWL_CAP, S } from './constants.js';
import { gateNudgeY } from './gateNudge.js';
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

    // Generic post-drop hook: a concern mixin can react to a food pile landing
    // (e.g. bunny food attracting a wild bunny to the roster — paddock/bunny.js
    // `onFoodPlaced`). Species-neutral — the hook decides what, if anything, a given
    // content attracts, so this shared file names no species.
    this.onFoodPlaced?.(content, spot.x, spot.y);
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

  // ─── Cat bowls (#202 rework) ─────────────────────────────────────────────

  // Cat food + water bowls — a matching two-bowl set tucked just south of the house
  // (the cat's home / usual haunt). Unlike gather sources, these are NOT filled into a
  // carrier: the cat walks up and eats/drinks from them DIRECTLY (its seekFood/seekWater
  // behaviors), and the player's job is to keep them stocked — pour a basket of cat food
  // into the food bowl, a bucket of water into the water bowl (interactables.js `catBowl`
  // descriptors → fillCatBowl). Each carries a numeric `level` (0..BOWL_CAP servings)
  // that the cat depletes and the player refills; the sprite swaps filled/empty as it
  // crosses zero. Start empty so the very first job is to fill them.
  buildCatBowls() {
    const mk = (x, y, tex) => {
      const sprite = this.add.image(x, y, `${tex}Empty`).setScale(S).setDepth(y).setOrigin(0.5, 1);
      return { x, y, sprite, tex, level: 0 };
    };
    this.props.catFoodBowl  = mk(165, 420, 'catFoodBowl');
    this.props.catWaterBowl = mk(205, 420, 'catWaterBowl');
  }

  // The two cat bowls, keyed by the content that fills them: the food bowl takes a
  // basket of cat food, the water bowl a bucket of water. Shared by the fill action
  // and the cat's seek behaviors so both agree on where/what a bowl is.
  _catBowlFor(content) {
    if (content === 'catFood') return this.props.catFoodBowl;
    if (content === 'water')   return this.props.catWaterBowl;
    return null;
  }

  // Pour the active carrier into the matching cat bowl, topping it up to BOWL_CAP —
  // a basket of cat food into the food bowl, a bucket of water into the water bowl.
  // Mirrors fillTrough: consumes the carrier and raises the bowl's level; the cat
  // then eats/drinks straight from the bowl (seekFood/seekWater), lowering it. One
  // scoop/pour refills the whole bowl (kid-friendly, like a real feeding).
  fillCatBowl(content) {
    const bowl = this._catBowlFor(content);
    if (!bowl || bowl.level >= BOWL_CAP) return; // already full
    const item = this.getActiveItem();
    if (!item || item.content !== content || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(1); // spend one unit to refill
    this._setCatBowlLevel(bowl, fillBowlLevel(BOWL_CAP));
    playSplash();
  }

  // Set a cat bowl's level (clamped) and swap its sprite between the filled and empty
  // texture as it crosses zero. The single owner of bowl-level changes — both the
  // player refilling (fillCatBowl) and the cat eating/drinking (catEatFromBowl) go
  // here. `filled` mirrors level>0 for the interactable's "already full" checks.
  _setCatBowlLevel(bowl, level) {
    if (!bowl) return;
    bowl.level  = Phaser.Math.Clamp(level, 0, BOWL_CAP);
    bowl.filled = bowlHasFood(bowl.level);
    bowl.sprite.setTexture(bowl.filled ? bowl.tex : `${bowl.tex}Empty`);
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
        // Nudge to whichever side the player is already on, with the switchover at
        // the true fence line (PASTURE_BOUNDS.minY) — the same north/south divide
        // _settleAtGate uses for creatures. The old threshold (g.y + g.h*0.8) was an
        // offset that biased north, so a player standing just south of the line still
        // got shoved back into the farm (#117).
        p.y = gateNudgeY(p.y, g, PASTURE_BOUNDS.minY);
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
