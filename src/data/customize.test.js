// Customizer schema (#44 + #165): the data-driven "parts" model. The player added a
// new flavour of part — shape OPTION parts (hairstyle / sleeves / bottoms) alongside the
// colour swatch parts every animal uses. These are pure tests of the schema + resolvers
// (defaultKeys / lookFromKeys / swatchTone); the art builders run in the browser/smoke.

import { describe, it, expect } from 'vitest';
import { CUSTOMIZE, defaultKeys, lookFromKeys, swatchTone, defaultLook } from './customize.js';

const PLAYER_PARTS = ['hairStyle', 'hair', 'skin', 'eyes', 'sleeves', 'shirt', 'bottom', 'bottomColor'];

describe('player customizer schema', () => {
  it('declares all 8 player parts in panel order', () => {
    expect(CUSTOMIZE.player.parts.map((p) => p.id)).toEqual(PLAYER_PARTS);
  });

  it('defaultKeys covers every part with its first choice', () => {
    const keys = defaultKeys('player');
    expect(Object.keys(keys).sort()).toEqual([...PLAYER_PARTS].sort());
    expect(keys).toMatchObject({ hairStyle: 'short', hair: 'auburn', skin: 'peach', sleeves: 'long', bottom: 'pants' });
  });

  it('lookFromKeys resolves colour parts to ramps and option parts to key strings', () => {
    const look = lookFromKeys('player', defaultKeys('player'));
    expect(look.hair).toMatchObject({ main: expect.any(Number) });
    expect(look.skin).toMatchObject({ main: expect.any(Number) });
    expect(look.eyes).toMatchObject({ color: expect.any(Number) });
    expect(look.shirt).toMatchObject({ main: expect.any(Number), shad: expect.any(Number) });
    expect(look.bottomColor).toMatchObject({ main: expect.any(Number), shad: expect.any(Number) });
    // Option parts resolve to the chosen KEY (a string the art reads for a body shape).
    expect(look.hairStyle).toBe('short');
    expect(look.sleeves).toBe('long');
    expect(look.bottom).toBe('pants');
  });

  it("default look reproduces today's appearance", () => {
    const look = defaultLook('player');
    expect(look.hair.main).toBe(0xc8844a);    // auburn
    expect(look.skin.main).toBe(0xf5c48a);    // peach
    expect(look.eyes.color).toBe(0x1a0a04);   // near-black
    expect(look.shirt.main).toBe(0x5aab8a);   // teal
    expect(look.bottomColor.main).toBe(0x7a5a38); // brown
  });

  it('resolves a chosen colour + shape', () => {
    const look = lookFromKeys('player', { ...defaultKeys('player'), hair: 'black', bottom: 'skirt', sleeves: 'none' });
    expect(look.hair.main).toBe(0x2a2424);
    expect(look.bottom).toBe('skirt');
    expect(look.sleeves).toBe('none');
  });

  it('falls back to the first choice for a stale/unknown key without throwing', () => {
    const look = lookFromKeys('player', { hair: 'chartreuse', hairStyle: 'mohawk', bottom: 'kilt' });
    expect(look.hair.main).toBe(0xc8844a); // first hair swatch
    expect(look.hairStyle).toBe('short');  // first option
    expect(look.bottom).toBe('pants');     // first option
  });
});

describe('swatchTone covers every ramp shape', () => {
  it('reads `main` for the player single-tone + clothing ramps', () => {
    expect(swatchTone({ main: 0x123456 })).toBe(0x123456);
    expect(swatchTone({ main: 0x123456, shad: 0x000001 })).toBe(0x123456);
  });
  it('still prefers the existing tone keys for animal ramps', () => {
    expect(swatchTone({ mid: 0xabcdef })).toBe(0xabcdef);
    expect(swatchTone({ color: 0xfedcba })).toBe(0xfedcba);
  });
});

describe('option parts do not regress the colour-only animal schemas', () => {
  it('cow still resolves palette parts to ramps', () => {
    expect(defaultKeys('cow')).toEqual({ coat: 'white', spots: 'black' });
    const look = lookFromKeys('cow', defaultKeys('cow'));
    expect(look.coat).toBeTypeOf('object'); // a ramp, not a key string
    expect(look.spots).toBeTypeOf('object');
  });
});
