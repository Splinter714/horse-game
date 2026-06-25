// Modularity guards (issue #167). These protect the file split that keeps parallel
// worktrees from colliding. They're STATIC source checks (read the files, parse the
// text) rather than runtime reflection on purpose: the scene/mixin files import
// Phaser, which doesn't load in vitest's `node` environment. Parsing the source
// keeps these guards fast, Phaser-free, and able to run alongside the data tests.
//
// What lives here:
//   C1 — no two mixins in the same composition group define the same method name
//        (the core failure mode of the functional-mixin pattern: a silent override).
//   (C2 import-boundary / fixture-species / literal-tripwire seam guards and the
//    file-size budget are added here as their phases land.)

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const scenesDir = fileURLToPath(new URL('./', import.meta.url));
const read = (rel) => readFileSync(scenesDir + rel, 'utf8');
const listMixins = (subdir) =>
  readdirSync(scenesDir + subdir)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'constants.js')
    .map((f) => subdir + f);

// A "composition group" is one class + the mixins it's composed from — i.e. one
// prototype chain. Method names must be unique WITHIN a group (a collision silently
// overrides); they may freely repeat ACROSS groups (separate scenes/prototypes).
const GROUPS = {
  // The PaddockScene prototype chain: the core scene file + every paddock/ mixin.
  paddock: ['PaddockScene.js', ...listMixins('paddock/')],
  // The HotbarScene prototype chain: the core scene file + every hotbar/ mixin.
  hotbar: ['HotbarScene.js', ...listMixins('hotbar/')],
};

// Class methods in this codebase sit at exactly 2-space indentation:
//   `  showHeart(sprite) {`  /  `  _saveAnimal(model) {`
// Pull those names out without executing the file. Control keywords (`if (x) {`)
// share that shape, so they're filtered out.
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function',
  'constructor', 'do', 'else', 'with',
]);

function methodNames(src) {
  const names = [];
  for (const line of src.split('\n')) {
    const m = /^ {2}(?:async\s+|get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/.exec(line);
    if (m && !KEYWORDS.has(m[1])) names.push(m[1]);
  }
  return names;
}

describe('C1: no duplicate method names within a composition group', () => {
  for (const [group, files] of Object.entries(GROUPS)) {
    it(`${group} mixins define each method exactly once`, () => {
      const owner = new Map(); // method name -> file that first defined it
      const collisions = [];
      for (const file of files) {
        for (const name of methodNames(read(file))) {
          if (owner.has(name)) {
            collisions.push(`${name}: ${owner.get(name)} & ${file}`);
          } else {
            owner.set(name, file);
          }
        }
      }
      expect(collisions, `duplicate method names (silent overrides):\n${collisions.join('\n')}`)
        .toEqual([]);
    });
  }
});
