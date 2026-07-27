// Barn/house concept split guards (#241). The world object that used to be the
// "barn" is really the player's HOUSE / home base; #241 rebranded it as the house
// and added a separate, distinct BARN building for the horses (interior is #35).
//
// Phaser doesn't load in the node test env, so these are static source checks (like
// the seam guards in seams.test.js): they lock in that the two concepts are separate
// props/textures and that home-base semantics anchor on the HOUSE, not the barn.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)); // src/
const read = (rel) => readFileSync(root + rel, 'utf8');

describe('#241 barn/house are distinct world objects', () => {
  const world = read('scenes/paddock/world.js');
  const worldArt = read('art/worldArt.js');

  const barn = read('scenes/paddock/barn.js');

  it('world.js places a house prop; the barn prop is set by the barn mixin (#35)', () => {
    expect(world).toMatch(/this\.props\.house\s*=/);
    // world.js delegates the barn build to the barn concern mixin, which sets the prop.
    expect(world).toMatch(/this\.buildBarn\(\)/);
    expect(barn).toMatch(/this\.props\.barn\s*=/);
  });

  it('renders a house texture (world.js) and barn textures (barn mixin, #35)', () => {
    expect(world).toMatch(/'house'/);
    // The walk-in barn (#35) is two stacked textures: interior + fading front façade.
    expect(barn).toMatch(/'barnInterior'/);
    expect(barn).toMatch(/'barnFront'/);
  });

  it('worldArt.js generates the house texture and BOTH barn textures (#35)', () => {
    expect(worldArt).toMatch(/gen\(scene,\s*'house'/);
    expect(worldArt).toMatch(/gen\(scene,\s*'barnInterior'/);
    expect(worldArt).toMatch(/gen\(scene,\s*'barnFront'/);
  });

  it('the barn is a separate structure, not at the house position', () => {
    // House sits at the NW home-base corner (219,283 after the #335 reposition); the
    // barn is placed elsewhere (its own anchor in barn.js), a distinct building per
    // #241/#35.
    expect(world).toMatch(/this\.add\.image\(219,\s*283,\s*'house'\)/);
    expect(barn).not.toMatch(/219,\s*283/);
  });
});

describe('#241 home-base semantics anchor on the HOUSE', () => {
  const dayNight = read('scenes/paddock/dayNight.js');
  const player = read('scenes/paddock/player.js');

  it('the home-base entry point reads props.house (cat home / night huddle)', () => {
    // The shared home anchor (_houseEntry) is what the cat go-home, night huddle,
    // and dog bed-down all use. It must read the HOUSE, not the barn.
    expect(dayNight).toMatch(/_houseEntry\s*\(\)\s*\{/);
    expect(dayNight).toMatch(/this\.props\.house/);
    expect(dayNight).not.toMatch(/_barnEntry\s*\(/);
  });

  it('the default player boot spawn falls back to the house', () => {
    expect(player).toMatch(/START_SPAWNS\.House/);
    expect(player).toMatch(/House:\s*\{/);
  });
});
