// Creatures: the species-neutral spawn + wandering/movement core — building every
// animal and horse from species data, the shared pathfinding/wander primitives, and
// the foal/horse spawners. Applied as a functional mixin so `this` is the scene. The
// chicken/flock behavior lives in flock.js (WithFlock) and the horse need-driven
// wandering/herd/rolling in herd.js (WithHerd); both reuse the primitives here (#169).

import Phaser from 'phaser';
import { BOUNDS, PASTURE_BOUNDS, S, GATE_X, GATE_GAP_X0, GATE_GAP_X1 } from './constants.js';
import { ART_SCALE } from '../../art/_frames.js';
import { SPECIES } from '../../data/species/index.js';
import { ROSTER_SPECIES } from '../../data/save.js';
import { Animal } from '../../data/Animal.js';

// Generic movement feel for any creature whose species declares no `movement`
// block (e.g. the cat). Species defs override these per-animal.
const GENERIC_MOVEMENT = { wanderMin: 4000, wanderMax: 10000 };

// species id → the Phaser registry key holding its persisted roster (#167 B4), so
// the generic spawn can find a species' individuals without hardcoding the key.
const ROSTER_KEY_BY_ID = Object.fromEntries(ROSTER_SPECIES.map((r) => [r.id, r.registryKey]));

// How often the flock re-decides (notice dropped seed, a seed-carrying or nearby
// player, the grain bin). Kept short so chickens react promptly to seeds (#127) —
// the follow/gather primitives already guard against re-pathing every tick.
const CHICKEN_TICK_MS = 700;

export const WithCreatures = (Base) => class extends Base {
  // Paddock "feel" knobs for a species id, falling back to GENERIC_MOVEMENT for
  // creatures without a species def. The single source of truth is each species'
  // `movement` block (src/data/species/<name>/index.js).
  _movementFor(speciesId) {
    return { ...GENERIC_MOVEMENT, ...(SPECIES[speciesId]?.movement ?? {}) };
  }

  // ─── Generic model / grazer helpers (species-neutral, #cow) ────────────────

  // The care model for any in-world creature, whether it's a horse (kept in the
  // allHorses registry, keyed by sprite key) or an animal carrying its own model
  // (chickens, the cat, the cow). Lets the shared eat/drink/graze primitives read
  // and update stats without knowing the species.
  _modelFor(a) {
    return this.registry.get('allHorses')?.[a.key] ?? a.model ?? null;
  }

  // Every creature that uses the herbivore feeding/drinking AI: the horses plus any
  // animal whose species declares the `grazes` capability (the cow). Used for the
  // shared "one per pile / spread at the trough" occupancy checks so cows and horses
  // don't stack on the same spot.
  _grazers() {
    const out = [...this.horses];
    for (const a of this.animals) {
      if (SPECIES[a.model?.species]?.capabilities?.grazes) out.push(a);
    }
    return out;
  }
  // ─── Other animals ───────────────────────────────────────────────────────

  // Spawn every in-world animal from its species `spawn` data (#167 B4) — no per-
  // species hardcoding. Each world species (those declaring `spawn.inWorld`) is
  // walked: its individuals come from the persisted roster (or a fresh in-memory
  // model for keyless species like the cat), placed at the declared positions, with
  // visual/roam params from data and behaviour hooks wired from capabilities. Adding
  // an animal is a `spawn` block in its species folder, not an edit here.
  buildAnimals() {
    // Disabled barnyard animals (sheep/pig/dog) have no `spawn.inWorld` yet, so they
    // aren't spawned — enable by adding a `spawn` block to their species def.
    for (const spec of this._worldSpecies()) {
      const sp = spec.spawn;
      // Models: a fresh in-memory model for keyless species (cat — not persisted),
      // else the species' persisted roster from the registry.
      const models = sp.memoryModel
        ? { [spec.id]: new Animal(spec) }
        : (this.registry.get(ROSTER_KEY_BY_ID[spec.id]) ?? {});

      Object.keys(models).forEach((key, i) => {
        const place = sp.placements[i] ?? sp.placements[sp.placements.length - 1] ?? { x: 0, y: 0 };
        const a = this.spawnAnimal(
          place.x, place.y, key, sp.shadowScale, sp.walkFps, sp.tweenRate,
          place.home?.x, place.home?.y, place.wanderRadius, sp.eatFps, models[key]);
        if (sp.roam === 'pasture') a.homeBounds = PASTURE_BOUNDS; // roam the pasture, not the world
        if (sp.bodyR != null) a.bodyR = sp.bodyR;
        // Optional per-species size multiplier on top of the base S scale, so a
        // bulkier animal (the cow) can read bigger than a horse without redrawing
        // its art. Scales both the sprite and its ground shadow to match.
        if (sp.scale != null) {
          a.sprite.setScale(S * sp.scale);
          a.shadow.setScale(S * sp.shadowScale * sp.scale);
        }
        this._applySpawnCapabilities(a, spec);
      });
    }

    // Flock AI tick (chickens). A no-op when no flock is present, so it's safe to
    // register unconditionally.
    this.time.addEvent({ delay: CHICKEN_TICK_MS, loop: true, callback: this.chickenTick, callbackScope: this });
  }

  // Species that spawn into the world (declare `spawn.inWorld`). Horses spawn via
  // buildHorses; the disabled barnyard animals have no spawn block yet.
  _worldSpecies() {
    return Object.values(SPECIES).filter((s) => s.spawn?.inWorld);
  }

  // Wire the per-spawn behaviour hooks a species' capabilities ask for: grazers get
  // the shared food/water goal tick; peckers get the idle ground-peck; roosters
  // start hidden and emerge from the coop on the first morning phase (dayNight.js).
  _applySpawnCapabilities(a, spec) {
    const cap = spec.capabilities ?? {};
    if (cap.grazes) {
      // Goal-tick so a wandering grazer heads for food/water before a plain stroll —
      // the same hook the horses use (creatureWander → a.tick).
      a.needTarget = null;
      a.tick = (c) => this.horseTickForHorse(c);
    }
    if (cap.pecks) a.onSettle = (c) => this._maybeChickenPeck(c); // occasional peck (#130)
    if (cap.roosts) {
      // Hold hidden until the first phase change decides how they enter: out of the
      // coop in the morning, or already milling in the yard otherwise (no yard flash).
      a.state = 'roosting';
      a.sprite.setVisible(false);
      a.shadow.setVisible(false);
      if (a.wanderTween) { a.wanderTween.stop(); a.wanderTween = null; }
    }
  }


  spawnAnimal(startX, startY, key, shadowScale, walkFps, tweenRate, homeX, homeY, wanderRadius, eatFps, model = null) {
    if (!this.anims.exists(`idle_${key}`)) {
      this.anims.create({
        key: `idle_${key}`,
        frames: [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
        frameRate: 2, repeat: -1,
      });
      this.anims.create({
        key: `walk_${key}`,
        frames: [
          { key: `${key}_walk_0` }, { key: `${key}_walk_1` },
          { key: `${key}_walk_2` }, { key: `${key}_walk_3` },
        ],
        frameRate: walkFps, repeat: -1,
      });
      if (eatFps) {
        // Alias the "eat" pose to the standing idle for a species with no dedicated
        // eat frames (e.g. the cow grazes head-up enough that this reads fine) — so
        // the shared eat/drink primitives can play eat_<key> without a missing-anim
        // warning, no per-species workaround needed (#167 B4).
        const hasEat = this.textures.exists(`${key}_eat_0`);
        this.anims.create({
          key: `eat_${key}`,
          frames: hasEat
            ? [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }]
            : [{ key: `${key}_idle_0` }, { key: `${key}_idle_1` }],
          frameRate: hasEat ? eatFps : 2, repeat: -1,
        });
      }
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S * shadowScale).setDepth(startY - 1);
    // Chickens / cat use 1× (non-super-sampled) art, so they keep the full S scale —
    // unlike the horse/foal whose textures are ART_SCALE× larger. (A broad replace
    // had wrongly shrunk these to S/ART_SCALE.)
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S).setDepth(startY)
      .play(`idle_${key}`);

    // Keyless creatures (e.g. the cat) carry no model; derive the species from the
    // sprite key by stripping any roster index ('chicken0' → 'chicken', 'cat' → 'cat').
    const speciesId = model?.species ?? key.replace(/\d+$/, '');
    const mv = this._movementFor(speciesId);
    const a = { sprite, shadow, key, state: 'idle', wanderTween: null, tweenRate,
                homeX: homeX ?? null, homeY: homeY ?? null, wanderRadius: wanderRadius ?? null,
                homeBounds: BOUNDS, bodyR: 11, wanderMin: mv.wanderMin, wanderMax: mv.wanderMax, tick: null,
                _eatPile: null, eatTimer: null, model };
    this.animals.push(a);
    this.scheduleCreatureWander(a, Phaser.Math.Between(500, 3000));
    return a;
  }

  // ─── Shared creature movement & wandering ────────────────────────────────
  // Every animal — horses, chickens, and anything spawned later — moves through
  // these helpers, so they all share the same obstacle avoidance, gate handling,
  // and pathfinding the player uses. Per-creature differences (body size, home,
  // pace, goals) live as fields on the creature object, set at spawn.

  // Walk a creature to (tx,ty), steering around obstacles via the A* pathfinder
  // (the same one tap-to-move uses), then call onArrive. The creature's own
  // obstacle list is used, so it ignores its own home (e.g. a chicken's coop).
  moveCreatureTo(a, tx, ty, onArrive) {
    a._pathTarget = { x: tx, y: ty };
    const R = a.bodyR ?? 16;
    const obstacles = this._obstaclesFor(a.key);
    let path = this._findPath(a.sprite.x, a.sprite.y, tx, ty, { R, obstacles });
    if (!path || !path.length) {
      // No route to the target. The usual cause is a shut gate between the
      // creature and a target on the far side — e.g. a horse left outside the
      // fence still wandering toward inside points. Don't fall back to a straight
      // line: that walks it through the fence, and the gate guard then snaps it
      // across (#81). Head to the gate on the creature's *current* side and wait;
      // once the gate opens, a later wander finds a real path across.
      const line = PASTURE_BOUNDS.minY;
      const acrossShutGate = ((a.sprite.y - line) * (ty - line) < 0) && !this.props.gate?.open;
      if (acrossShutGate) {
        const gx = Phaser.Math.Clamp(GATE_X, GATE_GAP_X0 + 14, GATE_GAP_X1 - 14);
        const gy = a.sprite.y < line ? line - 40 : line + 40; // wait on our own side
        path = this._findPath(a.sprite.x, a.sprite.y, gx, gy, { R, obstacles });
      }
      if (!path || !path.length) { onArrive?.(); return; } // nowhere reachable — stay put
    }
    this._runPath(a, path, onArrive);
  }

  // Pick a wander destination for a creature, returning { x, y, nicker? }. A
  // need-driven creature (a horse via _needTarget) biases toward whatever it
  // currently wants — food at the gate, the trough, a buddy. Otherwise: a clear
  // spot within its home radius if it has one (chickens stay near the coop), or
  // anywhere in its home bounds (horses roam the whole pasture).
  _pickWanderTarget(a) {
    const obsList = this._obstaclesFor(a.key);
    const b = a.homeBounds ?? BOUNDS;

    const pref = a.needTarget ? a.needTarget(a) : null;
    if (pref) {
      return {
        x: Phaser.Math.Clamp(pref.tx, b.minX, b.maxX),
        y: Phaser.Math.Clamp(pref.ty, b.minY, b.maxY),
        nicker: !!pref.nicker,
        pairWith: pref.pairWith ?? null,
      };
    }

    if (a.homeX != null && a.wanderRadius != null) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * a.wanderRadius;
        const cx = Phaser.Math.Clamp(a.homeX + Math.cos(angle) * r, b.minX, b.maxX);
        const cy = Phaser.Math.Clamp(a.homeY + Math.sin(angle) * r, b.minY, b.maxY);
        if (!this._collides(cx, cy, 18, obsList)) return { x: cx, y: cy };
      }
      return { x: a.homeX, y: a.homeY };
    }
    const { tx, ty } = this._safeTarget(b.minX, b.maxX, b.minY, b.maxY,
                                        obsList, a.sprite.x, a.sprite.y);
    return { x: tx, y: ty };
  }

  // Queue a creature's next wander. On firing, give its optional goal-tick a
  // chance to redirect it (horses head for hay/water); otherwise it wanders.
  scheduleCreatureWander(a, delay) {
    this.time.delayedCall(delay, () => {
      if (this.isNight || a.state !== 'idle' || a._begTimer) return;
      if (a.tick && a.tick(a)) return;
      this.creatureWander(a);
    });
  }

  creatureWander(a) {
    if (!a.sprite.active || a.state !== 'idle') return;
    a.state = 'wandering';
    const target = this._pickWanderTarget(a);
    this.moveCreatureTo(a, target.x, target.y, () => {
      if (!a.sprite.active) return;
      a.sprite.play(`idle_${a.key}`, true);
      a.state = 'idle';
      // On arrival: greet the player if this was a "wait to be fed" trip; turn
      // head-to-tail if we pulled up beside a buddy; otherwise let the creature
      // settle (a relaxed horse may roll in the dirt).
      if (target.nicker) this._maybeNickerAtPlayer(a);
      else if (target.pairWith) this._faceHeadToTail(a, target.pairWith);
      else a.onSettle?.(a);
      this.scheduleCreatureWander(a, Phaser.Math.Between(a.wanderMin ?? 4000, a.wanderMax ?? 10000));
    });
  }

  // Back-compat aliases — older call sites still say schedule(Animal)Wander.
  scheduleAnimalWander(a, delay) { this.scheduleCreatureWander(a, delay); }
  scheduleWander(h, delay)       { this.scheduleCreatureWander(h, delay); }

  // Chicken/flock behavior (chickenTick, follow/gather/peck, egg laying and
  // collection) lives in flock.js (WithFlock); the horse need-driven wandering,
  // herd dynamics, rolling and greeting live in herd.js (WithHerd). Both reuse the
  // shared movement primitives above. Split out of this file in #169.

  spawnFoal(startX, startY, key, parentH) {
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
        frameRate: 8, repeat: -1
      });
      this.anims.create({
        key: `sleep_${key}`,
        frames: [{ key: `${key}_sleep_0` }, { key: `${key}_sleep_1` }],
        frameRate: 1, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S * 0.7).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S / ART_SCALE).setDepth(startY)
      .play(`idle_${key}`);

    const foal = { sprite, shadow, key, parentH };
    this.foals.push(foal);
    return foal;
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
      this.anims.create({
        key: `eat_${key}`,
        frames: [{ key: `${key}_eat_0` }, { key: `${key}_eat_1` }],
        frameRate: 2, repeat: -1
      });
      this.anims.create({
        key: `sleep_${key}`,
        frames: [{ key: `${key}_sleep_0` }, { key: `${key}_sleep_1` }],
        frameRate: 1, repeat: -1
      });
    }

    const shadow = this.add.image(startX, startY, 'shadow')
      .setScale(S).setDepth(startY - 1);
    const sprite = this.add.sprite(startX, startY, `${key}_idle_0`)
      .setOrigin(0.5, 1).setScale(S / ART_SCALE).setDepth(startY)
      .play(`idle_${key}`);

    // Dust-splotch overlay — same transform as the sprite, alpha driven by the
    // grooming stat in depthSort() so a dirty horse visibly shows it. (issue #26)
    const dustOverlay = this.add.image(startX, startY, 'dustSplotches')
      .setOrigin(0.5, 1).setScale(S).setDepth(startY).setAlpha(0);
    // Wavy "stink" lines that float above a very dirty horse's back.
    const stinkOverlay = this.add.image(startX, startY - 66, 'stinkLines')
      .setOrigin(0.5, 1).setScale(S).setDepth(startY).setAlpha(0);

    const model = this.registry.get('allHorses')[key];
    const mv = this._movementFor(model?.species ?? 'horse');
    // Horses share the same movement/wander helpers as every other animal; their
    // "home" is the whole pasture (no fixed point), and they get a goal-tick that
    // sends them to hay/water before falling back to a plain wander.
    const h = { sprite, shadow, key, state: 'idle', wanderTween: null, eatTimer: null,
                dustOverlay, stinkOverlay, _stinkPhase: Math.random() * 6.28,
                saddled: model?.saddled ?? false, saddleImg: null,
                homeX: null, homeY: null, wanderRadius: null, homeBounds: PASTURE_BOUNDS,
                bodyR: 16, tweenRate: 11, wanderMin: mv.wanderMin, wanderMax: mv.wanderMax,
                needTarget: (c) => this._needTarget(c),
                onSettle:   (c) => this._maybeRoll(c),
                tick:       (c) => this.horseTickForHorse(c) };
    this.horses.push(h);
    this.scheduleCreatureWander(h, wanderDelay);
    return h;
  }

};
