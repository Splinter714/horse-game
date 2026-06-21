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
  }
};

export function getCoat(key) {
  return COATS[key] || COATS.palomino;
}
