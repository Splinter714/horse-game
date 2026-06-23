// Coat definitions. A coat is pure data: swapping these values changes how the
// horse is drawn (palette + markings), so a whole stable of distinct horses costs
// no new code — this is the "one body, many coats" system from the plan.
//
// Each color group is a 3-tone ramp: hi (highlight), mid (base), lo (shadow).

export const COATS = {
  palomino: {
    label: 'Palomino',
    body: { hi: 0xe0b850, mid: 0xc89830, lo: 0xa87820 },
    mane: { hi: 0xece0b0, mid: 0xd8c890, lo: 0xc8b878 },
    hoof: 0x3a2a10,
    eye: 0x1a0e00,
    markings: { star: true, sock: true }
  },
  bay: {
    label: 'Bay',
    body: { hi: 0xb86c34, mid: 0x9a5424, lo: 0x7a4018 },
    mane: { hi: 0x2a1810, mid: 0x1a0e08, lo: 0x140a04 },
    hoof: 0x0a0604,
    eye: 0x0a0604,
    markings: { star: false, sock: false }
  },
  dappleGrey: {
    label: 'Dapple grey',
    body: { hi: 0xb4b4b0, mid: 0x9a9a96, lo: 0x7a7a76 },
    mane: { hi: 0x6a6a66, mid: 0x5a5a56, lo: 0x4a4a46 },
    hoof: 0x2a2a28,
    eye: 0x1a1a18,
    markings: { star: false, sock: false, dapples: true }
  },
  black: {
    label: 'Black',
    body: { hi: 0x3a3838, mid: 0x262424, lo: 0x161414 },
    mane: { hi: 0x161414, mid: 0x0a0808, lo: 0x000000 },
    hoof: 0x000000,
    eye: 0x000000,
    markings: { star: false, sock: true, blaze: true }
  },
  paint: {
    label: 'Paint',
    body: { hi: 0xd8c8a0, mid: 0xc0a878, lo: 0x9a8458 },
    mane: { hi: 0xf0e8d0, mid: 0xd8c898, lo: 0xb8a870 },
    hoof: 0x2a2010,
    eye: 0x1a1008,
    markings: { star: true, sock: true, paint: true }
  },
  chestnut: {
    label: 'Chestnut',
    body: { hi: 0xc86030, mid: 0xa84820, lo: 0x843414 },
    mane: { hi: 0xd08050, mid: 0xb86030, lo: 0x984020 },
    hoof: 0x2a1408,
    eye: 0x1a0804,
    markings: { star: true, sock: false }
  },
  cremello: {
    label: 'Cremello',
    body: { hi: 0xf4ead0, mid: 0xe8d8b0, lo: 0xd0bc8c },
    mane: { hi: 0xfffaf0, mid: 0xf4ead4, lo: 0xe0d0b0 },
    hoof: 0xc0a878,
    eye: 0x6090b0,
    markings: { star: false, sock: false }
  },
  friesian: {
    label: 'Friesian',
    body: { hi: 0x2c2a2a, mid: 0x181616, lo: 0x0a0808 },
    mane: { hi: 0x222020, mid: 0x0e0c0c, lo: 0x020000 },
    hoof: 0x000000,
    eye: 0x000000,
    markings: { star: false, sock: false, feather: true }
  },
  // ── More real-world coats (#2 Phase 1) ──────────────────────────────────────
  buckskin: {
    label: 'Buckskin',
    body: { hi: 0xd8b466, mid: 0xc09a48, lo: 0x9c7c34 },
    mane: { hi: 0x241810, mid: 0x120a04, lo: 0x040200 }, // black points
    hoof: 0x161008, eye: 0x0a0604,
    markings: { sock: true }
  },
  grey: {
    label: 'Grey',
    body: { hi: 0xcacac6, mid: 0xb2b2ae, lo: 0x919190 },
    mane: { hi: 0xbcbcb8, mid: 0xa2a2a0, lo: 0x868684 },
    hoof: 0x33322f, eye: 0x1a1a18,
    markings: {}
  },
  sealBrown: {
    label: 'Seal Brown',
    body: { hi: 0x4a3826, mid: 0x342416, lo: 0x1e140a },
    mane: { hi: 0x1a1410, mid: 0x0c0805, lo: 0x020100 },
    hoof: 0x0a0604, eye: 0x0a0402,
    markings: { star: true }
  },
  flaxenChestnut: {
    label: 'Flaxen Chestnut',
    body: { hi: 0xb86838, mid: 0x9c5226, lo: 0x7c3c18 },
    mane: { hi: 0xe8d8b0, mid: 0xd0bc90, lo: 0xb09c70 }, // pale flaxen mane
    hoof: 0x2a1408, eye: 0x1a0804,
    markings: { star: true, stripe: true }
  },
  blueRoan: {
    label: 'Blue Roan',
    body: { hi: 0x4a4a52, mid: 0x363640, lo: 0x24242c },
    mane: { hi: 0x161416, mid: 0x0a080a, lo: 0x020002 },
    hoof: 0x080608, eye: 0x080608,
    markings: { roan: true, sock: true }
  },
  redRoan: {
    label: 'Red Roan',
    body: { hi: 0xb05838, mid: 0x984828, lo: 0x76341c },
    mane: { hi: 0x8c4626, mid: 0x70361c, lo: 0x562810 },
    hoof: 0x2a1408, eye: 0x1a0804,
    markings: { roan: true, star: true }
  }
};

export function getCoat(key) {
  return COATS[key] || COATS.palomino;
}
