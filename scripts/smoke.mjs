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
import { STAND_DEFS } from '../src/scenes/paddock/constants.js';

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
page.on('pageerror', (e) => pageErrors.push(e.stack || String(e))); // keep the stack — it's what pinpointed the foal swish-anim crash (#15)
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 20000 });

  // Wait for the game, the PaddockScene, and the loaded herd to all be ready.
  await page.waitForFunction(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.getScene('PaddockScene') &&
              g.scene.isActive('PaddockScene') && g.registry.get('allHorses'));
  }, { timeout: 20000 });

  const result = await page.evaluate(async (STAND_DEFS) => {
    const g = window.__game;
    const horses = g.registry.get('allHorses');
    const chickens = g.registry.get('allChickens');
    const h = horses['horse'];
    // Pristine herd counts captured BEFORE the breeding probe below births a foal
    // (which grows allHorses), so the "expected 7" boot assertions stay meaningful.
    const pristineHorseCount = Object.keys(horses).length;
    const pristineHorsesInScene = g.scene.getScene('PaddockScene').horses?.length ?? 0;
    // Same reasoning for chickens: the #274 incubation probe below hatches a chick
    // into the SAME allChickens object (mutated in place, not replaced), so snapshot
    // the pristine count now, before that probe runs.
    const pristineChickenCount = Object.keys(chickens).length;

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
      'buildWorld', 'buildObstacles', 'buildFarmStand', '_npcShop', 'stockStand', 'processCrop', 'buildKitchenCounter',
      // Neighbor NPC (#294): periodic visits, trading & gift-based relationship score.
      'buildNeighbor', '_scheduleNextNeighbor', '_spawnNeighbor', 'neighborTradeOffer',
      'tradeWithNeighbor', 'giftNeighborWithActiveItem', '_neighborLeave',
      'buildPlayer', 'movePlayer', 'handleTap', '_findPath', 'gatherFrom',
      'mountHorse', 'dismount', 'toggleSaddle', 'toggleLead',
      'horseTick', 'horseGoEat', 'horseGoDrink', 'spawnHorse', 'spawnAnimal',
      'buildAnimals', '_worldSpecies', '_applySpawnCapabilities', // generic spawn (#167 B4)
      'separateHorses', '_horseBeg', '_begWait',
      // Cross-animal charm behaviors (#187): dog↔sheep, chicken scatter, pig nap,
      // night settle/curl, head-to-tail swat.
      'dogGoHerd', '_sheepBunch', 'chickenScatterFrom', '_maybePigNap', '_charmNap',
      '_settleAnimalForNight', 'catCurlUp', '_restAnimalInPlace', '_dogContext', '_charmTailSwish',
      // Generic stream-swim charm (#231): any `swims`-capability species (the dog for now).
      'animalGoSwim', '_nearestSwimSpot',
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
      // shears (#254): shear fleecy animals into the tool's own wool load + trim horses.
      '_nearestShearAnimal', '_nearestTrimHorse', 'shearWithTool', 'dumpShearsWool',
      // wildlife: ambient bird beats incl. the bird-bath splash (#219) + feeder (#240).
      'buildWildlife', 'updateWildlife', '_scheduleBirdBathVisit', '_spawnBirdBathVisit',
      '_scheduleFeederVisit', '_spawnFeederVisit',
      // owls: ambient nocturnal owl (#271) — night-only glide-in/hoot/glide-off.
      'buildOwls', '_scheduleOwlVisit', '_spawnOwl', '_owlHootLoop', '_owlGlideOff', '_despawnOwl',
      // birdEcosystem: fixed bird props + feeder fill/drain (#219/#240) + hummingbirds (#226).
      'buildBirdEcosystem', 'buildBirdBath', 'buildSeedFeeder', 'buildNectarFeeder',
      'fillSeedFeeder', '_setSeedFeederLevel', 'drainSeedFeeder',
      'fillNectarFeeder', '_setNectarFeederLevel', 'drainNectarFeeder',
      // birdhouse (#218): decorative post-mounted nesting box, ambient bird attractor.
      'buildBirdhouse',
      // birdEcosystemVisits: the object-anchored flying-critter visit beats.
      'startBirdEcosystemVisits', '_scheduleHummingbirdVisit', '_spawnHummingbird', '_hummerTargets',
      '_scheduleBeeVisit', '_spawnBeeVisit', '_beeTargets',
      '_scheduleBirdhouseVisit', '_spawnBirdhouseVisit', '_birdhouseLook',
      // beehive + honey (#239).
      'buildBeehive', '_setHoneyLevel', '_ripenHoneyTick', 'harvestBeehive',
      // fox taming (#266): wild-fox summon on fox-food drop + commit-to-roster.
      'buildFox', 'onFoxFoodPlaced', '_lureWildFox', '_feedWildFox', '_commitFox', '_foxRosterFull',
      // duck taming + swim (#275): wild-duck summon on duck-food drop + commit-to-roster.
      'buildDuck', 'onDuckFoodPlaced', '_lureWildDuck', '_feedWildDuck', '_commitDuck', '_duckRosterFull',
      // breeding & foals (#15, redesigned #114): permanent pair-bond, then a
      // separate repeatable "Breed" action starts a gestation → birth, roster
      // growth, grow-up gate. #299: births are held at gestation-complete and only
      // revealed at wake-up.
      'buildBreeding', 'beginBreeding', 'updateBreeding', '_birthFoal', 'growUpFoal',
      'setStayBaby', 'spawnSavedFoals', 'toggleBondSelection', 'formPairBond',
      'startBreeding', 'isBonded', 'bondMateKey',
      'flushReadyBirths', '_announceOvernightBirths',
      // baby chicks (#274): rooster-gated incubation, hatch, roster growth, grow-up gate.
      // Its own parallel system (data/species/chicken/incubation.js + this mixin) —
      // never touches the horse breeding files above.
      'buildIncubation', 'startIncubation', 'updateIncubation', '_hatchChick', 'growUpChick',
      'setChickStayBaby', '_hasBreedingRooster', '_isIncubating',
      // chicken coop cutaway (#53): mirrors the barn's walk-in pattern but purely
      // visual — roost spots + façade fade, reusing the existing roost/leave-coop flow.
      'buildChickenCoop', 'updateCoopCutaway', '_coopRoostSpotFor',
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
    // a WILD fox (onFoxFoodPlaced), and repeated feeding TAMES it into the roster (capped
    // at 1). We drive the pure/commit path deterministically (the wild-fox animation uses
    // timers):
    //   - onFoxFoodPlaced('foxFood') must create a wild-fox sprite while untamed.
    //   - _commitFox must add a `fox0` Fox to allFoxes + spawn a fox sprite in the scene.
    //   - a SECOND commit is capped (still exactly one fox — no duplicate join).
    //   - a hungry roster fox with a fox-food pile in reach must select its seek behavior.
    let fox = 'ok';
    try {
      const startedEmpty = Object.keys(g.registry.get('allFoxes') ?? {}).length === 0;
      // Untamed: dropping fox food summons a wild fox (a loose sprite, not a roster animal).
      paddock.onFoxFoodPlaced('foxFood', 340, 400);
      const wildSummoned = !!paddock._wildFox?.sprite?.active;
      // Commit it to the roster (the taming payoff).
      paddock._commitFox(paddock._wildFox, 340, 400);
      const roster = g.registry.get('allFoxes') ?? {};
      const joined = Object.keys(roster).length === 1 && roster.fox0?.species === 'fox';
      const foxInScene = paddock.animals.filter((a) => a.model?.species === 'fox').length;
      // Capped: onFoxFoodPlaced no longer summons once tamed, and a 2nd commit is a no-op.
      paddock.onFoxFoodPlaced('foxFood', 340, 400);
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

    // #275 ducks: the duck roster starts EMPTY (no default duck), mirroring the fox.
    // Dropping duck food near the stream summons a WILD duck (onDuckFoodPlaced), and
    // repeated feeding TAMES it into the roster (capped at 1). Once tamed it also SWIMS
    // via the generic `swims` capability (species/swim.js, #231) — we drive
    // `animalGoSwim` directly to assert the swim-eligible dispatch claims the duck and
    // its dedicated swim_0/1 art frames exist.
    let duck = 'ok';
    try {
      const startedEmpty = Object.keys(g.registry.get('allDucks') ?? {}).length === 0;
      // Untamed: dropping duck food near the stream summons a wild duck.
      paddock.onDuckFoodPlaced('duckFood', 1650, 330);
      const wildSummoned = !!paddock._wildDuck?.sprite?.active;
      // Commit it to the roster (the taming payoff).
      paddock._commitDuck(paddock._wildDuck, 1650, 330);
      const roster = g.registry.get('allDucks') ?? {};
      const joined = Object.keys(roster).length === 1 && roster.duck0?.species === 'duck';
      const duckInScene = paddock.animals.filter((a) => a.model?.species === 'duck').length;
      // Capped: onDuckFoodPlaced no longer summons once tamed, and a 2nd commit is a no-op.
      paddock.onDuckFoodPlaced('duckFood', 1650, 330);
      const noResummon = !paddock._wildDuck; // already tamed → no new wild duck
      paddock._commitDuck(null, 1650, 330);
      const stillOne = Object.keys(g.registry.get('allDucks') ?? {}).length === 1;
      // The tamed duck seeks a duck-food pile when hungry (grazing dispatch claims it).
      let seeks = false, swims = false, hasSwimFrames = false;
      const duckA = paddock.animals.find((a) => a.model?.species === 'duck');
      if (duckA) {
        duckA.model.stats.hunger = 20;
        paddock.props.hayPiles.push({ x: duckA.sprite.x + 20, y: duckA.sprite.y, sprite: { destroy() {} }, content: 'duckFood' });
        duckA.state = 'idle';
        const claimed = paddock.runBehaviors(duckA);
        seeks = claimed && duckA.state === 'eating';
        paddock.props.hayPiles = [];
        // Swim: the duck's `swims` capability wires the generic swim primitive
        // (charm.js animalGoSwim) — drive it directly (bypassing the random-chance
        // gate) to assert it claims the duck and its dedicated frames exist.
        duckA.state = 'idle';
        hasSwimFrames = g.textures.exists(`${duckA.key}_swim_0`) && g.textures.exists(`${duckA.key}_swim_1`);
        swims = paddock.animalGoSwim(duckA) && duckA.state === 'swimming';
      }
      duck = (startedEmpty && wildSummoned && joined && duckInScene === 1 && noResummon && stillOne && seeks && swims && hasSwimFrames)
        ? 'tamed-and-swims'
        : `startedEmpty=${startedEmpty},wildSummoned=${wildSummoned},joined=${joined},duckInScene=${duckInScene},noResummon=${noResummon},stillOne=${stillOne},seeks=${seeks},swims=${swims},hasSwimFrames=${hasSwimFrames}`;
    } catch (e) { duck = 'threw: ' + String(e); }
    // #254 shears (multi-use tool): equip the shears, shear a ready sheep → +1 wool in
    // the shears' OWN load (not a basket) and the sheep flips shorn/not-ready; then dump
    // the shears' wool into the farm stand's wool stock (the scooper-style dump). Also
    // the secondary "trim a horse" job routes through the brush grooming path.
    let shears = 'no sheep';
    try {
      const hot = g.scene.getScene('HotbarScene');
      const sheep = paddock.animals.find((a) => a.model?.species === 'sheep');
      if (sheep && typeof paddock.shearWithTool === 'function') {
        hot.activeSlot = hot.hotbar.indexOf('shears');
        hot._shearsLoad = 0;
        sheep.model.lastProducedAt = 0; // force "fully regrown" → ready to shear
        const readyBefore = sheep.model.canProduce();
        paddock.shearWithTool(sheep);
        const loadedOne = (hot._shearsLoad ?? 0) === 1;
        const nowShorn  = sheep.model.isShorn() === true;
        const notReady  = sheep.model.canProduce() === false; // on regrowth cooldown now

        // Dump the shears' wool into the farm stand's wool stock.
        const woolBefore = paddock.farmStand.stock.wool ?? 0;
        paddock.dumpShearsWool();
        const dumped = (paddock.farmStand.stock.wool ?? 0) === woolBefore + 1
          && (hot._shearsLoad ?? 0) === 0;

        // Secondary job: trimming the nearest horse routes through the brush path
        // without throwing (grooming benefit reused, #254).
        let trimmedOk = true;
        try {
          const horse = paddock.horses[0];
          const shearsItem = hot.getActiveItem();
          paddock.useItemOnHorse(shearsItem, horse);
        } catch { trimmedOk = false; }

        shears = (readyBefore && loadedOne && nowShorn && notReady && dumped && trimmedOk)
          ? 'shears-and-dumps'
          : `readyBefore=${readyBefore},loadedOne=${loadedOne},nowShorn=${nowShorn},notReady=${notReady},dumped=${dumped},trimmedOk=${trimmedOk}`;
      }
    } catch (e) { shears = 'threw: ' + String(e); }

    // Crop processing (#40): a basket of raw strawberries processed at the kitchen
    // counter becomes jam (converts, doesn't just no-op), a basket of carrots ground
    // there becomes pig feed that a hungry pig will actually walk to and eat, and the
    // processed goods (jam/flour) sell at the stand for MORE than their raw crop.
    let cropProcessing = 'no basket';
    try {
      const hot = g.scene.getScene('HotbarScene');
      hot.activeSlot = hot.hotbar.indexOf('basketGroup');
      const basketKey = hot._resolveKey ? hot._resolveKey('basketGroup') : null;

      // Strawberry → jam.
      hot.carriers[basketKey] = { content: 'strawberry', count: 3 };
      const jamMade = paddock.processCrop();
      const jamItem = hot.getActiveItem();
      const gotJam = jamItem?.content === 'jam' && jamItem?.count === 3;

      // Wheat → flour.
      hot.carriers[basketKey] = { content: 'wheat', count: 2 };
      paddock.processCrop();
      const gotFlour = hot.getActiveItem()?.content === 'flour';

      // Carrot → ground pig feed, then a hungry pig seeks the dropped pile (mirrors
      // the duck-food taming probe's seek check above).
      hot.carriers[basketKey] = { content: 'carrot', count: 2 };
      paddock.processCrop();
      const gotPigFeed = hot.getActiveItem()?.content === 'pigFeed';
      let pigSeeks = false;
      const pigA = paddock.animals.find((a) => a.model?.species === 'pig');
      if (pigA) {
        pigA.model.stats.hunger = 20;
        paddock.props.hayPiles.push({ x: pigA.sprite.x + 20, y: pigA.sprite.y, sprite: { destroy() {} }, content: 'pigFeed' });
        pigA.state = 'idle';
        const claimed = paddock.runBehaviors(pigA);
        pigSeeks = claimed && pigA.state === 'eating';
        paddock.props.hayPiles = [];
      }

      // Processed goods sell for more than their raw crop at the stand.
      const pricesUp = STAND_DEFS.jam.price > STAND_DEFS.strawberry.price
        && STAND_DEFS.flour.price > STAND_DEFS.wheat.price;

      hot.carriers[basketKey] = { content: null, count: 0 }; // leave the basket clean

      cropProcessing = (gotJam && gotFlour && gotPigFeed && pigSeeks && pricesUp)
        ? 'processes-and-sells-higher'
        : `gotJam=${gotJam},gotFlour=${gotFlour},gotPigFeed=${gotPigFeed},pigSeeks=${pigSeeks},pricesUp=${pricesUp}`;
    } catch (e) { cropProcessing = 'threw: ' + String(e); }

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

    // #53 chicken coop cutaway: mirrors the barn's walk-in pattern (#35) but purely
    // visual — a roosting bird must stay VISIBLE at a fixed roost spot (tucked
    // behind the façade), not vanish (the old setVisible(false)). Also proves the
    // façade actually fades when the player is near/inside the coop footprint and
    // recovers when they leave, and that the two new cutaway textures exist.
    let chickenCoop = 'no coop mixin';
    try {
      const { EVENTS } = await import('/src/data/events.js');
      const coopTexOk = g.textures.exists('coopInterior') && g.textures.exists('coopFront');
      const hasCoopProp = !!paddock.props.coop && !!paddock.coopFront && !!paddock.coopInteriorRect;

      const bird = paddock.animals.find((a) => paddock._isFlockBird(a));
      let roostVisible = 'no flock bird';
      if (bird) {
        // The real DayNightScene clock keeps advancing in the background — if a
        // phase flips mid-probe, onPhaseChange's wakeAllAnimals would legitimately
        // walk our just-roosted bird back out (chickenLeaveCoop), which is correct
        // in-game behaviour but makes this deterministic isolation probe flaky.
        // Detach the listener for the probe's short window and restore it right after.
        paddock.game.events.off(EVENTS.PHASE_CHANGE, paddock.onPhaseChange, paddock);
        // Park it right at the coop ramp first so the roost tween chain is short
        // and deterministic (not racing the 700ms flock re-decide tick over a long
        // walk from wherever it happened to be wandering).
        if (bird.wanderTween) { bird.wanderTween.stop(); bird.wanderTween = null; }
        bird.sprite.setPosition(paddock.props.coop.rampX, paddock.props.coop.rampY);
        bird.state = 'idle';
        paddock.chickenRoost(bird);
        // The roost tween chain (ramp → pop-door → roost spot) is async and has a
        // brief `wanderTween === null` gap between its two chained legs (right
        // before the next tween starts) — so poll for the bird actually REACHING
        // its roost spot rather than the tween-handle's presence, which would
        // false-positive "done" mid-chain.
        let waited = 0;
        const spotCheck = paddock._coopRoostSpotFor(bird);
        while (waited < 3000) {
          const reached = Math.abs(bird.sprite.x - spotCheck.x) < 4 && Math.abs(bird.sprite.y - spotCheck.y) < 4;
          if (bird.state !== 'roosting' || reached) break;
          await new Promise((r) => setTimeout(r, 100));
          waited += 100;
        }
        paddock.game.events.on(EVENTS.PHASE_CHANGE, paddock.onPhaseChange, paddock);
        const spot = paddock._coopRoostSpotFor(bird);
        const atSpot = Math.abs(bird.sprite.x - spot.x) < 4 && Math.abs(bird.sprite.y - spot.y) < 4;
        roostVisible = (bird.state === 'roosting' && bird.sprite.visible === true && atSpot)
          ? 'visible-at-roost'
          : `state=${bird.state},visible=${bird.sprite.visible},atSpot=${atSpot},waited=${waited}`;
      }

      // Façade fade: force the player right into the coop's interior rect and tick
      // the cutaway update several times — alpha should drop toward the faint-ghost
      // floor. Then step the player far away and confirm it recovers to opaque.
      const savedX = paddock.player.sprite.x, savedY = paddock.player.sprite.y;
      const r = paddock.coopInteriorRect;
      paddock.player.sprite.setPosition((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
      for (let i = 0; i < 40; i++) paddock.updateCoopCutaway(50);
      const fadedNear = paddock.coopFront.alpha < 0.3;
      paddock.player.sprite.setPosition(savedX - 2000, savedY);
      for (let i = 0; i < 40; i++) paddock.updateCoopCutaway(50);
      const restoredFar = paddock.coopFront.alpha === 1;
      paddock.player.sprite.setPosition(savedX, savedY);

      // Clean up: settle the bird back to idle/wandering so it doesn't confuse
      // later probes (charm's restAllAnimals/wakeAllAnimals already ran above).
      if (bird && bird.state === 'roosting') {
        bird.state = 'idle';
        bird.sprite.setDepth(bird.sprite.y);
        paddock.scheduleAnimalWander(bird, 10);
      }

      chickenCoop = (coopTexOk && hasCoopProp && roostVisible === 'visible-at-roost' && fadedNear && restoredFar)
        ? 'cutaway-and-roost-visible'
        : `coopTexOk=${coopTexOk},hasCoopProp=${hasCoopProp},roostVisible=${roostVisible},fadedNear=${fadedNear},restoredFar=${restoredFar}`;
    } catch (e) { chickenCoop = 'threw: ' + String(e); }

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

    // #15/#114 breeding & foals: the two-step redesign — bond two horses PERMANENTLY
    // (no gestation yet), then separately "Breed" that bonded pair to start a
    // gestation, force the gestation clock to completion, and assert a NEW foal
    // joined the horse roster (grew it) + spawned in the world as an isFoal horse.
    // Then assert the "stay a baby forever" toggle gates growth: while stayBaby is
    // on, growUpFoal is a no-op; turning it off grows the foal up. Also proves #114's
    // monogamy (a bonded horse can't be re-paired) and that "Breed" works AGAIN on
    // the same bond after a foal is revealed. The pure timing/seed/bond logic is
    // unit-tested (data/breeding.test.js) — here we prove the scene wiring (bond
    // persistence, roster growth, birth spawn, grow-up gate, repeat breeding) fires.
    let breeding = 'ok';
    try {
      paddock._suppressFoalCustomizer = true; // don't pop the editor mid-smoke
      const before = Object.keys(g.registry.get('allHorses')).length;

      // Step 1 — Pair (bond): mark horse, then pick a mate → PERMANENT bond forms.
      // No gestation should start from this alone.
      paddock.toggleBondSelection('horse');
      paddock.toggleBondSelection('horse2');
      const bonded = (paddock._pairBonds?.length ?? 0) === 1
        && paddock.isBonded('horse') && paddock.isBonded('horse2')
        && paddock.bondMateKey('horse') === 'horse2';
      const noGestationFromBond = (paddock._gestations?.length ?? 0) === 0;

      // #114 monogamy: a bonded horse can't be paired with a third horse.
      const monogamyBlocked = paddock.formPairBond('horse', 'horse3') === null
        && !paddock.isBonded('horse3');

      // Step 2 — Breed (separate, explicit): starts a gestation with the bonded mate.
      const breedStatus = paddock.startBreeding('horse');
      const gestationStarted = (paddock._gestations?.length ?? 0) === 1
        && !!breedStatus && breedStatus.includes('expecting a foal');

      // Fast-forward: shove the gestation start well into the past and tick.
      paddock._gestations[0].startedAt = Date.now() - 10 * 60 * 1000;
      paddock._breedAccum = 9999; // force the ~1/s born-check to run this tick
      paddock.updateBreeding(16);

      // #299: the completed gestation must be HELD, not birthed live, even though
      // the player is wide awake right now. Assert the foal is NOT yet in the
      // roster/scene, and the gestation moved into the ready-to-birth queue.
      const allBeforeWake = g.registry.get('allHorses');
      const noLiveBirth = Object.keys(allBeforeWake).length === before;
      const heldForWake = (paddock._readyBirths?.length ?? 0) === 1;
      const gestClearedPreWake = (paddock._gestations?.length ?? -1) === 0;

      // Now simulate sleep→wake: flushing the ready-births queue is what
      // PaddockScene._onSleepDone does on EVENTS.SLEEP_DONE.
      paddock.flushReadyBirths();
      const all = g.registry.get('allHorses');
      const grew = Object.keys(all).length === before + 1;
      const flushedQueue = (paddock._readyBirths?.length ?? -1) === 0;
      const foalKey = Object.keys(all).find((k) => all[k].isFoal);
      const foalModel = foalKey ? all[foalKey] : null;
      const bornFoal = !!(foalModel && foalModel.isFoal && foalModel.stayBaby === true);
      const foalInScene = !!(foalKey && paddock.horses.some((hh) => hh.key === foalKey));
      const gestCleared = (paddock._gestations?.length ?? -1) === 0;

      // #114: "Breed" must work AGAIN on the same bond now that the foal is revealed
      // (no longer expecting). The bond itself is untouched (still exactly 1 pair).
      const rebreedStatus = paddock.startBreeding('horse');
      const rebredOk = (paddock._gestations?.length ?? 0) === 1
        && !!rebreedStatus && rebreedStatus.includes('expecting a foal')
        && (paddock._pairBonds?.length ?? 0) === 1;
      // Clean up the second gestation so it doesn't interfere with later checks below
      // (the foal-art/grow-up assertions target the FIRST foal only).
      paddock._gestations = [];

      // REGRESSION GUARD (#15): a foal wears the smaller foal art, which has NO
      // swish/roll/posture frames. Those anims must NOT be created for it — creating an
      // anim over missing textures makes anims.exists() true but its frames broken, so a
      // later play() crashes Phaser's getFirstTick (reading `.duration` off undefined).
      // Drive the exact paths that crashed on merged main (the head-to-tail tail-swish
      // and the dirt roll) directly on the foal and assert they no-op without throwing.
      const foalObj = paddock.horses.find((hh) => hh.key === foalKey);
      const foalHasNoSwish = !paddock.anims.exists(`swish_${foalKey}`);
      const foalHasNoRoll  = !paddock.anims.exists(`roll_${foalKey}`);
      let foalCharmSafe = false;
      try {
        foalObj.state = 'idle';
        paddock._charmTailSwish(foalObj);           // must skip (guarded on the missing anim)
        paddock._faceHeadToTail(foalObj, paddock.horses[0]); // swishes both — must not crash
        paddock._rollInDirt(foalObj, all[foalKey]); // must skip (no roll anim)
        foalCharmSafe = true;
      } catch (e) { foalCharmSafe = 'threw: ' + String(e); }

      // Stay-a-baby gate: with stayBaby on, growUpFoal must NOT grow it.
      const grewWhileBaby = paddock.growUpFoal(foalKey);
      const stayedBaby = grewWhileBaby === false && all[foalKey]?.isFoal === true;
      // Allow growth: turning stayBaby off grows the foal up into a horse — and the
      // grown horse must now GAIN the swish/roll anims (so it tail-swishes like the herd).
      paddock.setStayBaby(foalKey, false);
      const grownUp = all[foalKey]?.isFoal === false;
      const grownHasSwish = paddock.anims.exists(`swish_${foalKey}`);

      breeding = (bonded && noGestationFromBond && monogamyBlocked && gestationStarted &&
                  noLiveBirth && heldForWake && gestClearedPreWake &&
                  grew && flushedQueue && bornFoal && foalInScene && gestCleared &&
                  rebredOk &&
                  foalHasNoSwish && foalHasNoRoll && foalCharmSafe === true &&
                  stayedBaby && grownUp && grownHasSwish)
        ? 'bonds-breeds-repeatedly-and-gates-growth'
        : `bonded=${bonded},noGestationFromBond=${noGestationFromBond},monogamyBlocked=${monogamyBlocked},gestationStarted=${gestationStarted},noLiveBirth=${noLiveBirth},heldForWake=${heldForWake},gestClearedPreWake=${gestClearedPreWake},grew=${grew},flushedQueue=${flushedQueue},bornFoal=${bornFoal},foalInScene=${foalInScene},gestCleared=${gestCleared},rebredOk=${rebredOk},foalHasNoSwish=${foalHasNoSwish},foalHasNoRoll=${foalHasNoRoll},foalCharmSafe=${foalCharmSafe},stayedBaby=${stayedBaby},grownUp=${grownUp},grownHasSwish=${grownHasSwish}`;
    } catch (e) { breeding = 'threw: ' + String(e); }

    // #274 baby chicks: rooster-bred incubation, mirroring the horse breeding probe
    // above in shape (its own parallel system — paddock/incubation.js, data/species/
    // chicken/incubation.js — never touching breeding.js/data/breeding.js). Proves:
    // the rooster-present gate, the fertilized-egg → incubate → hatch flow, the new
    // chick joining allChickens (isFoal + stayBaby:true per #298), and the stay-a-
    // baby toggle gating growth exactly like the foal's.
    let incubation = 'ok';
    try {
      const henKey = 'chicken0';
      const beforeChickens = Object.keys(g.registry.get('allChickens')).length;
      // Without a rooster present, incubation must be refused. Temporarily pull the
      // rooster out of the allRoosters registry (the roster _hasBreedingRooster/
      // _breedingRooster actually read), then put it right back.
      const savedRoosters = g.registry.get('allRoosters');
      g.registry.set('allRoosters', {});
      const noRoosterBlocked = !paddock._hasBreedingRooster();
      const refusedNoRooster = !paddock.startIncubation(henKey)?.includes('incubating');
      g.registry.set('allRoosters', savedRoosters);
      const roosterPresent = paddock._hasBreedingRooster();

      // Player-initiated: start incubation on a hen.
      const status = paddock.startIncubation(henKey);
      const started = !!status?.includes('incubating') && paddock._isIncubating(henKey);
      const alreadyBlocked = paddock.startIncubation(henKey)?.includes('already incubating');

      // Fast-forward: shove the incubation start well into the past and tick.
      paddock._incubations[0].startedAt = Date.now() - 10 * 60 * 1000;
      paddock._incubationAccum = 9999; // force the ~1/s hatch-check to run this tick
      paddock.updateIncubation(16);
      const allChickens = g.registry.get('allChickens');
      const grew = Object.keys(allChickens).length === beforeChickens + 1;
      const chickKey = Object.keys(allChickens).find((k) => allChickens[k].isFoal);
      const chickModel = chickKey ? allChickens[chickKey] : null;
      const hatchedChick = !!(chickModel && chickModel.isFoal && chickModel.stayBaby === true);
      const chickInScene = !!(chickKey && paddock.animals.some((a) => a.key === chickKey));
      const incCleared = (paddock._incubations?.length ?? -1) === 0;

      // Stay-a-baby gate: with stayBaby on, growUpChick must NOT grow it.
      const grewWhileBaby = paddock.growUpChick(chickKey);
      const stayedBaby = grewWhileBaby === false && allChickens[chickKey]?.isFoal === true;
      // Allow growth: turning stayBaby off grows the chick up into a hen.
      paddock.setChickStayBaby(chickKey, false);
      const grownUp = allChickens[chickKey]?.isFoal === false;

      incubation = (noRoosterBlocked && refusedNoRooster && roosterPresent && started &&
                    alreadyBlocked && grew && hatchedChick && chickInScene && incCleared &&
                    stayedBaby && grownUp)
        ? 'hatches-and-gates-growth'
        : `noRoosterBlocked=${noRoosterBlocked},refusedNoRooster=${refusedNoRooster},roosterPresent=${roosterPresent},started=${started},alreadyBlocked=${alreadyBlocked},grew=${grew},hatchedChick=${hatchedChick},chickInScene=${chickInScene},incCleared=${incCleared},stayedBaby=${stayedBaby},grownUp=${grownUp}`;
    } catch (e) { incubation = 'threw: ' + String(e); }

    // #134 follow-up to #21: the tack rack in the barn + multiple saddle types.
    // Assert the rack interactable exists/is actionable, cycling it steps through
    // all 3 SADDLE_TYPES (western → english → bareback → western), and equipping
    // the saddle tool on a horse picks up the rack's active type — a distinct
    // overlay texture per type (bareback = none) and its own ride-speed multiplier.
    let tackRack = 'ok';
    try {
      const hot = g.scene.getScene('HotbarScene');
      const insts = paddock._barnInteractables();
      const rack = insts.find((i) => i.label.startsWith('Tack Rack'));
      const rackExists = !!rack && rack.canAct === true;

      // Cycling steps through all three types in order and wraps.
      hot._activeSaddleType = 'western';
      const afterFirst  = paddock._barnCycleSaddleType();  // → english
      const afterSecond = paddock._barnCycleSaddleType();  // → bareback
      const afterThird  = paddock._barnCycleSaddleType();  // → western (wraps)
      const cyclesAll = afterFirst === 'english' && afterSecond === 'bareback' && afterThird === 'western';

      // Equip picks up the rack's active type: distinct overlay per type, no
      // overlay image for bareback, and the horse model persists saddleType.
      const horse = paddock.horses.find((h) => h.key !== paddock.riding?.h?.key);
      hot._activeSaddleType = 'english';
      paddock.equipSaddle(horse);
      const englishOk = horse.saddled === true && horse.saddleType === 'english'
        && horse.saddleImg?.texture?.key === 'saddleOverlayEnglish'
        && horses[horse.key].saddleType === 'english';

      hot._activeSaddleType = 'bareback';
      paddock.equipSaddle(horse); // switch type while still saddled
      const barebackOk = horse.saddled === true && horse.saddleType === 'bareback'
        && horse.saddleImg === null; // no rigid overlay for a bareback pad

      hot._activeSaddleType = 'western';
      paddock.equipSaddle(horse);
      const westernOk = horse.saddleType === 'western'
        && horse.saddleImg?.texture?.key === 'saddleOverlayWestern';

      paddock.removeSaddle(horse); // leave the probed horse as we found it

      tackRack = (rackExists && cyclesAll && englishOk && barebackOk && westernOk)
        ? 'rack-cycles-and-equips'
        : `rackExists=${rackExists},cyclesAll=${cyclesAll}(${afterFirst},${afterSecond},${afterThird}),englishOk=${englishOk},barebackOk=${barebackOk},westernOk=${westernOk}`;
    } catch (e) { tackRack = 'threw: ' + String(e); }

    return {
      owl,
      charm,
      chickenCoop,
      breeding,
      incubation,
      rooster,
      tackRack,
      roosterCount: Object.keys(g.registry.get('allRoosters') ?? {}).length,
      roostersInScene: paddock.animals.filter((a) => a.model?.species === 'rooster').length,
      fox,
      duck,
      shears,
      cropProcessing,
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
      horseCount: pristineHorseCount,
      chickenCount: pristineChickenCount,
      sampleHorse: { name: h.name, species: h.species, hasMood: typeof h.mood === 'function' },
      activeScenes: g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
      feedDelta,
      missingMethods,
      horsesInScene: pristineHorsesInScene,
      hasFarmStand: !!paddock.farmStand,
      hasBirdBath: !!paddock.props.birdBath, // #219 decorative bird bath world object
      hasSeedFeeder: !!paddock.props.seedFeeder, // #240 refillable seed feeder
      hasNectarFeeder: !!paddock.props.nectarFeeder, // #226 hummingbird nectar feeder
      hasBeehive: !!paddock.props.beehive, // #239 beehive world object
      hasBirdhouse: !!paddock.props.birdhouse, // #218 decorative birdhouse world object
      birdhouseTextureOk: g.textures.exists('birdhouse'),
      // Display scales: every animal is now super-sampled (ART_SCALE× art shown at
      // S/ART_SCALE), so the chicken and horse share the same base display scale. Guard
      // that ratio ≈ 1 — it jumps to ART_SCALE if a species' `superSampled` spawn flag
      // gets dropped (the chicken would render 1× at full S, i.e. 4× too big).
      scaleRatio: (paddock.animals.find((a) => a.key.startsWith('chicken'))?.sprite?.scaleX ?? 0)
                / (paddock.horses[0]?.sprite?.scaleX ?? 1),
    };
  }, STAND_DEFS);

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

  // #231 stream swim: drive the dog directly into animalGoSwim (bypassing the random
  // ambient trigger so the test is deterministic) and assert the whole round-trip —
  // capability wiring, a reachable stream spot, the swim_0/1 textures + anim resolve,
  // state flips to 'swimming' then back to 'idle'/wandering, no throw.
  result.swim = await page.evaluate(async () => {
    const g = window.__game;
    const paddock = g.scene.getScene('PaddockScene');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      const dog = paddock.animals.find((a) => a.model?.species === 'dog');
      const cap = !!(g.registry.get('allDogs') && dog); // roster + spawned
      const hasSwimTex = g.textures.exists('dog_swim_0') && g.textures.exists('dog_swim_1');
      const hasSwimAnim = g.anims.exists(`swim_${dog?.key}`);
      let claimed = false, reachedSwimState = false;
      if (dog) {
        dog.state = 'idle';
        if (dog.wanderTween) { dog.wanderTween.stop(); dog.wanderTween = null; }
        claimed = paddock.animalGoSwim(dog);
        // moveCreatureTo/tweens are async — give it a beat to walk to the bank,
        // wade in, and settle into the 'swimming' state.
        await sleep(700);
        reachedSwimState = dog.state === 'swimming';
        // Force it back out immediately (don't wait out the full multi-second dip)
        // and confirm it lands back on idle/wandering, not stuck.
        dog.state = 'idle';
        if (dog.wanderTween) { dog.wanderTween.stop(); dog.wanderTween = null; }
        paddock.scheduleAnimalWander(dog, 10);
        await sleep(400);
      }
      // Any normal non-swimming state counts as "returned to normal" — the dog's
      // per-frame companion-follow (#186, companion.js) can legitimately claim an
      // idle dog into 'following'/'companion-sit' the instant it settles, which is
      // just as much "back to normal" as 'idle'/'wandering'.
      const settledOk = !dog || ['idle', 'wandering', 'following', 'companion-sit'].includes(dog.state);
      return (cap && hasSwimTex && hasSwimAnim && claimed && reachedSwimState && settledOk)
        ? 'swims-and-returns'
        : `cap=${cap},hasSwimTex=${hasSwimTex},hasSwimAnim=${hasSwimAnim},claimed=${claimed},reachedSwimState=${reachedSwimState},settledOk=${settledOk},finalState=${dog?.state}`;
    } catch (e) { return 'threw: ' + String(e); }
  });

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

  // Seasons pass (#272, VISUAL FIRST): drive the DayNightScene's season cycle and
  // assert the seasonal tint + snow track it, a SEASON_CHANGE event fires, and the
  // derived season matches the pure logic. All renderer-agnostic.
  const season = await page.evaluate(async () => {
    const g = window.__game;
    const dn = g.scene.getScene('DayNightScene');
    const { seasonForDay, seasonPalette } = await import('/src/data/seasons.js');

    // Listen for the next SEASON_CHANGE so we can confirm the event actually fires.
    let announced = null;
    const onSeason = ({ season }) => { announced = season; };
    g.events.on('season-change', onSeason);

    const startSeason = dn._season;
    const startTintVisible = dn.seasonTint.commandBuffer.length > 0;

    // Skip forward until we land on winter (at most a couple of years of days) and
    // confirm the snow field turns on and the tint updates for it.
    let guard = 0;
    while (dn._season !== 'winter' && guard++ < 40) dn._advanceSeason();
    const winterSnowVisible = dn.snowGfx.visible;
    const winterSeason = dn._season;
    const winterDerivedMatches = seasonForDay(dn._day) === dn._season;

    // Advance once more off winter → snow should switch back off (only winter snows).
    dn._advanceSeason();
    const offWinterSnowVisible = dn.snowGfx.visible;

    // The season tint should be applied (winter has a non-zero alpha wash).
    const tintDrawnForWinter = seasonPalette('winter').alpha > 0;

    g.events.off('season-change', onSeason);
    return {
      startSeason,
      startTintVisible,
      winterSeason,
      winterSnowVisible,
      winterDerivedMatches,
      offWinterSnowVisible,
      tintDrawnForWinter,
      announced,
    };
  });
  result.season = season;

  // Late-night forced sleep (#300): drive the clock into Night and confirm (a) normal
  // night play is untouched early on — no warning, no lock, owls/ambient content still
  // reachable — and (b) past the hard-lock threshold, sleep auto-triggers via the SAME
  // EVENTS.SLEEP → doSleep flow a bed uses, without the player manually sleeping.
  const lateNight = await page.evaluate(async () => {
    const g = window.__game;
    const dn = g.scene.getScene('DayNightScene');
    const { LATE_NIGHT_WARN_FRACTION, LATE_NIGHT_LOCK_FRACTION } = await import('/src/data/lateNight.js');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Jump straight into Night (index 3) and settle just past its start.
    const nightStart = 120_000 + 300_000 + 120_000; // Morning + Afternoon + Evening durs
    const nightDur = 90_000;
    dn.elapsed = nightStart + 1000;
    dn.currentPhase = -1;
    dn._applyClock();
    const enteredNight = dn.currentPhase === 3; // index 3 = Night in the PHASES table

    // Early night (well before the warn fraction): free roam, no cues, no lock.
    const noEarlyWarning = dn.lateNightLabel.visible === false;
    const noEarlyLock = dn._sleeping === false;
    const owlActiveEarly = (await import('/src/data/owls.js')).isOwlActivePhase('Night'); // untouched by this feature

    // Advance to just past the warn fraction, before the lock: the vignette/label tell
    // should show, but sleep must NOT be forced yet.
    dn.elapsed = nightStart + nightDur * (LATE_NIGHT_WARN_FRACTION + 0.05);
    dn._applyClock();
    const warningShows = dn.lateNightLabel.visible === true;
    const stillNotSleepingAtWarn = dn._sleeping === false;

    // Advance past the hard-lock threshold WITHOUT manually sleeping: doSleep must
    // auto-fire (this._sleeping flips true and the fade tween starts).
    dn.elapsed = nightStart + nightDur * (LATE_NIGHT_LOCK_FRACTION + 0.02);
    dn._applyClock();
    const lockedSleepFired = dn._sleeping === true;
    // Let the fade-to-morning tween resolve so it doesn't bleed into later probes.
    await sleep(2200);
    const wokeUpAfterLock = dn._sleeping === false && dn.currentPhase === 0; // back at Morning

    return {
      enteredNight, noEarlyWarning, noEarlyLock, owlActiveEarly,
      warningShows, stillNotSleepingAtWarn, lockedSleepFired, wokeUpAfterLock,
    };
  });
  result.lateNight = lateNight;

  console.log(JSON.stringify(result, null, 2));

  const wx = result.weather;
  if (!wx.paddockSawRain) fail('WEATHER_CHANGE not received by PaddockScene (weather event not wired)');
  if (wx.wildlifeGate !== false) fail('wildlife rain-gate did not close in rain (_weatherAllowsWildlife true while raining)');
  if (!(wx.rainLoss > wx.sunLoss)) fail(`rain did not dirty faster (sunLoss=${wx.sunLoss}, rainLoss=${wx.rainLoss})`);
  if (wx.rainLoss !== wx.sunLoss * 2) fail(`rain dirt multiplier ≠ 2 (sunLoss=${wx.sunLoss}, rainLoss=${wx.rainLoss})`);
  if (!(wx.rainTroughLevel > 0)) fail('rain did not fill the trough at all');
  if (wx.rainTroughLevel >= 9) fail(`rain filled the trough to ${wx.rainTroughLevel}/9 — should be PARTIAL, not full (bucket loop undercut)`);

  const sn = result.season;
  if (!['spring', 'summer', 'fall', 'winter'].includes(sn.startSeason)) fail(`season cycle not started (startSeason=${sn.startSeason})`);
  if (sn.winterSeason !== 'winter') fail(`season cycle could not reach winter (stuck at ${sn.winterSeason})`);
  if (!sn.winterDerivedMatches) fail('winter season does not match the pure seasonForDay(day) derivation');
  if (!sn.winterSnowVisible) fail('winter snow field not visible in winter');
  if (sn.offWinterSnowVisible) fail('snow field still visible after leaving winter (should be winter-only)');
  if (!sn.tintDrawnForWinter) fail('winter seasonal tint has no alpha (season wash not applied)');
  if (sn.announced == null) fail('SEASON_CHANGE event never fired on season advance (not wired)');

  const ln = result.lateNight;
  if (!ln.enteredNight) fail('late-night probe (#300): clock did not land in the Night phase');
  if (!ln.noEarlyWarning) fail('late-night (#300): warning cue showing too early in Night (should be free roam)');
  if (!ln.noEarlyLock) fail('late-night (#300): sleep locked too early in Night (should be free roam)');
  if (!ln.owlActiveEarly) fail('late-night (#300): owls (#271) night-active gate was disturbed by this feature');
  if (!ln.warningShows) fail('late-night (#300): warning cue did not show past the warn-fraction threshold');
  if (!ln.stillNotSleepingAtWarn) fail('late-night (#300): sleep force-triggered at the warning stage, not just past the lock');
  if (!ln.lockedSleepFired) fail('late-night (#300): sleep did NOT auto-trigger past the hard-lock threshold');
  if (!ln.wokeUpAfterLock) fail('late-night (#300): forced sleep did not resolve back to Morning');

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
  if (!result.hasBirdhouse) fail('birdhouse (#218) not built — props.birdhouse missing');
  if (!result.birdhouseTextureOk) fail('birdhouse (#218) texture missing — worldArt.js gen() failed');
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
  // #53 chicken coop cutaway: textures exist, a roosting bird stays visible at its
  // roost spot (not hidden), and the façade fades near/inside + recovers away.
  if (result.chickenCoop !== 'cutaway-and-roost-visible') fail(`chicken coop cutaway (#53) failed: ${result.chickenCoop}`);
  // #231 stream swim: the dog can be driven into the swim behavior, the capability +
  // art wiring resolves, and it returns to normal wandering afterward.
  if (result.swim !== 'swims-and-returns') fail(`stream swim (#231) failed: ${result.swim}`);
  // #271 ambient owl: night-only glide-in, one at a time, absent by day/asleep.
  if (result.owl !== 'night-only') fail(`ambient owl (#271) failed: ${result.owl}`);

  if (result.breeding !== 'bonds-breeds-repeatedly-and-gates-growth') fail(`breeding & foals (#15/#114) failed: ${result.breeding}`);
  // Rooster (#269): spawned as a flock bird, doesn't lay, is a breeding partner, crows at dawn.
  if (result.roosterCount !== 1) fail(`expected 1 rooster in roster, got ${result.roosterCount}`);
  if (result.roostersInScene !== 1) fail(`expected 1 rooster sprite in scene, got ${result.roostersInScene}`);
  if (result.rooster !== 'crows-at-dawn') fail(`rooster (#269) failed: ${result.rooster}`);
  // #274 baby chicks: rooster-gated incubation, hatch, and the stay-a-baby toggle.
  if (result.incubation !== 'hatches-and-gates-growth') fail(`baby chicks (#274) failed: ${result.incubation}`);
  // #266 foxes: wild fox summons on fox food, tames into the roster once, capped, then seeks.
  if (result.fox !== 'tamed-and-capped') fail(`fox taming (#266) failed: ${result.fox}`);
  // #275 ducks: wild duck summons on duck food near the stream, tames into the roster
  // once, capped, then seeks food AND swims via the generic swims capability (#231).
  if (result.duck !== 'tamed-and-swims') fail(`duck taming/swim (#275) failed: ${result.duck}`);
  // #202 rework: the cat eats directly from a stocked bowl (not dropped piles).
  if (result.catBowls !== 'eats-from-bowl') fail(`cat bowl feeding (#202) failed: ${result.catBowls}`);
  if (result.seedFeeder !== 'fills-and-drains') fail(`seed feeder fill/drain (#240) failed: ${result.seedFeeder}`);
  if (result.nectarFeeder !== 'fills-and-drains') fail(`nectar feeder fill/drain (#226) failed: ${result.nectarFeeder}`);
  if (result.beehive !== 'ripens-and-harvests') fail(`beehive honey (#239) failed: ${result.beehive}`);
  // #254 shears (multi-use tool): shear a sheep into the shears' own wool load, dump it
  // into the farm stand's wool stock, and trim a horse via the brush grooming path.
  if (result.shears !== 'shears-and-dumps') fail(`shears tool (#254) failed: ${result.shears}`);
  // #134 follow-up to #21: tack rack (barn) + multiple saddle types — the rack
  // interactable exists and is actionable, cycling steps through all 3 types, and
  // equipping picks up the rack's active type (distinct overlay per type, bareback
  // has none) while riding/saddle gating stays exactly as before.
  if (result.tackRack !== 'rack-cycles-and-equips') fail(`tack rack / saddle types (#134) failed: ${result.tackRack}`);
  // Crop processing (#40): kitchen counter converts strawberry→jam, wheat→flour,
  // carrot→pig feed (a hungry pig seeks the dropped pile), and jam/flour sell for
  // more than their raw crop at the stand.
  if (result.cropProcessing !== 'processes-and-sells-higher') fail(`crop processing (#40) failed: ${result.cropProcessing}`);
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

  // ── #15/#114 foal + pair-bond persistence across reload ──────────────────────
  // Bond, then breed + birth a fresh foal, keep it a baby, then RELOAD the same page
  // (same localStorage). The newborn — a runtime-grown horse-roster member — must be
  // restored from the save and re-spawned into the world as an isFoal horse, AND the
  // permanent pair bond must survive the reload too. Proves save.js's saved-key merge
  // carries the grown roster + spawnSavedFoals re-shows it, and load/savePairBonds
  // round-trips the bond.
  const bornFoalKey = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    p._suppressFoalCustomizer = true; // don't pop the editor mid-smoke
    const before = Object.keys(g.registry.get('allHorses'));
    p.toggleBondSelection('horse3');
    p.toggleBondSelection('horse4');
    p.startBreeding('horse3');
    p._gestations[p._gestations.length - 1].startedAt = Date.now() - 10 * 60 * 1000;
    p._breedAccum = 9999;
    p.updateBreeding(16);
    p.flushReadyBirths(); // #299: births are held until wake — flush to birth it now
    const all = g.registry.get('allHorses');
    const key = Object.keys(all).find((k) => !before.includes(k) && all[k].isFoal);
    return key ?? null;
  });
  if (!bornFoalKey) fail('#15 persistence: no foal born to test reload with');

  // ── #274 chick persistence across reload (same reload as the foal, below) ────
  // Hatch a fresh chick, keep it a baby, so the upcoming reload proves it too
  // survives — a runtime-grown chicken-roster member restored from the save and
  // re-spawned into the world as an isFoal chicken (mirrors the foal check above).
  const hatchedChickKey = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const before = Object.keys(g.registry.get('allChickens'));
    // The earlier in-page probe already hatched+grew a chick on 'chicken0'; use a
    // different hen so this is a clean, independent incubation.
    const status = p.startIncubation('chicken1');
    if (!status?.includes('incubating')) return null;
    p._incubations[p._incubations.length - 1].startedAt = Date.now() - 10 * 60 * 1000;
    p._incubationAccum = 9999;
    p.updateIncubation(16);
    const all = g.registry.get('allChickens');
    const key = Object.keys(all).find((k) => !before.includes(k) && all[k].isFoal);
    return key ?? null;
  });
  if (!hatchedChickKey) fail('#274 persistence: no chick hatched to test reload with');
  // The reload can be timing-fragile under heavy machine load (parallel builds can
  // leave the fresh page briefly stuck booting), so make it deterministic: retry the
  // reload up to 3× with generous timeouts, and wait for the SPECIFIC foal to be both
  // loaded into the roster (BootScene finished restoring the save) AND spawned into the
  // world (spawnSavedFoals ran) — not merely for PaddockScene to be active. Coverage is
  // unchanged (the foal must still survive the reload); only the wait is hardened.
  let reloaded = false;
  for (let attempt = 0; attempt < 3 && !reloaded; attempt++) {
    try {
      await page.reload({ waitUntil: 'load', timeout: 45000 });
      await page.waitForFunction(({ foalKey, chickKey }) => {
        const g = window.__game;
        if (!(g && g.scene && g.scene.isActive('PaddockScene'))) return false;
        const allH = g.registry.get('allHorses');
        if (!allH || !allH[foalKey]) return false;          // save restored the foal
        const allC = g.registry.get('allChickens');
        if (!allC || !allC[chickKey]) return false;         // save restored the chick
        const p = g.scene.getScene('PaddockScene');
        return !!p.horses?.some((h) => h.key === foalKey)   // world re-spawned the foal
          && !!p.animals?.some((a) => a.key === chickKey);  // world re-spawned the chick
      }, { foalKey: bornFoalKey, chickKey: hatchedChickKey }, { timeout: 45000, polling: 200 });
      reloaded = true;
    } catch (e) {
      if (attempt === 2) fail(`#15/#274 persistence: page did not settle after reload (${String(e).split('\n')[0]})`);
    }
  }
  const foalPersist = await page.evaluate((key) => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const model = g.registry.get('allHorses')?.[key];
    return {
      inRoster: !!model,
      stillFoal: model?.isFoal === true,
      stillBaby: model?.stayBaby === true,
      inScene: !!p.horses?.some((h) => h.key === key),
    };
  }, bornFoalKey);
  if (!foalPersist.inRoster) fail(`#15 persistence: foal ${bornFoalKey} lost from roster after reload`);
  if (!foalPersist.stillFoal) fail(`#15 persistence: reloaded foal is no longer a foal (grew up unexpectedly)`);
  if (!foalPersist.stillBaby) fail(`#15 persistence: reloaded foal lost its stay-a-baby toggle`);
  if (!foalPersist.inScene) fail(`#15 persistence: foal ${bornFoalKey} not re-spawned into the world after reload (spawnSavedFoals)`);
  console.log(`Foal persistence (#15): ${JSON.stringify(foalPersist)} for ${bornFoalKey}`);

  // ── #114 pair-bond persistence + repeat breeding after reload ────────────────
  // The permanent bond formed on horse3/horse4 above must survive the reload (its
  // own storage key, load/savePairBonds), and "Breed" must work AGAIN on that same
  // bond now that the earlier foal has been revealed — proving a bonded pair can
  // have multiple foals across separate play sessions (a fresh page load here).
  const bondPersist = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const stillBonded = p.isBonded('horse3') && p.isBonded('horse4')
      && p.bondMateKey('horse3') === 'horse4';
    const status = p.startBreeding('horse3');
    const rebredAfterReload = (p._gestations?.length ?? 0) === 1
      && !!status && status.includes('expecting a foal');
    return { stillBonded, rebredAfterReload, status };
  });
  if (!bondPersist.stillBonded) fail('#114 persistence: pair bond (horse3/horse4) lost after reload');
  if (!bondPersist.rebredAfterReload) fail(`#114 persistence: "Breed" did not work again on the same bond after reload (${bondPersist.status})`);
  console.log(`Pair-bond persistence + repeat breeding (#114): ${JSON.stringify(bondPersist)}`);

  // ── #274 chick persistence assertions (same reload as the foal, above) ───────
  const chickPersist = await page.evaluate((key) => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const model = g.registry.get('allChickens')?.[key];
    return {
      inRoster: !!model,
      stillFoal: model?.isFoal === true,
      stillBaby: model?.stayBaby === true,
      inScene: !!p.animals?.some((a) => a.key === key),
    };
  }, hatchedChickKey);
  if (!chickPersist.inRoster) fail(`#274 persistence: chick ${hatchedChickKey} lost from roster after reload`);
  if (!chickPersist.stillFoal) fail(`#274 persistence: reloaded chick is no longer a chick (grew up unexpectedly)`);
  if (!chickPersist.stillBaby) fail(`#274 persistence: reloaded chick lost its stay-a-baby toggle`);
  if (!chickPersist.inScene) fail(`#274 persistence: chick ${hatchedChickKey} not re-spawned into the world after reload (buildAnimals)`);
  console.log(`Chick persistence (#274): ${JSON.stringify(chickPersist)} for ${hatchedChickKey}`);

  // ── #223 bird befriending: a specific bird's repeated qualifying visits build a
  // relationship score, cross the threshold into a NAMED "befriended" regular (capped
  // roster), and persist across reload. Drive registerBirdVisit directly (the same call
  // the ambient bath/birdhouse/feeder visit beats make on landing) rather than waiting
  // out the ambient timers — deterministic and mirrors the fox-taming smoke rigor.
  const birdFriend = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const typeId = 'robin'; // an arbitrary bird type not used elsewhere in this run
    const before = p._birdFriendRoster.length;
    let befriendedAfter = null;
    for (let i = 1; i <= 5; i++) {
      p.registerBirdVisit('birdhouse', typeId, { x: 500, y: 260 });
      if (p._birdFriendRoster.some((b) => b.typeId === typeId) && befriendedAfter == null) befriendedAfter = i;
    }
    const entry = p._birdFriendRoster.find((b) => b.typeId === typeId);
    const sprite = p._friendlyBirds.find((r) => r.typeId === typeId);
    return {
      before,
      after: p._birdFriendRoster.length,
      befriendedAfter,
      named: entry?.name ?? null,
      spriteActive: !!sprite?.sprite?.active,
      countTicked: p._birdFriendCounts[typeId],
    };
  });
  if (birdFriend.after !== birdFriend.before + 1) fail(`#223 bird befriending: roster did not grow by exactly one (before=${birdFriend.before}, after=${birdFriend.after})`);
  if (birdFriend.befriendedAfter == null) fail('#223 bird befriending: never crossed the threshold across 5 qualifying visits');
  if (!birdFriend.named) fail('#223 bird befriending: committed bird has no name');
  if (!birdFriend.spriteActive) fail('#223 bird befriending: committed bird has no active in-world sprite');
  console.log(`Bird befriending (#223): ${JSON.stringify(birdFriend)}`);

  // Reload and confirm the named regular + its visit tally survive (mirrors the foal
  // persistence check above, and the fox-taming persistence unit test).
  await page.reload({ waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => {
    const g = window.__game;
    if (!(g && g.scene && g.scene.isActive('PaddockScene'))) return false;
    const p = g.scene.getScene('PaddockScene');
    return Array.isArray(p._birdFriendRoster) && p._birdFriendRoster.some((b) => b.typeId === 'robin');
  }, { timeout: 45000, polling: 200 });
  const birdFriendPersist = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const entry = p._birdFriendRoster.find((b) => b.typeId === 'robin');
    const sprite = p._friendlyBirds.find((r) => r.typeId === 'robin');
    return { inRoster: !!entry, named: entry?.name ?? null, spriteActive: !!sprite?.sprite?.active };
  });
  if (!birdFriendPersist.inRoster) fail('#223 bird befriending: named regular lost from roster after reload');
  if (birdFriendPersist.named !== birdFriend.named) fail(`#223 bird befriending: name changed after reload (was ${birdFriend.named}, now ${birdFriendPersist.named})`);
  if (!birdFriendPersist.spriteActive) fail('#223 bird befriending: named regular not re-spawned into the world after reload');
  console.log(`Bird befriending persistence (#223): ${JSON.stringify(birdFriendPersist)}`);

  // ── #294 Neighbor NPC: periodic visits, trading & a gift-based relationship score.
  // Mirrors the farm-stand customer's arrival shape (spawn at world edge, walk in on
  // a timer, npc_walk anim) but a different purpose. Drive _spawnNeighbor directly
  // (bypassing the random arrival timer) for a deterministic probe, then exercise
  // trade (give the player goods for gold) and gift (builds the relationship score,
  // mirroring the bird-befriending counter above) before confirming both round-trip
  // through a reload.
  const neighbor = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');

    // Arrival: spawn one in directly and let it walk to its visiting spot.
    const beforeSpawn = !!p._neighbor;
    p._spawnNeighbor();
    const spawned = !!p._neighbor?.sprite?.active && p.npcs.includes(p._neighbor);

    return { beforeSpawn, spawned, kind: p._neighbor?.kind, state: p._neighbor?.state };
  });
  if (neighbor.beforeSpawn) fail('#294 neighbor: a neighbor was already present before the probe spawned one');
  if (!neighbor.spawned) fail(`#294 neighbor: _spawnNeighbor did not produce an active, tracked npc (${JSON.stringify(neighbor)})`);
  if (neighbor.kind !== 'neighbor') fail(`#294 neighbor: spawned npc missing kind:'neighbor' tag (got ${neighbor.kind})`);
  console.log(`Neighbor arrival (#294): ${JSON.stringify(neighbor)}`);

  // Wait for the walk-in tween to land at the visiting spot (state → 'visiting').
  await page.waitForFunction(() => {
    const p = window.__game.scene.getScene('PaddockScene');
    return p._neighbor?.state === 'visiting';
  }, { timeout: 10000, polling: 100 });

  // Trade: equip an empty basket, give the player enough gold, and trade — the
  // offer's goods should land in the basket and gold should be deducted.
  const trade = await page.evaluate(() => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const hot = g.scene.getScene('HotbarScene');
    hot.activeSlot = hot.hotbar.indexOf('basketGroup');
    hot.activeCarrier.basket = 'basket1';
    hot.carriers.basket1 = { content: null, count: 0 };
    p.money = 100;

    const offer = p.neighborTradeOffer();
    const moneyBefore = p.money;
    const traded = p.tradeWithNeighbor();
    return {
      offer,
      traded,
      moneyDelta: moneyBefore - p.money,
      basket: { ...hot.carriers.basket1 },
      neighborLeftAfterTrade: !p._neighbor || p._neighbor.state === 'leaving',
    };
  });
  if (!trade.traded) fail(`#294 neighbor: tradeWithNeighbor() returned false (${JSON.stringify(trade)})`);
  if (trade.moneyDelta !== trade.offer.price) fail(`#294 neighbor: trade charged ${trade.moneyDelta}, expected offer price ${trade.offer.price}`);
  if (trade.basket.content !== trade.offer.give.content || trade.basket.count !== trade.offer.give.qty) {
    fail(`#294 neighbor: basket after trade = ${JSON.stringify(trade.basket)}, expected ${JSON.stringify(trade.offer.give)}`);
  }
  console.log(`Neighbor trade (#294): ${JSON.stringify(trade)}`);

  // Gift: spawn a fresh neighbor (the traded one just left), equip a basket holding
  // something, and gift it repeatedly — the relationship score must tick up by
  // exactly one per gift and level up on crossing the first threshold (mirrors the
  // bird-befriending rigor above).
  const gift = await page.evaluate(async () => {
    const g = window.__game, p = g.scene.getScene('PaddockScene');
    const { NEIGHBOR_GIFT_THRESHOLDS } = await import('/src/data/neighbor.js');
    // Wait for the previous (traded-with) neighbor to fully leave so a new one can spawn.
    const waitLeave = async () => {
      let waited = 0;
      while (p._neighbor && waited < 5000) { await new Promise((r) => setTimeout(r, 100)); waited += 100; }
    };
    await waitLeave();
    p._spawnNeighbor();
    await new Promise((r) => {
      const check = () => (p._neighbor?.state === 'visiting' ? r() : setTimeout(check, 100));
      check();
    });

    const hot = g.scene.getScene('HotbarScene');
    hot.activeSlot = hot.hotbar.indexOf('basketGroup');
    hot.activeCarrier.basket = 'basket1';
    hot.carriers.basket1 = { content: 'apple', count: 10 };

    const scoreBefore = p._neighborScore;
    const n = NEIGHBOR_GIFT_THRESHOLDS[0];
    for (let i = 1; i <= n; i++) {
      hot.carriers.basket1 = { content: 'apple', count: 10 }; // keep something to give each round
      const gifted = p.giftNeighborWithActiveItem();
      if (!gifted) return { error: `gift ${i} returned false`, scoreBefore, score: p._neighborScore };
    }
    return {
      scoreBefore, scoreAfter: p._neighborScore, gifts: n,
      threshold: NEIGHBOR_GIFT_THRESHOLDS[0],
    };
  });
  if (gift.error) fail(`#294 neighbor gifting: ${gift.error}`);
  if (gift.scoreAfter !== gift.scoreBefore + gift.gifts) {
    fail(`#294 neighbor gifting: score went ${gift.scoreBefore} → ${gift.scoreAfter}, expected +${gift.gifts}`);
  }
  if (gift.scoreAfter < gift.threshold) {
    fail(`#294 neighbor gifting: score ${gift.scoreAfter} never reached the first threshold ${gift.threshold}`);
  }
  console.log(`Neighbor gifting (#294): ${JSON.stringify(gift)}`);

  // Persistence: the relationship score must survive a reload (mirrors the fox-taming
  // counter / bird-friendship tally persistence checks above).
  await page.reload({ waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.isActive('PaddockScene') && g.registry.get('allHorses'));
  }, { timeout: 45000, polling: 200 });
  const neighborPersist = await page.evaluate(() => {
    const p = window.__game.scene.getScene('PaddockScene');
    return { score: p._neighborScore };
  });
  if (neighborPersist.score !== gift.scoreAfter) {
    fail(`#294 neighbor persistence: score ${gift.scoreAfter} did not survive reload (got ${neighborPersist.score})`);
  }
  console.log(`Neighbor persistence (#294): ${JSON.stringify(neighborPersist)}`);

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
