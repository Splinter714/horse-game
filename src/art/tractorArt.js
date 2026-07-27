// Drivable tractor art (#264) — a simple, chunky pixel-art farm tractor: a boxy
// cab + hood on big rear wheels + small front wheels, side-view like the horse/
// player. One idle frame + a 2-frame "driving" bounce (the whole body bobs on its
// wheels) so it reads as moving without needing a wheel-spin animation. The body
// color is customizable (a handful of paint swatches, mirrored on the horse coat /
// customizer pattern) — everything else (wheels, glass, exhaust) stays fixed so a
// recolor is just a body-tint swap.
//
// Dissect tags (`g.layer(...)`) sprinkled per CLAUDE.md so the dev dissect tool can
// break it into named parts.

import { gen } from './_frames.js';

// A no-op shim so this file's `g.layer(...)` calls are harmless when `gen` hands us
// a plain (non-capture) Graphics — mirrors propArt.js's withLayer.
const withLayer = (g) => (g.layer ??= () => {}, g);

// Paint swatches (#264 v1: a handful of fixed colors, cycled via an in-world
// interaction — mirrors the coat-table pattern used for horses/chickens, just a
// flat list since the tractor has one paintable part). Each entry: base / highlight
// / shadow tones for the body panels.
export const TRACTOR_COLORS = [
  { id: 'barnRed',    label: 'Barn Red',    base: 0xb23a2e, hi: 0xd15a44, lo: 0x832418 },
  { id: 'meadowGreen',label: 'Meadow Green',base: 0x3f8a3a, hi: 0x5cae54, lo: 0x28621f },
  { id: 'skyBlue',    label: 'Sky Blue',    base: 0x3a7ab2, hi: 0x5aa0d6, lo: 0x235a86 },
  { id: 'sunYellow',  label: 'Sun Yellow',  base: 0xd6a83a, hi: 0xf0c85e, lo: 0xa47d20 },
  { id: 'blossomPink',label: 'Blossom Pink',base: 0xd0708c, hi: 0xe796ab, lo: 0xa14e66 },
];
export const DEFAULT_TRACTOR_COLOR = 'barnRed';

export function tractorColor(id) {
  return TRACTOR_COLORS.find(c => c.id === id) ?? TRACTOR_COLORS[0];
}

// Build the two textures a driven tractor needs: `tractor_idle` (parked) and
// `tractor_drive_0`/`tractor_drive_1` (a subtle up/down bob while moving), all
// keyed by the chosen paint color so re-painting just regenerates these three.
// Side-view, facing right by default (flipX mirrors it, like the horse).
export function buildTractorTextures(scene, colorId = DEFAULT_TRACTOR_COLOR) {
  const paint = tractorColor(colorId);
  const draw = (g0, bob) => {
    const g = withLayer(g0);
    const { base, hi, lo } = paint;
    const glass = 0xbfe6f5, glassHi = 0xe4f6ff;
    const metal = 0x8a8f96, metalHi = 0xb0b6bc, metalLo = 0x63676d;
    const tire = 0x2a2a2a, tireHi = 0x4a4a4a, hub = 0xc9c9c9;

    g.layer('shadow');
    g.fillStyle(0x000000, 0.18); g.fillEllipse(34, 46, 58, 8);

    // Rear (big) wheel + front (small) wheel — drawn first so the body overlaps them.
    g.layer('wheels');
    const wy = 40 + bob;
    g.fillStyle(tire, 1); g.fillCircle(18, wy, 15);
    g.fillStyle(tireHi, 1); g.fillCircle(18, wy - 3, 6);
    g.fillStyle(hub, 1); g.fillCircle(18, wy, 5);
    g.fillStyle(tire, 1); g.fillCircle(52, wy + 4, 9);
    g.fillStyle(tireHi, 1); g.fillCircle(52, wy + 1, 3.5);
    g.fillStyle(hub, 1); g.fillCircle(52, wy + 4, 3);

    // Chassis / hood — the long low nose out to the front wheel.
    g.layer('body');
    const by = 20 + bob;
    g.fillStyle(lo, 1); g.fillRect(30, by + 14, 30, 10);
    g.fillStyle(base, 1); g.fillRect(30, by + 6, 28, 14);
    g.fillStyle(hi, 1); g.fillRect(30, by + 6, 28, 3);
    // Engine hood taper toward the front wheel.
    g.fillStyle(base, 1); g.fillTriangle(58, by + 8, 66, by + 16, 58, by + 20);
    g.fillStyle(hi, 1); g.fillTriangle(58, by + 8, 63, by + 10, 58, by + 12);

    // Cab — boxy with a glass window, sat over the rear wheel.
    g.layer('cab');
    g.fillStyle(base, 1); g.fillRect(6, by - 16, 26, 24);
    g.fillStyle(hi, 1); g.fillRect(6, by - 16, 26, 3);
    g.fillStyle(lo, 1); g.fillRect(6, by + 4, 26, 4);
    g.layer('glass');
    g.fillStyle(glass, 1); g.fillRect(10, by - 12, 18, 12);
    g.fillStyle(glassHi, 0.8); g.fillRect(11, by - 11, 7, 4);

    // Exhaust pipe + a little puff for character.
    g.layer('exhaust');
    g.fillStyle(metal, 1); g.fillRect(34, by - 6, 3, 12);
    g.fillStyle(metalHi, 1); g.fillRect(34, by - 6, 1, 12);
    g.fillStyle(0xd8d8d8, 0.5); g.fillCircle(35, by - 10, 3);

    // Front grille + headlight, seat back.
    g.layer('details');
    g.fillStyle(metalLo, 1); g.fillRect(56, by + 8, 4, 8);
    g.fillStyle(0xf0e08a, 1); g.fillCircle(60, by + 9, 2);
    g.fillStyle(lo, 1); g.fillRect(10, by - 18, 8, 6); // seat back peeking over the cab
  };

  gen(scene, 'tractor_idle', 68, 52, (g) => draw(g, 0));
  gen(scene, 'tractor_drive_0', 68, 52, (g) => draw(g, 0));
  gen(scene, 'tractor_drive_1', 68, 52, (g) => draw(g, -2));

  // Front/back (driving up/down) views — #264 playtest follow-up: the tractor only
  // had the one side silhouette, so driving north/south read identically to east/
  // west. Mirrors the player's own up/down art (playerArt.js): a straight-on view,
  // symmetric left/right (no flipX needed), same 2-frame bob for the "moving" read.
  // Simpler than the side profile (no hood taper in silhouette either direction),
  // but keeps the same palette/parts so it reads as the same vehicle.
  const drawFrontBack = (g0, bob, rear) => {
    const g = withLayer(g0);
    const { base, hi, lo } = paint;
    const glass = 0xbfe6f5, glassHi = 0xe4f6ff;
    const metal = 0x8a8f96, metalHi = 0xb0b6bc;
    const tire = 0x2a2a2a, tireHi = 0x4a4a4a, hub = 0xc9c9c9;

    g.layer('shadow');
    g.fillStyle(0x000000, 0.18); g.fillEllipse(34, 46, 46, 8);

    // Wheels, one either side, wider stance than the side view's single pair.
    // #355: wheels are mounted crosswise on the tractor body (their axle runs
    // side-to-side), so the side view sees a wheel's round FACE (a circle is
    // correct there) but the front/back view looks straight down that axle —
    // we see the tire edge-on, a narrow vertical tread band, not the same round
    // face. Drawing a full circle here (carried over from the side art) read as
    // a sideways/wrong-orientation wheel even while driving up/down.
    g.layer('wheels');
    const wy = 40 + bob;
    const drawWheel = (x) => {
      g.fillStyle(tire, 1); g.fillEllipse(x, wy, 14, 27);
      g.fillStyle(tireHi, 1); g.fillEllipse(x - 3, wy - 4, 4, 10);
      g.fillStyle(hub, 1); g.fillEllipse(x, wy, 5, 9);
    };
    drawWheel(14);
    drawWheel(54);

    // Body — a straight-on box, centred between the wheels.
    g.layer('body');
    const by = 18 + bob;
    g.fillStyle(lo, 1); g.fillRect(18, by + 14, 32, 10);
    g.fillStyle(base, 1); g.fillRect(18, by + 4, 32, 14);
    g.fillStyle(hi, 1); g.fillRect(18, by + 4, 32, 3);

    // Cab — sits centred atop the body, same glass either front or back (kid-scale
    // pixel art, not worth a literal windshield-vs-rear-window distinction).
    g.layer('cab');
    g.fillStyle(base, 1); g.fillRect(22, by - 18, 24, 22);
    g.fillStyle(hi, 1); g.fillRect(22, by - 18, 24, 3);
    g.fillStyle(lo, 1); g.fillRect(22, by + 2, 24, 4);
    g.layer('glass');
    g.fillStyle(glass, 1); g.fillRect(26, by - 14, 16, 12);
    g.fillStyle(glassHi, 0.8); g.fillRect(27, by - 13, 6, 4);

    // Exhaust only reads on the back view (mounted behind the cab, toward camera
    // when driving away/"up") — a small distinguishing detail between the two.
    if (rear) {
      g.layer('exhaust');
      g.fillStyle(metal, 1); g.fillRect(46, by - 8, 3, 12);
      g.fillStyle(metalHi, 1); g.fillRect(46, by - 8, 1, 12);
      g.fillStyle(0xd8d8d8, 0.5); g.fillCircle(47, by - 12, 3);
    } else {
      // Headlights read on the front ("down"/toward-camera) view instead.
      g.layer('details');
      g.fillStyle(0xf0e08a, 1); g.fillCircle(23, by + 8, 2.2);
      g.fillStyle(0xf0e08a, 1); g.fillCircle(45, by + 8, 2.2);
    }
  };

  gen(scene, 'tractor_up_0', 68, 52, (g) => drawFrontBack(g, 0, true));
  gen(scene, 'tractor_up_1', 68, 52, (g) => drawFrontBack(g, -2, true));
  gen(scene, 'tractor_down_0', 68, 52, (g) => drawFrontBack(g, 0, false));
  gen(scene, 'tractor_down_1', 68, 52, (g) => drawFrontBack(g, -2, false));
}
