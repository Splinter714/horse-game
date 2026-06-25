// Procedural audio — barrel. The synth was split into concern modules (core mixer +
// primitives, sfx one-shots, ambient wind/music) for navigability (issue #167); this
// re-exports their API so the existing import sites keep importing from
// './audio/sounds.js' unchanged.
export * from './core.js';
export * from './sfx.js';
export * from './ambient.js';
