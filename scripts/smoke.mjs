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

// `?canvas` forces Phaser's Canvas renderer (headless Chromium lacks WebGL
// framebuffers). The logic we assert on here is renderer-agnostic.
const URL = process.env.SMOKE_URL || 'http://localhost:5173/horse-game/?canvas';

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
      'onPhaseChange', 'doAction', 'depthSort', 'tickDecay',
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

    return {
      renderer: g.config.renderType, // 1=Canvas, 2=WebGL
      movementOk, movementError,
      horseCount: Object.keys(horses).length,
      chickenCount: Object.keys(chickens).length,
      sampleHorse: { name: h.name, species: h.species, hasMood: typeof h.mood === 'function' },
      activeScenes: g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
      feedDelta,
      missingMethods,
      horsesInScene: paddock.horses?.length ?? 0,
      hasFarmStand: !!paddock.farmStand,
    };
  });

  await page.screenshot({ path: '/tmp/horsegame-smoke.png' });

  // Unified info panel: open it for a horse (stat bars + action buttons) and a
  // chicken (identity only) — both go through the single InfoPanelScene.
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
  if (!result.movementOk) fail('creature movement/pathfinding threw: ' + result.movementError);
  if (!result.horsePanel.active) fail('InfoPanelScene did not open for a horse');
  if (result.horsePanel.parts < 15) fail(`horse panel looks too sparse (parts=${result.horsePanel.parts}) — stat bars/buttons missing?`);
  if (!result.chickenPanel.active) fail('InfoPanelScene did not open for a chicken');

  if (!process.exitCode) console.log('SMOKE OK ✔  (screenshot: /tmp/horsegame-smoke.png)');
} catch (e) {
  fail(e.message + (pageErrors.length ? '\npageErrors:\n' + pageErrors.join('\n') : ''));
} finally {
  await browser.close();
}
