// World-object plumbing — the interactive props the player acts on: dropping food
// piles, the water trough's level/sprite, and the pasture gate. Distinct from
// world.js (which *builds* the static world): this is the runtime state of those
// objects. Extracted from PaddockScene as its own concern (issue #167).

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { fillBowlLevel, bowlHasFood } from '../../data/bowls.js';
import { PLAYER_BOUNDS, PASTURE_BOUNDS, TROUGH_CAP, TROUGH_PER_BUCKET, BOWL_CAP, S, DROPPINGS_CAP } from './constants.js';
import { gateNudgeY } from './gateNudge.js';
import { troughDrinkSpots, pickTroughSpot } from '../../data/trough.js';
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

    // Generic post-drop hook: any concern mixin can react to a food pile landing
    // (e.g. fox food luring a wild fox, paddock/fox.js `onFoxFoodPlaced`; duck food
    // luring a wild duck, paddock/duck.js `onDuckFoodPlaced`, #275). Each ground-drop
    // taming species owns its OWN hook name (not one shared `onFoodPlaced` slot) so two
    // such species can coexist without a silent-override collision (#167 C1 guard) —
    // `_dispatchFoodPlaced` below just fans the drop out to every hook that exists.
    // Species-neutral — this shared file names no species itself.
    this._dispatchFoodPlaced(content, spot.x, spot.y, pile);
  }

  // Fan a dropped-food event out to every ground-drop taming species' own hook
  // (`on<X>FoodPlaced`, #275) — a fixed, species-neutral list of hook NAMES (not
  // logic), so this file still names no species behavior, only which mixins may want
  // to know. Each hook self-gates on its own content id (e.g. onFoxFoodPlaced bails
  // unless content === 'foxFood'), so an unrelated drop is a cheap no-op call. Also
  // hands along the pile record itself (#408) so a taming-feed hook can consume it
  // (via consumePile below) instead of leaving an "eaten" pile sitting on the ground
  // forever — before this the hooks only got the drop coordinates.
  _dispatchFoodPlaced(content, x, y, pile) {
    this.onFoxFoodPlaced?.(content, x, y, pile);
    this.onDuckFoodPlaced?.(content, x, y, pile);
  }

  // Consume one feeding from a dropped pile: destroy its sprite and drop it from the
  // pasture pile list. Shared by every hay-pile eater — horses/grazers (horseAI.js
  // `horseGoEat`) and the tamed fox/duck taming-feed (fox.js/duck.js, #408) — so
  // pile-removal lives in one place instead of being copy-pasted per species. Horses
  // have always destroyed a hay pile outright on a single eat, regardless of
  // `feedsLeft` (unlike the chicken seed piles in flock.js, which decrement and only
  // clear at 0) — this mirrors that exact behavior so a pile behaves the same no
  // matter who eats it.
  consumePile(pile) {
    if (!pile?.sprite?.active) return;
    pile.sprite.destroy();
    this.props.hayPiles = this.props.hayPiles.filter(p => p !== pile);
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

  // Everyone currently drinking at (or walking to) a trough spot, so two animals
  // never claim the same one. Horses and grazers drink here, and so do the tamed
  // fox/duck — they all route through horseGoDrink — hence both rosters. Stream
  // drinkers carry a `_streamSpot` instead and are simply not in this list.
  _troughDrinkers(except) {
    return [...(this.horses ?? []), ...(this.animals ?? [])]
      .filter(a => a !== except && a.state === 'drinking' && a._drinkSpot);
  }

  // Claim the nearest free, REACHABLE drinking spot around the trough (#336), or
  // null if every spot is taken or unreachable (the caller then wanders instead).
  // Reachability reuses the existing collision/pathfinding helpers: a spot must be
  // standable, and the animal must either have a clear straight line to it (so it
  // can't drink through the trough from the wrong side) or a real A* route around.
  //
  // A spot must also NOT be indoors (2026-07-27): the trough's own OPEN INTERIOR of
  // a nearby building isn't an obstacle by itself, so a drink spot that happens to
  // land inside a building (e.g. the trough sitting close enough to the barn that
  // one of its two long-side offsets falls past the barn's own wall, into its
  // walkable floor) was being approved as "standable" and reachable via the door —
  // a horse would path all the way around and inside just to "drink" beside the
  // wall, reading as clustering/drinking-through-the-wall from outside. Reuses the
  // same isAgentIndoors check the #350/#362 indoors-aware system already has,
  // fed a bare point instead of a live agent.
  _claimTroughSpot(a) {
    const t = this.props.trough;
    if (!t) return null;
    const R = a.bodyR ?? 16;
    const obs = this._obstaclesFor(a.key);
    const from = { x: a.sprite.x, y: a.sprite.y };
    const indoors = (s) => this.isAgentIndoors?.({ sprite: { x: s.x, y: s.y } }) ?? false;
    return pickTroughSpot(troughDrinkSpots(t), from, this._troughDrinkers(a).map(o => o._drinkSpot), {
      canStand:  (s) => !indoors(s) && !this._collides(s.x, s.y, R, obs),
      clearLine: (s) => !indoors(s) && this._clearLine(from.x, from.y, s.x, s.y, R, obs),
      canPath:   (s) => !indoors(s) && !!this._findPath(from.x, from.y, s.x, s.y, { R, obstacles: obs }),
    });
  }

  // ─── Pet bowls (generic — #202 cat rework, #283 generalized, #311 combined,
  // #361 unified into one shared bowl) ─────────────────────────────────────

  // A pet food/water bowl is a small two-sided dish a companion animal (the cat, the
  // dog, a bunny…) walks up to and eats/drinks from DIRECTLY (its seek behaviors) —
  // NOT a gather source you scoop into a carrier. The player's only job is to keep it
  // stocked: pour a matching carrier in and that side tops up to BOWL_CAP
  // (fillPetBowl). #311 merged the separate food + water dishes into ONE prop — one
  // sprite, one interactable — with two independent sides (`bowl.sides.food` /
  // `bowl.sides.water`), each carrying its own numeric `level` (0..BOWL_CAP
  // servings), the content(s) that fill it, and the care action it restores. The
  // sprite (propArt.js `petBowl_${food}${water}`) swaps as either side's fill state
  // crosses zero. Every combined bowl is a plain descriptor in `this.props.petBowls`.
  //
  // #361: cat, dog and bunny used to each have their OWN combined bowl (three props).
  // Playtest feedback said that read as three separate feeding stations rather than
  // one shared one — now there's exactly ONE pet bowl (buildPetBowl below) with a
  // single shared stock/capacity per side, and all three species path to it.
  // `foodContent` may be an array so the one food side accepts more than one carrier
  // content (kibble for the cat/dog, bunny food for the bunny) while still being a
  // single fill level — see `_contentMatches`.
  _addPetBowl({ x, y, tex, foodContent, waterContent, propKey, onFillFood }) {
    const sprite = this.add.image(x, y, `${tex}_00`).setScale(S).setDepth(y).setOrigin(0.5, 1);
    const bowl = {
      x, y, sprite, tex,
      sides: {
        // dx: offset from the bowl's centre to that side's dish (propArt.js draws
        // the food dish at local x=13 and the water dish at x=39 in a 52px-wide
        // sprite centred at x=26, so ±13 from centre).
        food:  { level: 0, content: foodContent,  action: 'feed',  dx: -13, onFill: onFillFood },
        water: { level: 0, content: waterContent, action: 'water', dx: 13 },
      },
    };
    (this.props.petBowls ??= []).push(bowl);
    if (propKey) this.props[propKey] = bowl; // named handle for behaviors/tests
    return bowl;
  }

  // Does a bowl side's declared content accept this carrier's content? `content` is
  // normally a single string (e.g. plain water); the shared bowl's food side (#361)
  // declares an array since more than one carrier tops it up (kibble AND bunny food).
  _contentMatches(sideContent, content) {
    return Array.isArray(sideContent) ? sideContent.includes(content) : sideContent === content;
  }

  // The ONE shared food + water bowl (#202/#283/#311, unified by #361) — cat, dog and
  // bunny all eat/drink from this single object instead of a bowl each. Placed in the
  // yard pocket just south of the doghouse (94, 281) — i.e. right by the house, not
  // out at the bunny hutch — reusing the exact spot the old dog-only bowl proved clear
  // of the kennel's collision box (y ends ≈277), the house wall (x starts 141) and the
  // house→junction worn path (which begins at ≈(235, 322)).
  //
  // The food side accepts EITHER `catFood` (kibble, scooped at the yard's Kibble Sack —
  // the same tin the cat and dog already shared, #347) OR `bunnyFood` (scooped at the
  // bunny hutch) — one shared fill level topped up by whichever the player pours in.
  // Filling it still lures a wild bunny (onFillFood → attractBunny, moved here from the
  // old bunny-only bowl in paddock/bunny.js) — now any food top-up can draw one in,
  // which reads fine for one shared dish everyone notices getting restocked.
  buildPetBowl() {
    this._addPetBowl({
      x: 100, y: 356, tex: 'petBowl', foodContent: ['catFood', 'bunnyFood'], waterContent: 'water',
      propKey: 'petBowl', onFillFood: (bowl) => this.attractBunny(bowl.x, bowl.y),
    });
  }

  // The registered { bowl, sideKey } a given carrier content fills, or null. Shared
  // by the fill action and every pet's seek behaviors so both agree on where/what a
  // bowl is. Content-keyed via `_contentMatches` so a side can accept more than one
  // carrier content (the shared bowl's food side takes kibble OR bunny food, #361).
  _petBowlFor(content) {
    const matches = [];
    for (const bowl of this.props.petBowls ?? []) {
      for (const sideKey of ['food', 'water']) {
        if (this._contentMatches(bowl.sides[sideKey].content, content)) matches.push({ bowl, sideKey });
      }
    }
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];
    // Ambiguous fill content (more than one bowl/side would accept it): pick the one
    // nearest the player. With #361's single shared bowl this only still matters if a
    // future pet bowl is ever added alongside it.
    const px = this.player?.sprite?.x ?? 0, py = this.player?.sprite?.y ?? 0;
    return matches.reduce((best, m) =>
      Phaser.Math.Distance.Between(px, py, m.bowl.x, m.bowl.y) <
      Phaser.Math.Distance.Between(px, py, best.bowl.x, best.bowl.y) ? m : best);
  }

  // Pour the active carrier into the matching pet bowl side, topping it up to
  // BOWL_CAP. Mirrors fillTrough: consumes one carrier unit and raises that side's
  // level; the pet then eats/drinks straight from the bowl (its seek behaviors),
  // lowering it. One scoop/pour refills the whole side (kid-friendly, like a real
  // feeding). An optional per-side `onFill(bowl, sideKey)` hook fires after a refill
  // — used by the bunny bowl's food side to attract a wild bunny (paddock/bunny.js),
  // so attraction now happens on stocking the bowl rather than dropping a pile on the
  // ground (#283).
  fillPetBowl(content) {
    const match = this._petBowlFor(content);
    if (!match) return;
    const { bowl, sideKey } = match;
    const side = bowl.sides[sideKey];
    if (side.level >= BOWL_CAP) return; // already full
    const item = this.getActiveItem();
    if (!item || item.content !== content || item.count <= 0) return;
    this.scene.get('HotbarScene')?.useActiveCarrier(1); // spend one unit to refill
    this._setPetBowlLevel(bowl, sideKey, fillBowlLevel(BOWL_CAP));
    playSplash();
    side.onFill?.(bowl, sideKey);
  }

  // Set a pet bowl side's level (clamped) and swap the (single, combined) sprite to
  // reflect both sides' fill states. The single owner of bowl-level changes — both
  // the player refilling (fillPetBowl) and a pet eating/drinking (petEatFromBowl) go
  // here. `filled` mirrors level>0 for the interactable's "already full" checks.
  _setPetBowlLevel(bowl, sideKey, level) {
    if (!bowl) return;
    const side = bowl.sides[sideKey];
    side.level  = Phaser.Math.Clamp(level, 0, BOWL_CAP);
    side.filled = bowlHasFood(side.level);
    const foodOn  = bowl.sides.food.filled  ? 1 : 0;
    const waterOn = bowl.sides.water.filled ? 1 : 0;
    bowl.sprite.setTexture(`${bowl.tex}_${foodOn}${waterOn}`);
  }

  // Collision boxes for every pet bowl (#202 playtest fix — the cat/bunny dishes had
  // no collision, so the player could walk straight through them). Sprite 26×16 at
  // S=2 (origin 0.5,1), inset a touch. petEatFromBowl (catAI.js) stands the pet at
  // the bowl's rim (offset ±34px, outside this box), so it doesn't block a pet from
  // reaching its own bowl to eat/drink. Read by buildObstacles (world.js).
  _petBowlObstacles() {
    return (this.props.petBowls || []).map(b =>
      ({ x: b.x - 22, y: b.y - 28, w: 44, h: 24, isPetBowl: true, own: b }));
  }

  // ─── Doghouse (#237) ─────────────────────────────────────────────────────

  // A decorative kennel in the yard near the house — the dog is a yard companion,
  // so its home-to-be sits in the house's yard pocket (near the cat's bowls),
  // doorway facing south toward the player. Purely scenery: the dog actually
  // using it (sleeping in it / going home at night, like the cat/chickens) is
  // deferred to #186. Registers a solid footprint (this.doghouseObstacles) that
  // _buildObstacles spreads into this.obstacles, mirroring the barn.
  //
  // Playtest feedback (2026-07-06): the original first-pass spot (410, 470) sat
  // right on the house→junction worn path (buildPath's fromHouse route passes
  // ~(410, 455)), blocking the walkway. Moved to (260, 460) — a clear yard pocket
  // south of the house and west of the fence/path, alongside the cat bowls
  // (165/205, 420), with >90px clearance from every path segment and no overlap
  // with the house wall or fence obstacles.
  buildDoghouse() {
    // Position (94, 281) - the owner's own placement (#330 drag tool, baked in by #341).
    const x = 94, y = 281;
    const sprite = this.add.image(x, y, 'doghouse').setScale(S).setDepth(y).setOrigin(0.5, 1);
    // `sprite` kept so the dev drag tool (#330) can move the visible kennel, not
    // just this record's numbers.
    this.props.doghouse = { x, y, sprite };
    // Sprite 48×42 at S (origin 0.5,1); solid kennel body ≈ local x8–38, y18–40 →
    // inset a touch so the player can brush right up to it.
    this.doghouseObstacles = [{ x: x - 30 + 2, y: y - 48 + 2, w: 60 - 4, h: 44 - 4, own: this.props.doghouse }];
  }

  // ─── Covered shelter (#319) — REMOVED by #349 ───────────────────────────
  // The standalone open-sided lean-to (buildShelter / props.shelter / the `shelter`
  // texture) is gone. The enlarged barn is the farm's rain shelter now, and every
  // pasture grazer — not just horses — files inside when it rains: see the shared
  // `seekShelter` behavior (data/species/shelter.js) and animalGoToShelter
  // (horseAI.js), which paths to props.barn's doorway + interior.

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
