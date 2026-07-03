// Headless smoke test for the actual running game (Phaser in a real browser).
//
// Unit tests (vitest) cover the pure data layer; this covers the things they
// can't: that the game actually BOOTS without runtime errors, the scenes start,
// the herd/flock load into the registry, and the care-action path applies once
// (guards the PortraitScene double-apply regression).
//
// Usage: start the dev server, then `npm run smoke`. Override the URL with
// SMOKE_URL. Exits non-zero (and prints why) on any failure.

import { chromium } from 'playwright';
import { resolveDevServerUrl } from './dev-server-url.mjs';

// `?canvas` forces Phaser's Canvas renderer (headless Chromium lacks WebGL
// framebuffers). The logic we assert on here is renderer-agnostic.
// The dev server's port isn't fixed (Vite increments when 5173 is busy), so
// auto-detect it; override with SMOKE_URL.
const URL = await resolveDevServerUrl();

const fail = (msg) => { console.error('SMOKE FAIL:', msg); process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage();

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });

  // Wait for the game, the PaddockScene, and the loaded herd to all be ready.
  await page.waitForFunction(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.getScene('PaddockScene') &&
              g.scene.isActive('PaddockScene') && g.registry.get('allHorses'));
  }, { timeout: 20000 });

  const result = await page.evaluate(() => {
    const g = window.__game;
    const horses = g.registry.get('allHorses');
    const chickens = g.registry.get('allChickens');
    const h = horses['horse'];

    // Exercise the single-apply care path: drop hunger then apply one feed via the
    // model (the same call the grazing AI makes). Expect exactly +35 — proves the
    // species action data resolves and isn't double-applied.
    h.stats.hunger = 10;
    h.feed();
    const feedDelta = h.stats.hunger - 10;

    // Guard the PaddockScene mixin split: every concern's entry points must still
    // resolve on the prototype chain, and the scene state they own must exist.
    const paddock = g.scene.getScene('PaddockScene');
    const expectMethods = [
      'buildWorld', 'buildObstacles', 'buildFarmStand', '_npcShop', 'stockStand',
      'buildPlayer', 'movePlayer', 'handleTap', '_findPath', 'gatherFrom',
      'mountHorse', 'dismount', 'toggleSaddle', 'toggleLead',
      'horseTick', 'horseGoEat', 'horseGoDrink', 'spawnHorse', 'spawnAnimal',
      'buildAnimals', '_worldSpecies', '_applySpawnCapabilities', // generic spawn (#167 B4)
      'separateHorses', '_horseBeg', '_begWait',
      // Cross-animal charm behaviors (#187): dog↔sheep, chicken scatter, pig nap,
      // night settle/curl, head-to-tail swat.
      'dogGoHerd', '_sheepBunch', 'chickenScatterFrom', '_maybePigNap', '_charmNap',
      '_settleAnimalForNight', 'catCurlUp', '_restAnimalInPlace', '_dogContext', '_charmTailSwish',
      'runBehaviors', '_horseContext', '_chickenContext', '_nearestReachableHay',
      'onPhaseChange', 'depthSort', 'tickDecay',
      // Extracted concern mixins (issue #167): effects / persistence / rendering.
      'showHeart', 'showIcon', '_saveHorses', '_saveAnimal', 'tickAutosave', 'updateSaddles', 'updateFoals',
      // worldObjects: food drops / trough / gate / pet bowls (#202 rework,
      // #283/#289 generalized the cat-specific bowl methods → generic pet bowls).
      'placeFood', '_freeFoodSpot', 'fillTrough', '_setTroughLevel', 'toggleGate',
      'buildCatBowls', 'fillPetBowl', '_setPetBowlLevel', '_petBowlFor',
      'petEatFromBowl', '_catContext', '_catBowlDist',
      // careActions: brush-on-horse + generic produce harvesting (milk).
      'useItemOnHorse', '_produceFromAnimal',
      // interaction: pet/info cluster + info-panel openers.
      'petAnimal', '_petPreferenceProximity', '_maybeGreetOnApproach', 'openProxInfo',
      'openPortrait', 'openChickenInfo', 'openCreatureInfo', '_openInfoPanel',
      // input: gamepad poll, pause overlay, input-mode + prompt toggles.
      '_pollRawPad', '_togglePause', '_syncInputMode', '_onPromptsChanged',
      // player split (#167 A2): movement, prompts, interactables, use-dispatch.
      '_stepNav', 'tapMoveTo', '_renderPrompts', 'checkToolProximity',
      'buildInteractables', '_proximityInteractable', 'useActiveTool', '_nearestToolHorse',
      '_animalUseAction', '_nearestCareAnimal',
      // wildlife: ambient bird beats incl. the bird-bath splash (#219) + feeder (#240).
      'buildWildlife', 'updateWildlife', '_scheduleBirdBathVisit', '_spawnBirdBathVisit',
      '_scheduleFeederVisit', '_spawnFeederVisit',
      // owls: ambient nocturnal owl (#271) — night-only glide-in/hoot/glide-off.
      'buildOwls', '_scheduleOwlVisit', '_spawnOwl', '_owlHootLoop', '_owlGlideOff', '_despawnOwl',
      // birdEcosystem: fixed bird props + feeder fill/drain (#219/#240) + hummingbirds (#226).
      'buildBirdEcosystem', 'buildBirdBath', 'buildSeedFeeder', 'buildNectarFeeder',
      'fillSeedFeeder', '_setSeedFeederLevel', 'drainSeedFeeder',
      'fillNectarFeeder', '_setNectarFeederLevel', 'drainNectarFeeder',
      // birdEcosystemVisits: the object-anchored flying-critter visit beats.
      'startBirdEcosystemVisits', '_scheduleHummingbirdVisit', '_spawnHummingbird', '_hummerTargets',
      '_scheduleBeeVisit', '_spawnBeeVisit', '_beeTargets',
      // beehive + honey (#239).
      'buildBeehive', '_setHoneyLevel', '_ripenHoneyTick', 'harvestBeehive',
      // fox taming (#266): wild-fox summon on fox-food drop + commit-to-roster.
      'buildFox', 'onFoodPlaced', '_lureWildFox', '_feedWildFox', '_commitFox', '_foxRosterFull',
    ];
    const missingMethods = expectMethods.filter((m) => typeof paddock[m] !== 'function');

    // Exercise the unified creature movement/pathfinding (merged upstream work):
    // both a horse and a chicken must path without throwing.
    let movementOk = true, movementError = '';
    try {
      const horse = paddock.horses[0];
      paddock.moveCreatureTo(horse, horse.sprite.x + 60, horse.sprite.y + 20, () => {});
      const chicken = paddock.animals.find((a) => a.key.startsWith('chicken'));
      if (chicken) { chicken.state = 'idle'; paddock.creatureWander(chicken); }
    } catch (e) { movementOk = false; movementError = String(e); }

    // Behavior registry (issue #73): the data-driven dispatcher must pick seekFood
    // for a hungry horse with hay in reach — and actually claim it (state→eating).
    let behaviorDecision = '';
    try {
      const horse = paddock.horses[0];
      horses[horse.key].stats.hunger = 10;
      paddock.props.hayPiles.push({ x: horse.sprite.x + 20, y: horse.sprite.y, sprite: { destroy() {} } });
      horse.state = 'idle';
      const claimed = paddock.runBehaviors(horse);
      behaviorDecision = (claimed && horse.state === 'eating')
        ? 'seekFood'
        : `claimed=${claimed},state=${horse.state}`;
    } catch (e) { behaviorDecision = 'threw: ' + String(e); }

    // Demand-based gathering (#136): a full gather pulls one food per animal that
    // eats it — capped at the carrier capacity. The basket is now effectively
    // unlimited (999), so we probe with a high capacity to assert the true per-animal
    // demand uncapped. Non-food (water) ignores demand and fills to capacity (bucket=1).
    const gatherTargets = {
      hay:    paddock._gatherTarget('hay', 999),
      apple:  paddock._gatherTarget('apple', 999),
      carrot: paddock._gatherTarget('carrot', 999),
      seed:   paddock._gatherTarget('seed', 999),
      water:  paddock._gatherTarget('water', 1),
    };

    // Generic direct-care path (#167 B3): a ready cow harvests once through the
    // species-data-driven produce dispatch (no per-cow methods) — it fills an empty
    // bucket with milk, flips producedToday, and a second attempt the same day no-ops.
    let cowMilk = 'no cow';
    try {
      const cow = paddock.animals.find((a) => a.model?.species === 'cow');
      if (cow) {
        const hot = g.scene.getScene('HotbarScene');
        hot.activeSlot = hot.hotbar.indexOf('bucketGroup');
        hot.activeCarrier.bucket = 'bucket1';
        hot.carriers.bucket1 = { content: null, count: 0 }; // empty bucket → can milk
        cow.model.readyToProduce = true; cow.model.producedToday = false;
        paddock._produceFromAnimal(cow);
        const first = cow.model.producedToday === true
          && hot.carriers.bucket1.content === 'milk' && hot.carriers.bucket1.count >= 1;
        const before = hot.carriers.bucket1.count;
        paddock._produceFromAnimal(cow); // same day → no-op (already produced)
        cowMilk = (first && hot.carriers.bucket1.count === before) ? 'milked-once'
          : `first=${first},count=${hot.carriers.bucket1.count}`;
      }
    } catch (e) { cowMilk = 'threw: ' + String(e); }

    // The goat (#267) is milkable the same data-driven way as the cow — same generic
    // _produceFromAnimal path, no per-goat method. Proves a second milkable species
    // rides the shared produce dispatch: a ready goat fills an empty bucket once.
    let goatMilk = 'no goat';
    try {
      const goat = paddock.animals.find((a) => a.model?.species === 'goat');
      if (goat) {
        const hot = g.scene.getScene('HotbarScene');
        hot.activeSlot = hot.hotbar.indexOf('bucketGroup');
        hot.activeCarrier.bucket = 'bucket1';
        hot.carriers.bucket1 = { content: null, count: 0 }; // empty bucket → can milk
        goat.model.readyToProduce = true; goat.model.producedToday = false;
        paddock._produceFromAnimal(goat);
        const first = goat.model.producedToday === true
          && hot.carriers.bucket1.content === 'milk' && hot.carriers.bucket1.count >= 1;
        const before = hot.carriers.bucket1.count;
        paddock._produceFromAnimal(goat); // same day → no-op (already produced)
        goatMilk = (first && hot.carriers.bucket1.count === before) ? 'milked-once'
          : `first=${first},count=${hot.carriers.bucket1.count}`;
      }
    } catch (e) { goatMilk = 'threw: ' + String(e); }

    // Pig diet (this feature): the pig is a grazer, but its pickier diet must make
    // the shared food-seek skip a hay pile while still targeting an apple pile. We
    // probe _nearestReachableHay directly (the diet gate) so the result is exact.
    let pigDiet = 'no pig';
    try {
      const pig = paddock.animals.find((a) => a.model?.species === 'pig');
      if (pig) {
        const x = pig.sprite.x, y = pig.sprite.y;
        paddock.props.hayPiles = [{ x: x + 20, y, sprite: { destroy() {} }, content: 'hay' }];
        const ignoresHay = paddock._nearestReachableHay(pig) === null;
        const applePile = { x: x + 20, y, sprite: { destroy() {} }, content: 'apple' };
        paddock.props.hayPiles.push(applePile);
        const seeksApple = paddock._nearestReachableHay(pig) === applePile;
        paddock.props.hayPiles = [];
        pigDiet = (ignoresHay && seeksApple) ? 'apples-not-hay'
          : `ignoresHay=${ignoresHay},seeksApple=${seeksApple}`;
      }
    } catch (e) { pigDiet = 'threw: ' + String(e); }

    // #202 rework: the cat eats DIRECTLY from a stocked bowl. Bowls start empty (a
    // hungry cat with an empty food bowl falls through to fishing); once the food bowl
    // is stocked, a hungry cat's behavior dispatch must claim it into the 'eating'
    // state (petEatFromBowl, #283/#289 generic pet-bowl primitive) rather than
    // dropping/gathering. Then draining the bowl to empty must flip its `filled` flag
    // back off (the sprite swap the player sees).
    let catBowls = 'no cat';
    try {
      const cat = paddock.animals.find((a) => a.model?.species === 'cat');
      if (cat) {
        const fb = paddock.props.catFoodBowl, wb = paddock.props.catWaterBowl;
        const startedEmpty = fb.level === 0 && wb.level === 0 && fb.filled !== true;
        // Empty food bowl → a hungry cat should NOT be able to seek it (dist=Infinity).
        cat.model.stats.hunger = 20;
        const emptyDist = paddock._catBowlDist(cat, fb);
        // Stock the food bowl and confirm the cat now commits to eating from it.
        paddock._setPetBowlLevel(fb, 4);
        const stockedFilled = fb.filled === true && fb.level === 4;
        cat.state = 'idle';
        const claimed = paddock.runBehaviors(cat);
        const eating = claimed && cat.state === 'eating';
        // Drain to empty → filled flag off again.
        paddock._setPetBowlLevel(fb, 0);
        const emptiedOff = fb.filled === false;
        catBowls = (startedEmpty && emptyDist === Infinity && stockedFilled && eating && emptiedOff)
          ? 'eats-from-bowl'
          : `startedEmpty=${startedEmpty},emptyDist=${emptyDist},stockedFilled=${stockedFilled},eating=${eating}(claimed=${claimed},state=${cat.state}),emptiedOff=${emptiedOff}`;
      }
    } catch (e) { catBowls = 'threw: ' + String(e); }

    // #240 seed feeder: starts empty (birds ignore it), a fill tops it to the cap and
    // flips its `filled` flag + sprite; each bird feeding drains one; draining to empty
    // flips it back off (the sprite swap + attraction gate the player sees).
    let seedFeeder = 'no feeder';
    try {
      const f = paddock.props.seedFeeder;
      if (f) {
        const startedEmpty = f.level === 0 && f.filled === false;
        paddock._setSeedFeederLevel(8); // full (FEEDER_CAP)
        const stocked = f.filled === true && f.level === 8 && f.sprite.texture.key === 'seedFeeder';
        paddock.drainSeedFeeder(); // one bird feeds
        const drained = f.level === 7;
        paddock._setSeedFeederLevel(0);
        const emptiedOff = f.filled === false && f.sprite.texture.key === 'seedFeederEmpty';
        seedFeeder = (startedEmpty && stocked && drained && emptiedOff)
          ? 'fills-and-drains'
          : `startedEmpty=${startedEmpty},stocked=${stocked},drained=${drained},emptiedOff=${emptiedOff}`;
      }
    } catch (e) { seedFeeder = 'threw: ' + String(e); }

    // #226 hummingbird nectar feeder: same fill/drain contract as the seed feeder but
    // for the nectar resource, plus the hummingbird hover targets include the feeder
    // only while it's stocked (flowers always count).
    let nectarFeeder = 'no feeder';
    try {
      const f = paddock.props.nectarFeeder;
      if (f) {
        const startedEmpty = f.level === 0 && f.filled === false;
        // Empty feeder → hover targets are flowers only (no feeder port).
        const emptyTargets = paddock._hummerTargets();
        const emptyNoFeederPort = emptyTargets.length > 0 && !emptyTargets.some((t) => t.feeder);
        paddock._setNectarFeederLevel(8);
        const stocked = f.filled === true && f.level === 8 && f.sprite.texture.key === 'nectarFeeder';
        const stockedHasPort = paddock._hummerTargets().some((t) => t.feeder);
        paddock.drainNectarFeeder();
        const drained = f.level === 7;
        paddock._setNectarFeederLevel(0);
        const emptiedOff = f.filled === false && f.sprite.texture.key === 'nectarFeederEmpty';
        nectarFeeder = (startedEmpty && emptyNoFeederPort && stocked && stockedHasPort && drained && emptiedOff)
          ? 'fills-and-drains'
          : `startedEmpty=${startedEmpty},emptyNoFeederPort=${emptyNoFeederPort},stocked=${stocked},stockedHasPort=${stockedHasPort},drained=${drained},emptiedOff=${emptiedOff}`;
      }
    } catch (e) { nectarFeeder = 'threw: ' + String(e); }

    // #239 beehive: honey ripens on the hive (a tick), the sprite flips to the ready
    // variant, and a basket harvest pulls the whole batch in + resets the hive to zero.
    let beehive = 'no hive';
    try {
      const h = paddock.props.beehive;
      if (h) {
        const startedEmpty = h.honey === 0 && h.ready === false;
        paddock._ripenHoneyTick(); // one production tick → ripe enough to harvest
        const ripe = h.honey >= 1 && h.ready === true && h.sprite.texture.key === 'beehiveReady';
        // Equip an empty basket and harvest.
        const hot = g.scene.getScene('HotbarScene');
        hot.activeSlot = hot.hotbar.indexOf('basketGroup');
        hot.activeCarrier.basket = 'basket1';
        hot.carriers.basket1 = { content: null, count: 0 };
        const yielded = h.honey;
        paddock.harvestBeehive();
        const harvested = hot.carriers.basket1.content === 'honey'
          && hot.carriers.basket1.count === yielded
          && h.honey === 0 && h.ready === false && h.sprite.texture.key === 'beehive';
        beehive = (startedEmpty && ripe && harvested)
          ? 'ripens-and-harvests'
          : `startedEmpty=${startedEmpty},ripe=${ripe},harvested=${harvested}(basket=${JSON.stringify(hot.carriers.basket1)},honey=${h.honey})`;
      }
    } catch (e) { beehive = 'threw: ' + String(e); }

    // Rooster (#269): spawns into the world as a flock bird (roosts/pecks like the hen),
    // does NOT lay eggs (laysEggs:false → excluded from eggLayTick), IS a breeding partner
    // (the marker #274's chick-hatching hooks into), and CROWS at dawn. We exercise the
    // whole crow path (arm → runBehaviors picks crowAtDawn → roosterCrow plays the anim +
    // sound and sets state 'crowing'), and confirm the crow anim + sound wiring exists.
    let rooster = 'no rooster';
    try {
      const r = paddock.animals.find((a) => a.model?.species === 'rooster');
      if (r) {
        const caps = r.model?._spec?.capabilities ?? {};
        const isFlockBird = paddock._isFlockBird(r);            // roosts with the flock
        const notLayingHen = paddock._isLayingHen(r) === false; // never picked to lay
        const breedingPartner = caps.breedingPartner === true;  // the #274 marker
        const crowAnimReady = g.anims.exists(`crow_${r.key}`);
        // Arm + fire the crow through the real behavior dispatch.
        r.state = 'idle';
        r._crowing = true;
        const claimed = paddock.runBehaviors(r);               // → crowAtDawn.run → roosterCrow
        const crowed = claimed && r.state === 'crowing' && r._crowing === false;
        rooster = (isFlockBird && notLayingHen && breedingPartner && crowAnimReady && crowed)
          ? 'crows-at-dawn'
          : `isFlockBird=${isFlockBird},notLayingHen=${notLayingHen},breedingPartner=${breedingPartner},crowAnimReady=${crowAnimReady},crowed=${crowed}(claimed=${claimed},state=${r.state})`;
      }
    } catch (e) { rooster = 'threw: ' + String(e); }

    // #266 foxes: the fox roster starts EMPTY (no default fox). Dropping fox food summons
    // a WILD fox (onFoodPlaced), and repeated feeding TAMES it into the roster (capped at 1).
    // We drive the pure/commit path deterministically (the wild-fox animation uses timers):
    //   - onFoodPlaced('foxFood') must create a wild-fox sprite while untamed.
    //   - _commitFox must add a `fox0` Fox to allFoxes + spawn a fox sprite in the scene.
    //   - a SECOND commit is capped (still exactly one fox — no duplicate join).
    //   - a hungry roster fox with a fox-food pile in reach must select its seek behavior.
    let fox = 'ok';
    try {
      const startedEmpty = Object.keys(g.registry.get('allFoxes') ?? {}).length === 0;
      // Untamed: dropping fox food summons a wild fox (a loose sprite, not a roster animal).
      paddock.onFoodPlaced('foxFood', 340, 400);
      const wildSummoned = !!paddock._wildFox?.sprite?.active;
      // Commit it to the roster (the taming payoff).
      paddock._commitFox(paddock._wildFox, 340, 400);
      const roster = g.registry.get('allFoxes') ?? {};
      const joined = Object.keys(roster).length === 1 && roster.fox0?.species === 'fox';
      const foxInScene = paddock.animals.filter((a) => a.model?.species === 'fox').length;
      // Capped: onFoodPlaced no longer summons once tamed, and a 2nd commit is a no-op.
      paddock.onFoodPlaced('foxFood', 340, 400);
      const noResummon = !paddock._wildFox; // already tamed → no new wild fox
      paddock._commitFox(null, 340, 400);
      const stillOne = Object.keys(g.registry.get('allFoxes') ?? {}).length === 1;
      // The tamed fox seeks a fox-food pile when hungry (grazing dispatch claims it).
      let seeks = false;
      const foxA = paddock.animals.find((a) => a.model?.species === 'fox');
      if (foxA) {
        foxA.model.stats.hunger = 20;
        paddock.props.hayPiles.push({ x: foxA.sprite.x + 20, y: foxA.sprite.y, sprite: { destroy() {} }, content: 'foxFood' });
        foxA.state = 'idle';
        const claimed = paddock.runBehaviors(foxA);
        seeks = claimed && foxA.state === 'eating';
        paddock.props.hayPiles = [];
      }
      fox = (startedEmpty && wildSummoned && joined && foxInScene === 1 && noResummon && stillOne && seeks)
        ? 'tamed-and-capped'
        : `startedEmpty=${startedEmpty},wildSummoned=${wildSummoned},joined=${joined},foxInScene=${foxInScene},noResummon=${noResummon},stillOne=${stillOne},seeks=${seeks}`;
    } catch (e) { fox = 'threw: ' + String(e); }

    // #187 charm behaviors: the night settle/wake cycle must round-trip without
    // throwing (it rewires restAllAnimals/wakeAllAnimals), and the new run primitives
    // must resolve. Probed last (it mutates animal state) and lenient — this proves
    // the wiring holds; the actual "aww" feel is for the owner to watch in-game.
    let charm = 'ok';
    try {
      paddock.restAllAnimals();   // bed everyone down (settle/curl/roost paths)
      paddock.wakeAllAnimals();   // …and wake them back up (un-settle/un-curl)
      const dog   = paddock.animals.find((a) => a.model?.species === 'dog');
      const chick = paddock.animals.find((a) => a.key.startsWith('chicken'));
      const pig   = paddock.animals.find((a) => a.model?.species === 'pig');
      if (dog)   paddock.dogGoHerd(dog);          // no-op/returns false if no sheep near
      if (chick) paddock.chickenScatterFrom(chick);
      if (pig)   { pig.state = 'idle'; paddock._maybePigNap(pig); }
      const wired = ['dogGoHerd', 'chickenScatterFrom', 'catCurlUp', '_maybePigNap',
        '_settleAnimalForNight', '_charmNap'].every((m) => typeof paddock[m] === 'function');
      charm = wired ? 'wired' : 'missing-methods';
    } catch (e) { charm = 'threw: ' + String(e); }

    // #271 ambient nocturnal owl: present at night, absent by day. Owls are scenery
    // (no roster) — probe the scene mixin directly. Textures must exist; a direct
    // _spawnOwl at night puts an owl into _owls; and the pure night gate must reject
    // daytime. We drive _phase directly (the day/night cycle owns it in play).
    let owl = 'no owl mixin';
    try {
      const owlTex = ['owl_perched_0', 'owl_perched_1', 'owl_glide_0', 'owl_glide_1']
        .every((k) => g.textures.exists(k));
      // Clear any owl left from real gameplay so the count is deterministic.
      (paddock._owls ?? []).slice().forEach((c) => paddock._despawnOwl(c));
      const savedPhase = paddock._phase, savedSleeping = paddock._sleeping;
      paddock._sleeping = false;

      // Night: a spawn should produce exactly one owl in flight.
      paddock._phase = 'Night';
      paddock._spawnOwl();
      const spawnedAtNight = (paddock._owls?.length ?? 0) === 1;
      // A second spawn while one's already out is a no-op (one owl at a time).
      paddock._spawnOwl();
      const oneAtATime = (paddock._owls?.length ?? 0) === 1;
      // Clean it up. (The pure night/day/asleep gate is unit-tested in data/owls.test.js;
      // here we just prove the runtime spawn wiring resolves and the owl appears.)
      (paddock._owls ?? []).slice().forEach((c) => paddock._despawnOwl(c));
      const despawned = (paddock._owls?.length ?? 0) === 0;

      paddock._phase = savedPhase; paddock._sleeping = savedSleeping;
      owl = (owlTex && spawnedAtNight && oneAtATime && despawned)
        ? 'night-only'
        : `owlTex=${owlTex},spawnedAtNight=${spawnedAtNight},oneAtATime=${oneAtATime},despawned=${despawned}`;
    } catch (e) { owl = 'threw: ' + String(e); }

    return {
      owl,
      charm,
      rooster,
      roosterCount: Object.keys(g.registry.get('allRoosters') ?? {}).length,
      roostersInScene: paddock.animals.filter((a) => a.model?.species === 'rooster').length,
      fox,
      catBowls,
      seedFeeder,
      nectarFeeder,
      beehive,
      cowMilk,
      goatMilk,
      goatCount: Object.keys(g.registry.get('allGoats') ?? {}).length,
      goatsInScene: paddock.animals.filter((a) => a.model?.species === 'goat').length,
      pigDiet,
      pigCount: Object.keys(g.registry.get('allPigs') ?? {}).length,
      pigsInScene: paddock.animals.filter((a) => a.model?.species === 'pig').length,
      sheepCount: Object.keys(g.registry.get('allSheep') ?? {}).length,
      sheepInScene: paddock.animals.filter((a) => a.model?.species === 'sheep').length,
      dogCount: Object.keys(g.registry.get('allDogs') ?? {}).length,
      dogsInScene: paddock.animals.filter((a) => a.model?.species === 'dog').length,
      renderer: g.config.renderType, // 1=Canvas, 2=WebGL
      movementOk, movementError,
      behaviorDecision,
      gatherTargets,
      horseCount: Object.keys(horses).length,
      chickenCount: Object.keys(chickens).length,
      sampleHorse: { name: h.name, species: h.species, hasMood: typeof h.mood === 'function' },
      activeScenes: g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
      feedDelta,
      missingMethods,
      horsesInScene: paddock.horses?.length ?? 0,
      hasFarmStand: !!paddock.farmStand,
      hasBirdBath: !!paddock.props.birdBath, // #219 decorative bird bath world object
      hasSeedFeeder: !!paddock.props.seedFeeder, // #240 refillable seed feeder
      hasNectarFeeder: !!paddock.props.nectarFeeder, // #226 hummingbird nectar feeder
      hasBeehive: !!paddock.props.beehive, // #239 beehive world object
      // Display scales: every animal is now super-sampled (ART_SCALE× art shown at
      // S/ART_SCALE), so the chicken and horse share the same base display scale. Guard
      // that ratio ≈ 1 — it jumps to ART_SCALE if a species' `superSampled` spawn flag
      // gets dropped (the chicken would render 1× at full S, i.e. 4× too big).
      scaleRatio: (paddock.animals.find((a) => a.key.startsWith('chicken'))?.sprite?.scaleX ?? 0)
                / (paddock.horses[0]?.sprite?.scaleX ?? 1),
    };
  });

  await page.screenshot({ path: '/tmp/horsegame-smoke.png' });

  // Unified info panel: open it for a horse (identity + stat bars) and a
  // chicken (identity only) — both go through the single InfoPanelScene. The
  // panel is purely informational (no action buttons; care is done in-world).
  const openPanel = async (kind, key) => {
    await page.evaluate(([k, key]) => {
      const p = window.__game.scene.getScene('PaddockScene');
      if (window.__game.scene.isActive('InfoPanelScene')) window.__game.scene.stop('InfoPanelScene');
      if (k === 'horse') p.openPortrait(key); else p.openChickenInfo(key);
    }, [kind, key]);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const s = window.__game.scene.getScene('InfoPanelScene');
      return { active: window.__game.scene.isActive('InfoPanelScene'), parts: s?.panel?.length ?? 0 };
    });
  };

  const horsePanel = await openPanel('horse', 'horse');
  await page.screenshot({ path: '/tmp/panel-horse.png' });
  const chickenPanel = await openPanel('chicken', 'chicken0');
  await page.screenshot({ path: '/tmp/panel-chicken.png' });
  result.horsePanel = horsePanel;
  result.chickenPanel = chickenPanel;

  // Appearance editor (#147): the per-horse info panel opens a sticky in-world
  // editor; applying a coat colour re-skins live and persists. Guards that the
  // ManagementPanelScene removal didn't break the relocated customizer, and that
  // edit mode pauses/restores the world cleanly.
  result.editor = await page.evaluate(async () => {
    const g = window.__game;
    const p = g.scene.getScene('PaddockScene');
    if (g.scene.isActive('InfoPanelScene')) g.scene.stop('InfoPanelScene');
    p.openPortrait('horse2');
    await new Promise((r) => setTimeout(r, 300));
    const info = g.scene.getScene('InfoPanelScene');
    info._enterEdit();
    await new Promise((r) => setTimeout(r, 60));
    const opened = info._mode === 'edit' && !!info.contentC;
    const focusCount = info._focusables.length;
    const paused = g.scene.isPaused('PaddockScene');
    info._pickColor('grey');
    const coat = g.registry.get('allHorses').horse2.coat;

    // Regression guard: a live re-skin must actually CHANGE the texture pixels — gen()
    // redraws the frame in place, so two clearly-different coats must yield two different
    // frame textures (catches a re-skin that silently keeps the old pixels).
    const sig = () => {
      const src = g.textures.get('horse2_idle_0').getSourceImage();
      const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
      let s = 0; for (let i = 0; i < d.length; i += 521) s = (s * 31 + d[i]) >>> 0; // sparse hash
      return s;
    };
    info._pickColor('black');    const sigBlack = sig();
    info._pickColor('palomino'); const sigPalomino = sig();

    info.custExit();
    await new Promise((r) => setTimeout(r, 60));
    return {
      opened, focusCount, paused, coat,
      reskinPixelsChanged: sigBlack !== sigPalomino,
      resumed: !g.scene.isPaused('PaddockScene') && info._mode === 'info',
      noStable: !g.scene.getScene('ManagementPanelScene'),
    };
  });
  await page.screenshot({ path: '/tmp/panel-editor.png' });

  // Player character customizer (#44): the player sprite must build from the saved look
  // on boot (player_down_0 exists), and the pause-menu editor must open, recolour/reshape
  // live, and PERSIST the look-keys to localStorage. Reuses the generic customizer shell.
  result.playerCustomizer = await page.evaluate(async () => {
    const g = window.__game;
    const hasTexture = g.textures.exists('player_down_0');
    const registered = !!g.scene.getScene('PlayerCustomizerScene');
    g.scene.getScene('PaddockScene').scene.launch('PlayerCustomizerScene'); // as the pause-menu button does
    await new Promise((r) => setTimeout(r, 300));
    const sc = g.scene.getScene('PlayerCustomizerScene');
    const opened = sc?._mode === 'edit' && !!sc.contentC;
    const focusCount = sc?._focusables?.length ?? 0;
    const paused = g.scene.isPaused('PaddockScene');
    // Apply a colour swatch + two shape options through the same handler the UI calls.
    sc._pickPartSwatch('hair', 'black');
    sc._pickPartSwatch('bottom', 'skirt');
    sc._pickPartSwatch('sleeves', 'none');
    const saved = JSON.parse(localStorage.getItem('horse-game-player-v1') || '{}');
    sc.custExit();
    await new Promise((r) => setTimeout(r, 60));
    return {
      hasTexture, registered, opened, focusCount, paused,
      saved: { hair: saved.hair, bottom: saved.bottom, sleeves: saved.sleeves },
      resumed: !g.scene.isPaused('PaddockScene') && !g.scene.isActive('PlayerCustomizerScene'),
    };
  });
  await page.screenshot({ path: '/tmp/player-customizer.png' });

  // Weather pass (#188): force the DayNightScene into rain and back, and assert the
  // paddock's hooks respond — the WEATHER_CHANGE event lands, _weather tracks it,
  // rain dirties a horse faster (2×), the wildlife rain-gate closes, and rain
  // partially (never fully) fills the trough. All renderer-agnostic logic.
  const weather = await page.evaluate(async () => {
    const g = window.__game;
    const dn = g.scene.getScene('DayNightScene');
    const p  = g.scene.getScene('PaddockScene');
    const trough = p.props.trough;

    // Baseline: force sun, set the trough empty, groom a horse fully.
    dn._setWeather('sun', true);
    await new Promise((r) => setTimeout(r, 20));
    p._setTroughLevel(0);
    const horse = g.registry.get('allHorses').horse;
    horse.stats.grooming = 100;

    // Dirt in the sun (x1).
    p._dirtyHorse('horse', 10);
    const sunLoss = 100 - horse.stats.grooming;

    // Switch to rain.
    dn._setWeather('rain', true);
    await new Promise((r) => setTimeout(r, 20));
    const paddockSawRain = p._weather === 'rain';
    const wildlifeGate = p._weatherAllowsWildlife(); // should be false in rain

    // Dirt in the rain (should be > sunLoss) — same +10 action.
    horse.stats.grooming = 100;
    p._dirtyHorse('horse', 10);
    const rainLoss = 100 - horse.stats.grooming;

    // Rain trough fill: run several ticks manually; it must add water but stop
    // below full capacity (partial fill so the bucket loop still matters).
    p._startRainTroughFill();
    for (let i = 0; i < 20; i++) {
      const { rainTroughFill } = await import('/src/data/weather.js');
      const add = rainTroughFill(trough.level, 9);
      if (add > 0) p._setTroughLevel(trough.level + add);
    }
    const rainTroughLevel = trough.level;
    p._stopRainTroughFill();

    // Restore sun so nothing else in the run is surprised.
    dn._setWeather('sun', true);

    return { paddockSawRain, wildlifeGate, sunLoss, rainLoss, rainTroughLevel };
  });
  result.weather = weather;

  console.log(JSON.stringify(result, null, 2));

  const wx = result.weather;
  if (!wx.paddockSawRain) fail('WEATHER_CHANGE not received by PaddockScene (weather event not wired)');
  if (wx.wildlifeGate !== false) fail('wildlife rain-gate did not close in rain (_weatherAllowsWildlife true while raining)');
  if (!(wx.rainLoss > wx.sunLoss)) fail(`rain did not dirty faster (sunLoss=${wx.sunLoss}, rainLoss=${wx.rainLoss})`);
  if (wx.rainLoss !== wx.sunLoss * 2) fail(`rain dirt multiplier ≠ 2 (sunLoss=${wx.sunLoss}, rainLoss=${wx.rainLoss})`);
  if (!(wx.rainTroughLevel > 0)) fail('rain did not fill the trough at all');
  if (wx.rainTroughLevel >= 9) fail(`rain filled the trough to ${wx.rainTroughLevel}/9 — should be PARTIAL, not full (bucket loop undercut)`);

  if (pageErrors.length) fail('uncaught page errors:\n' + pageErrors.join('\n'));
  if (consoleErrors.length) fail('console errors:\n' + consoleErrors.join('\n'));
  if (result.horseCount !== 7) fail(`expected 7 horses, got ${result.horseCount}`);
  if (result.chickenCount !== 5) fail(`expected 5 chickens, got ${result.chickenCount}`);
  if (result.feedDelta !== 35) fail(`care action applied ${result.feedDelta}, expected 35 (double-apply regression?)`);
  if (!result.sampleHorse.hasMood) fail('horse missing mood() — model not wired');
  if (result.missingMethods.length) fail('PaddockScene missing methods (mixin not wired?): ' + result.missingMethods.join(', '));
  if (result.horsesInScene !== 7) fail(`expected 7 horse sprites in scene, got ${result.horsesInScene}`);
  if (!result.hasFarmStand) fail('farm stand not built — farmStand mixin not wired');
  if (!result.hasBirdBath) fail('bird bath (#219) not built — world.js props.birdBath missing');
  if (!result.hasSeedFeeder) fail('seed feeder (#240) not built — props.seedFeeder missing');
  if (!result.hasNectarFeeder) fail('nectar feeder (#226) not built — props.nectarFeeder missing');
  if (!result.hasBeehive) fail('beehive (#239) not built — props.beehive missing');
  if (Math.abs(result.scaleRatio - 1) > 0.01) fail(`chicken/horse display-scale ratio ${result.scaleRatio} ≠ 1 — a species' superSampled spawn flag may be missing (chicken rendered 4× too big)?`);
  if (!result.movementOk) fail('creature movement/pathfinding threw: ' + result.movementError);
  if (result.behaviorDecision !== 'seekFood') fail(`hungry horse with hay nearby did not select seekFood (got ${result.behaviorDecision})`);
  // #136: gather one food per animal that eats it, water → capacity. Diets differ:
  // hay feeds the 7 horses + the cow + the 1 sheep + the goat + the 2 llamas (12);
  // apples/carrots feed the pig + goat but NOT the sheep/llamas, who refuse them (10).
  // The goat eats EVERYTHING (#267), so she's on every food's demand; llamas (#268) eat
  // hay only. The split is the proof the pig/sheep/llama pickier diets are wired up.
  // (Probed with a high capacity so demand isn't capped.)
  const gt = result.gatherTargets;
  if (gt.hay !== 12) fail(`gather target for hay = ${gt.hay}, expected 12 (7 horses + 1 cow + 1 sheep + 1 goat + 2 llamas)`);
  for (const food of ['apple', 'carrot']) {
    if (gt[food] !== 10) fail(`gather target for ${food} = ${gt[food]}, expected 10 (7 horses + 1 cow + 1 pig + 1 goat; sheep refuse them, #136)`);
  }
  if (gt.seed !== 6) fail(`gather target for seed = ${gt.seed}, expected 6 (5 chickens + 1 goat, who eats everything #267)`);
  if (gt.water !== 1) fail(`gather target for water = ${gt.water}, expected 1 (capacity — water ignores demand)`);
  if (result.cowMilk !== 'milked-once') fail(`cow generic produce path failed (got ${result.cowMilk}) — #167 B3 unified care`);
  // #187 charm behaviors: night settle/wake cycle + charm run primitives must hold.
  if (result.charm !== 'wired') fail(`charm behaviors (#187) failed: ${result.charm}`);
  // #271 ambient owl: night-only glide-in, one at a time, absent by day/asleep.
  if (result.owl !== 'night-only') fail(`ambient owl (#271) failed: ${result.owl}`);
  // Rooster (#269): spawned as a flock bird, doesn't lay, is a breeding partner, crows at dawn.
  if (result.roosterCount !== 1) fail(`expected 1 rooster in roster, got ${result.roosterCount}`);
  if (result.roostersInScene !== 1) fail(`expected 1 rooster sprite in scene, got ${result.roostersInScene}`);
  if (result.rooster !== 'crows-at-dawn') fail(`rooster (#269) failed: ${result.rooster}`);
  // #266 foxes: wild fox summons on fox food, tames into the roster once, capped, then seeks.
  if (result.fox !== 'tamed-and-capped') fail(`fox taming (#266) failed: ${result.fox}`);
  // #202 rework: the cat eats directly from a stocked bowl (not dropped piles).
  if (result.catBowls !== 'eats-from-bowl') fail(`cat bowl feeding (#202) failed: ${result.catBowls}`);
  if (result.seedFeeder !== 'fills-and-drains') fail(`seed feeder fill/drain (#240) failed: ${result.seedFeeder}`);
  if (result.nectarFeeder !== 'fills-and-drains') fail(`nectar feeder fill/drain (#226) failed: ${result.nectarFeeder}`);
  if (result.beehive !== 'ripens-and-harvests') fail(`beehive honey (#239) failed: ${result.beehive}`);
  // The pig: it spawned into the world and eats apples but not hay.
  if (result.pigCount !== 1) fail(`expected 1 pig in roster, got ${result.pigCount}`);
  if (result.pigsInScene !== 1) fail(`expected 1 pig sprite in scene, got ${result.pigsInScene}`);
  if (result.pigDiet !== 'apples-not-hay') fail(`pig diet wrong (got ${result.pigDiet}) — should ignore hay, seek apples`);
  // The sheep flock (#184) + the dog (#185): both spawned from data-driven rosters.
  if (result.sheepCount !== 1) fail(`expected 1 sheep in roster, got ${result.sheepCount}`);
  if (result.sheepInScene !== 1) fail(`expected 1 sheep sprite in scene, got ${result.sheepInScene}`);
  if (result.dogCount !== 1) fail(`expected 1 dog in roster, got ${result.dogCount}`);
  if (result.dogsInScene !== 1) fail(`expected 1 dog sprite in scene, got ${result.dogsInScene}`);
  // The goat (#267): spawns into the world and is milkable via the shared produce path.
  if (result.goatCount !== 1) fail(`expected 1 goat in roster, got ${result.goatCount}`);
  if (result.goatsInScene !== 1) fail(`expected 1 goat sprite in scene, got ${result.goatsInScene}`);
  if (result.goatMilk !== 'milked-once') fail(`goat generic produce path failed (got ${result.goatMilk}) — #267 milkable`);
  if (!result.horsePanel.active) fail('InfoPanelScene did not open for a horse');
  if (result.horsePanel.parts < 15) fail(`horse panel looks too sparse (parts=${result.horsePanel.parts}) — identity/stat bars missing?`);
  if (!result.chickenPanel.active) fail('InfoPanelScene did not open for a chicken');
  if (!result.editor.opened) fail('appearance editor did not open from the info panel');
  if (result.editor.focusCount < 20) fail(`editor registered too few focusables (${result.editor.focusCount})`);
  if (!result.editor.paused) fail('world was not paused while editing');
  if (result.editor.coat !== 'grey') fail(`coat edit did not apply (got ${result.editor.coat})`);
  if (!result.editor.reskinPixelsChanged) fail('re-skin did not change texture pixels (gen() redraw not taking effect?)');
  if (!result.editor.resumed) fail('world/info not restored after closing the editor');
  if (!result.editor.noStable) fail('ManagementPanelScene still registered (should be removed)');
  // Player customizer (#44).
  const pc = result.playerCustomizer;
  if (!pc.hasTexture) fail('player_down_0 texture missing after boot (player art not built from look)');
  if (!pc.registered) fail('PlayerCustomizerScene not registered');
  if (!pc.opened) fail('player customizer did not open');
  if (pc.focusCount < 20) fail(`player customizer registered too few focusables (${pc.focusCount})`);
  if (!pc.paused) fail('world was not paused while editing the player');
  if (pc.saved.hair !== 'black' || pc.saved.bottom !== 'skirt' || pc.saved.sleeves !== 'none') {
    fail(`player look not persisted (got ${JSON.stringify(pc.saved)})`);
  }
  if (!pc.resumed) fail('world not restored / player customizer not closed after exit');

  // ── HiDPI rendering: the game must render at the device's PHYSICAL pixels so
  // pixel-art/text are crisp on Retina screens (e.g. iPad, devicePixelRatio 2).
  // The main boot above runs at deviceScaleFactor 1, where the DPR path is a no-op
  // (so the assertions above guard there's no regression). Here we boot a second
  // context at deviceScaleFactor 2 — the iPad's ratio — and assert the canvas
  // backing store is 2× the CSS size and the camera zoom compensates (so on-screen
  // size is unchanged). fps is captured at both ratios for a real perf number.
  const probeFps = async (pg) => {
    await pg.waitForTimeout(1200); // let the loop settle
    return pg.evaluate(() => Math.round(window.__game.loop.actualFps));
  };
  const dpr1Fps = await probeFps(page);

  const hctx  = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1024, height: 768 } });
  const hpage = await hctx.newPage();
  const hErrors = [];
  hpage.on('pageerror', (e) => hErrors.push(String(e)));
  hpage.on('console', (m) => { if (m.type() === 'error') hErrors.push(m.text()); });
  await hpage.goto(URL, { waitUntil: 'load', timeout: 20000 });
  await hpage.waitForFunction(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.isActive('PaddockScene') && g.registry.get('allHorses'));
  }, { timeout: 20000 });
  const hidpi = await hpage.evaluate(() => {
    const g = window.__game, c = g.canvas;
    const worldCam = g.scene.getScene('PaddockScene').cameras.main;
    // UI scenes must anchor the zoom at the top-left (0,0), else their screen-fixed UI
    // is pushed off-screen. The WORLD scene must instead keep the default CENTRED
    // origin AND a follow target — a top-left origin silently breaks startFollow (the
    // player ends up off-map / not followed). Both regressions slipped past the
    // size/zoom checks before, so assert them directly.
    const uiBadOrigins = ['HotbarScene', 'InfoPanelScene', 'DayNightScene']
      .filter((k) => g.scene.isActive(k))
      .filter((k) => { const cam = g.scene.getScene(k).cameras.main; return cam.originX !== 0 || cam.originY !== 0; });
    return {
      dpr: g.registry.get('dpr'),
      canvasW: c.width, cssW: parseInt(c.style.width, 10),
      cameraZoom: worldCam.zoom,
      worldFollows: !!worldCam._follow && worldCam.originX === 0.5 && worldCam.originY === 0.5,
      uiBadOrigins,
      devicePixelRatio: window.devicePixelRatio,
    };
  });
  const dpr2Fps = await probeFps(hpage);
  await hpage.screenshot({ path: '/tmp/horsegame-smoke-hidpi.png' });
  await hctx.close();

  console.log('HiDPI probe:', JSON.stringify({ ...hidpi, dpr1Fps, dpr2Fps }, null, 2));

  if (hidpi.dpr !== 2) fail(`HiDPI: expected registry dpr 2, got ${hidpi.dpr}`);
  if (Math.abs(hidpi.canvasW - hidpi.cssW * 2) > 2) fail(`HiDPI: canvas buffer ${hidpi.canvasW}px is not ~2× the CSS width ${hidpi.cssW}px (not rendering at physical pixels)`);
  if (hidpi.cameraZoom !== 2) fail(`HiDPI: PaddockScene camera zoom is ${hidpi.cameraZoom}, expected 2 (on-screen size would change)`);
  if (!hidpi.worldFollows) fail('HiDPI: world camera lost its centred origin + follow (off-map / player-not-followed regression)');
  if (hidpi.uiBadOrigins.length) fail(`HiDPI: UI camera origin not top-left on: ${hidpi.uiBadOrigins.join(', ')} (UI would render off-screen)`);
  if (hErrors.length) fail('HiDPI (DPR 2) boot errors:\n' + hErrors.join('\n'));

  if (!process.exitCode) console.log(`SMOKE OK ✔  (fps: DPR1=${dpr1Fps} DPR2=${dpr2Fps}; screenshots: /tmp/horsegame-smoke.png, /tmp/horsegame-smoke-hidpi.png)`);
} catch (e) {
  fail(e.message + (pageErrors.length ? '\npageErrors:\n' + pageErrors.join('\n') : ''));
} finally {
  await browser.close();
}
