// The three demo foals shown in the dev Art-Preview gallery. They aren't part of the
// persisted herd (not in allHorses) — they're fixed sample art. This is the single
// source of truth for their coats: art/index.js builds their textures from it, and the
// customizer seeds in-memory editable models from it so the foal can be art-directed
// with the same rich horse editor (it's just a young horse, same coat system).
//
// Editable shape mirrors a horse model enough for the editor: { coat, markings, name,
// breed, sex }. No persistence — edits live only for the session (live-recolor only).

export const DEMO_FOALS = {
  foal1: { coat: 'grey',     markings: { dapples: true }, name: 'Foal', breed: 'Dapple grey',   sex: 'female', age: 0 },
  foal2: { coat: 'chestnut', markings: { pinto: true },   name: 'Foal', breed: 'Chestnut pinto', sex: 'male',   age: 0 },
  foal3: { coat: 'bay',      markings: {},                name: 'Foal', breed: 'Bay',            sex: 'female', age: 0 },
};
