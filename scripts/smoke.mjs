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

    // Exercise the single-apply care path: drop hunger then feed once via the
    // event UI panels use. Expect exactly +35 (double-apply would give +70).
    h.stats.hunger = 10;
    g.events.emit('horse-action', { type: 'feed', horseKey: 'horse' });
    const feedDelta = h.stats.hunger - 10;

    // Guard the PaddockScene mixin split: every concern's entry points must still
    // resolve on the prototype chain, and the scene state they own must exist.
    const paddock = g.scene.getScene('PaddockScene');
    const expectMethods = [
      'buildWorld', 'buildObstacles', 'buildFarmStand', '_npcShop', 'stockStand',
      'buildPlayer', 'movePlayer', 'handleTap', '_findPath', 'gatherFrom',
      'mountHorse', 'dismount', 'toggleSaddle', 'toggleLead',
      'horseTick', 'horseGoEat', 'horseGoDrink', 'spawnHorse', 'spawnAnimal',
      'separateHorses', '_horseBeg', '_begWait',
      'runBehaviors', '_horseContext', '_chickenContext', '_nearestReachableHay',
      'onPhaseChange', 'doAction', 'depthSort', 'tickDecay',
      // Extracted concern mixins (issue #167): effects / persistence / rendering.
      'showHeart', 'showIcon', '_saveHorses', '_saveAnimal', 'tickAutosave', 'updateSaddles', 'updateFoals',
      // worldObjects: food drops / trough / gate.
      'placeFood', '_freeFoodSpot', 'fillTrough', '_setTroughLevel', 'toggleGate',
      // careActions: tool-on-horse, cow care, panel action dispatch.
      'useItemOnHorse', 'feedCow', 'waterCow', 'milkCow', '_afterCowCare',
      // interaction: pet/info cluster + info-panel openers.
      'petAnimal', '_petPreferenceProximity', '_maybeGreetOnApproach', 'openProxInfo',
      'openPortrait', 'openChickenInfo', 'openCreatureInfo', '_openInfoPanel',
      // input: gamepad poll, pause overlay, input-mode + prompt toggles.
      '_pollRawPad', '_togglePause', '_syncInputMode', '_onPromptsChanged',
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
    // eats it — hay/apple/carrot = horse count, seed = chicken count — capped at the
    // carrier capacity. Non-food (water) ignores demand and fills to capacity.
    const gatherTargets = {
      hay:    paddock._gatherTarget('hay', 10),
      apple:  paddock._gatherTarget('apple', 10),
      carrot: paddock._gatherTarget('carrot', 10),
      seed:   paddock._gatherTarget('seed', 10),
      water:  paddock._gatherTarget('water', 1),
    };

    return {
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
      // Display scales: the horse uses super-sampled (ART_SCALE×) art shown at S/ART_SCALE;
      // chickens/cat use 1× art shown at the full S. A broad edit once shrank the chickens/
      // cat to the horse's divided scale, so guard that the chicken scale is ART_SCALE×
      // the horse's (i.e. they weren't accidentally shrunk).
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
    info.custExit();
    await new Promise((r) => setTimeout(r, 60));
    return {
      opened, focusCount, paused, coat,
      resumed: !g.scene.isPaused('PaddockScene') && info._mode === 'info',
      noStable: !g.scene.getScene('ManagementPanelScene'),
    };
  });
  await page.screenshot({ path: '/tmp/panel-editor.png' });

  console.log(JSON.stringify(result, null, 2));

  if (pageErrors.length) fail('uncaught page errors:\n' + pageErrors.join('\n'));
  if (consoleErrors.length) fail('console errors:\n' + consoleErrors.join('\n'));
  if (result.horseCount !== 7) fail(`expected 7 horses, got ${result.horseCount}`);
  if (result.chickenCount !== 5) fail(`expected 5 chickens, got ${result.chickenCount}`);
  if (result.feedDelta !== 35) fail(`care action applied ${result.feedDelta}, expected 35 (double-apply regression?)`);
  if (!result.sampleHorse.hasMood) fail('horse missing mood() — model not wired');
  if (result.missingMethods.length) fail('PaddockScene missing methods (mixin not wired?): ' + result.missingMethods.join(', '));
  if (result.horsesInScene !== 7) fail(`expected 7 horse sprites in scene, got ${result.horsesInScene}`);
  if (!result.hasFarmStand) fail('farm stand not built — farmStand mixin not wired');
  if (Math.abs(result.scaleRatio - 4) > 0.01) fail(`chicken/horse display-scale ratio ${result.scaleRatio} ≠ ART_SCALE (4) — chickens/cat wrongly sized?`);
  if (!result.movementOk) fail('creature movement/pathfinding threw: ' + result.movementError);
  if (result.behaviorDecision !== 'seekFood') fail(`hungry horse with hay nearby did not select seekFood (got ${result.behaviorDecision})`);
  // #136: gather one food per animal that eats it, water → capacity. Hay/apple/carrot
  // are eaten by the 7 horses AND the cow (#cow), so a full gather targets 8.
  const gt = result.gatherTargets;
  for (const food of ['hay', 'apple', 'carrot']) {
    if (gt[food] !== 8) fail(`gather target for ${food} = ${gt[food]}, expected 8 (7 horses + 1 cow, #136/#cow)`);
  }
  if (gt.seed !== 5) fail(`gather target for seed = ${gt.seed}, expected 5 (one per chicken, #136)`);
  if (gt.water !== 1) fail(`gather target for water = ${gt.water}, expected 1 (capacity — water ignores demand)`);
  if (!result.horsePanel.active) fail('InfoPanelScene did not open for a horse');
  if (result.horsePanel.parts < 15) fail(`horse panel looks too sparse (parts=${result.horsePanel.parts}) — identity/stat bars missing?`);
  if (!result.chickenPanel.active) fail('InfoPanelScene did not open for a chicken');
  if (!result.editor.opened) fail('appearance editor did not open from the info panel');
  if (result.editor.focusCount < 20) fail(`editor registered too few focusables (${result.editor.focusCount})`);
  if (!result.editor.paused) fail('world was not paused while editing');
  if (result.editor.coat !== 'grey') fail(`coat edit did not apply (got ${result.editor.coat})`);
  if (!result.editor.resumed) fail('world/info not restored after closing the editor');
  if (!result.editor.noStable) fail('ManagementPanelScene still registered (should be removed)');

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
