// World-object plumbing — the interactive props the player acts on: dropping food
// piles, the water trough's level/sprite, and the pasture gate. Distinct from
// world.js (which *builds* the static world): this is the runtime state of those
// objects. Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { fillBowlLevel, bowlHasFood } from '../../data/bowls.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, TROUGH_CAP, TROUGH_PER_BUCKET, BOWL_CAP, S, DROPPINGS_CAP } from './constants.js';
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

  // ─── Droppings (#232) ────────────────────────────────────────────────────────

  // Fire an ambient dropping: pick a random pasture animal (a grazer — horse, cow,
  // pig, sheep) that's active and visible, and leave a small dropping just behind
  // it. Cosmetic only — no mood/stat effect, per the issue; it's just a bit of
  // clutter for the player to tidy up with the scooper. Capped so the pasture never
  // carpets in poop if the player ignores it for a while.
  spawnDropping() {
    if ((this.props.droppings?.length ?? 0) >= DROPPINGS_CAP) return;
    const pool = (this._grazers?.() ?? []).filter(a => a.sprite?.active && a.sprite.visible);
    if (!pool.length) return;
    const a = pool[Phaser.Math.Between(0, pool.length - 1)];

    // Drop just behind the animal (opposite its facing), nudged onto clear ground so
    // it doesn't land inside an obstacle. Falls back to right at its feet.
    const behind = this._behindAnimal(a);
    const spot = this._freeFoodSpot(behind.x, behind.y) ?? { x: a.sprite.x, y: a.sprite.y };
    this._addDropping(spot.x, spot.y);
  }

  // A point just behind an animal given its facing (or a small random offset if it
  // has none), so a dropping lands at its rear rather than on top of it.
  _behindAnimal(a) {
    const s = a.sprite;
    const f = a.facing ?? a.dir ?? null;
    let dx, dy;
    if      (f === 'left')  { dx = 24;  dy = 4; }
    else if (f === 'right') { dx = -24; dy = 4; }
    else if (f === 'up')    { dx = 0;   dy = 22; }
    else if (f === 'down')  { dx = 0;   dy = -18; }
    else { dx = Phaser.Math.Between(-16, 16); dy = Phaser.Math.Between(10, 24); }
    return { x: s.x + dx, y: s.y + dy };
  }

  // Add a dropping sprite + record at (x,y). Shared by the ambient spawn and the dev
  // trigger so both stay in one place.
  _addDropping(x, y) {
    const sprite = this.add.image(x, y, 'dropping').setScale(S).setDepth(y);
    this.props.droppings.push({ x, y, sprite });
  }

  // Remove a dropping (scooped up): destroy its sprite and drop it from the list.
  removeDropping(dropping) {
    dropping.sprite?.destroy();
    this.props.droppings = this.props.droppings.filter(d => d !== dropping);
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

  // ─── Pet bowls (generic — #202 cat rework, #283 generalized to pets) ────────

  // A pet food/water bowl is a small dish a companion animal (the cat, a bunny…)
  // walks up to and eats/drinks from DIRECTLY (its seek behaviors) — NOT a gather
  // source you scoop into a carrier. The player's only job is to keep it stocked:
  // pour a matching carrier in and it tops up to BOWL_CAP (fillPetBowl). Each bowl
  // carries a numeric `level` (0..BOWL_CAP servings) the pet depletes and the player
  // refills; the sprite swaps filled/empty as level crosses zero. Every bowl is a
  // plain descriptor in `this.props.petBowls`, tagged with the content that fills it
  // (`fillContent`) and the care action it restores (`action`), so fill/consume are
  // species-neutral — a new pet just registers its two bowls.
  //
  // The two cat bowls are the original set (#202), tucked just south of the house;
  // #283 adds the bunny's set by the hutch (buildBunnyBowls, paddock/bunny.js). Both
  // are built here through the same primitive so there's one owner of bowl state.
  _addPetBowl({ x, y, tex, fillContent, action, propKey, onFill }) {
    const sprite = this.add.image(x, y, `${tex}Empty`).setScale(S).setDepth(y).setOrigin(0.5, 1);
    const bowl = { x, y, sprite, tex, level: 0, fillContent, action, onFill };
    (this.props.petBowls ??= []).push(bowl);
    if (propKey) this.props[propKey] = bowl; // named handle for behaviors/tests
    return bowl;
  }

  // Cat food + water bowls (#202). Start empty so the first job is to fill them.
  buildCatBowls() {
    this._addPetBowl({ x: 165, y: 420, tex: 'catFoodBowl',  fillContent: 'catFood', action: 'feed',  propKey: 'catFoodBowl'  });
    this._addPetBowl({ x: 205, y: 420, tex: 'catWaterBowl', fillContent: 'water',   action: 'water', propKey: 'catWaterBowl' });
  }

  // The registered pet bowl a given carrier content fills, or null. Shared by the
  // fill action and every pet's seek behaviors so both agree on where/what a bowl is.
  // Species-neutral: keyed purely on the content, so cat food → the cat's food bowl,
  // bunny food → the bunny's food bowl, plain water → whichever water bowl is nearest
  // the pouring player (so one bucket of water fills the cat OR the bunny dish).
  _petBowlFor(content) {
    const bowls = (this.props.petBowls ?? []).filter(b => b.fillContent === content);
    if (!bowls.length) return null;
    if (bowls.length === 1) return bowls[0];
    // Ambiguous fill content (water fills more than one pet's bowl): pick the one
    // nearest the player, so pouring at the cat dish tops the cat's and at the bunny
    // dish the bunny's.
    const px = this.player?.sprite?.x ?? 0, py = this.player?.sprite?.y ?? 0;
    return bowls.reduce((best, b) =>
      Phaser.Math.Distance.Between(px, py, b.x, b.y) <
      Phaser.Math.Distance.Between(px, py, best.x, best.y) ? b : best);
  }

  // Pour the active carrier into the matching pet bowl, topping it up to BOWL_CAP.
  // Mirrors fillTrough: consumes one carrier unit and raises the bowl's level; the pet
  // then eats/drinks straight from the bowl (its seek behaviors), lowering it. One
  // scoop/pour refills the whole bowl (kid-friendly, like a real feeding). An optional
  // per-bowl `onFill(bowl)` hook fires after a refill — used by the bunny food bowl to
  // attract a wild bunny (paddock/bunny.js), so attraction now happens on stocking the
  // bowl rather than dropping a pile on the ground (#283).
  fillPetBowl(content) {
    const bowl = this._petBowlFor(content);
    if (!bowl || bowl.level >= BOWL_CAP) return; // already full
    const item = this.getActiveItem();
    if (!item || item.content !== content || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(1); // spend one unit to refill
    this._setPetBowlLevel(bowl, fillBowlLevel(BOWL_CAP));
    playSplash();
    bowl.onFill?.(bowl);
  }

  // Set a pet bowl's level (clamped) and swap its sprite between the filled and empty
  // texture as it crosses zero. The single owner of bowl-level changes — both the
  // player refilling (fillPetBowl) and a pet eating/drinking (petEatFromBowl) go here.
  // `filled` mirrors level>0 for the interactable's "already full" checks.
  _setPetBowlLevel(bowl, level) {
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
