// Modularity guards (issue #167). These protect the file split that keeps parallel
// worktrees from colliding. They're STATIC source checks (read the files, parse the
// text) rather than runtime reflection on purpose: the scene/mixin files import
// Phaser, which doesn't load in vitest's `node` environment. Parsing the source
// keeps these guards fast, Phaser-free, and able to run alongside the data tests.
//
// What lives here:
//   C1 — no two mixins in the same composition group define the same method name
//        (the core failure mode of the functional-mixin pattern: a silent override).
//   Size budget — no scene file grows back into a mega-file (the thing #167 fixed).
//   (C2 import-boundary / fixture-species / literal-tripwire seam guards are added
//    here as Phase B lands.)

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const scenesDir = fileURLToPath(new URL('./', import.meta.url));
const read = (rel) => readFileSync(scenesDir + rel, 'utf8');
const listMixins = (subdir) =>
  readdirSync(scenesDir + subdir)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'constants.js')
    .map((f) => subdir + f);

// Every .js (non-test) under src/scenes, recursively, as paths relative to it.
const walkJs = (subdir = '') =>
  readdirSync(scenesDir + subdir, { withFileTypes: true }).flatMap((ent) =>
    ent.isDirectory()
      ? walkJs(subdir + ent.name + '/')
      : ent.name.endsWith('.js') && !ent.name.endsWith('.test.js')
        ? [subdir + ent.name]
        : []);

// A "composition group" is one class + the mixins it's composed from — i.e. one
// prototype chain. Method names must be unique WITHIN a group (a collision silently
// overrides); they may freely repeat ACROSS groups (separate scenes/prototypes).
const GROUPS = {
  // The PaddockScene prototype chain: the core scene file + every paddock/ mixin.
  paddock: ['PaddockScene.js', ...listMixins('paddock/')],
  // The HotbarScene prototype chain: the core scene file + every hotbar/ mixin.
  hotbar: ['HotbarScene.js', ...listMixins('hotbar/')],
  // The customizer is composed (shell + horse sections) into two hosts: the in-world
  // info panel and the standalone art-preview host. Each host + the shared customizer/
  // mixins is one prototype chain, so method names must be unique within each (#165).
  infopanel: ['InfoPanelScene.js', ...listMixins('customizer/')],
  customizer: ['CustomizerScene.js', ...listMixins('customizer/')],
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

describe('size budget: scene files stay small (no new mega-files)', () => {
  // The whole point of #167: keep concerns split so parallel worktrees rarely
  // touch the same file. A new file that blows past this budget is doing too many
  // jobs — split it into a concern mixin instead.
  const BUDGET = 500;
  // Known oversized files not yet split — visible debt that should shrink, never
  // grow. Each entry is self-cleaning (see below): drop it once the file is split.
  const ALLOW = {
    'paddock/creatures.js': 'generic creature spawn/movement — split tracked in #169',
  };

  for (const rel of walkJs()) {
    const lines = read(rel).split('\n').length;
    if (rel in ALLOW) {
      // Self-cleaning: when an allowlisted file finally drops under budget (it got
      // split), this fails — a nudge to remove the now-stale ALLOW entry.
      it(`${rel} is still oversized (allowlisted: ${ALLOW[rel]})`, () => {
        expect(lines, `${rel} is now ${lines} <= ${BUDGET} lines — remove it from ALLOW`)
          .toBeGreaterThan(BUDGET);
      });
    } else {
      it(`${rel} (${lines} lines) is within the ${BUDGET}-line budget`, () => {
        expect(lines, `${rel} has ${lines} lines (> ${BUDGET}); split it into a concern mixin (#167)`)
          .toBeLessThanOrEqual(BUDGET);
      });
    }
  }
});
