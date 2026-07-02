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

  it('world.js places BOTH a house and a barn prop', () => {
    expect(world).toMatch(/this\.props\.house\s*=/);
    expect(world).toMatch(/this\.props\.barn\s*=/);
  });

  it('world.js renders BOTH a house and a barn texture', () => {
    expect(world).toMatch(/'house'/);
    expect(world).toMatch(/'barn'/);
  });

  it('worldArt.js generates BOTH house and barn textures', () => {
    expect(worldArt).toMatch(/gen\(scene,\s*'house'/);
    expect(worldArt).toMatch(/gen\(scene,\s*'barn'/);
  });

  it('the barn is a separate structure, not at the house position', () => {
    // House sits at the NW home-base corner (240,280); the barn must be placed
    // somewhere else — a distinct building, per #241.
    expect(world).toMatch(/this\.add\.image\(240,\s*280,\s*'house'\)/);
    expect(world).not.toMatch(/this\.add\.image\(240,\s*280,\s*'barn'\)/);
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
