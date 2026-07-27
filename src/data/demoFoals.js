// The three demo foals shown in the dev Art-Preview gallery. They aren't part of the
// persisted herd (not in allHorses) — they're fixed sample art. This is the single
// source of truth for their coats: art/index.js builds their textures from it, and the
// customizer seeds in-memory editable models from it so the foal can be art-directed
// with the same rich horse editor (it's just a young horse, same coat system).
//
// Editable shape mirrors a horse model enough for the editor: { coat, markings, name,
// breed, sex }. No persistence — edits live only for the session (live-recolor only).
//
// KEY NAMING (#352 — do not use bare `foal<N>`): these keys are TEXTURE keys, and a
// real bred foal joins the herd under `foal1`, `foal2`, … (nextFoalKey, data/breeding.js).
// They used to be exactly `foal1`/`foal2`/`foal3`, so a player's own foal shared a
// texture key with a demo sample: the boot art builder drew the player's horse first
// and then RE-DREW `foal<N>_idle_*`/`walk_*`/`eat_*`/`sleep_*` with the demo's baby art
// on top. For a grown-up former foal that meant baby art on the shared frames while the
// adult-only posture/swish/roll frames stayed full-size — i.e. a horse that rendered as
// a FOAL while walking and as an ADULT while standing (the #339/#352 report). Prefixed
// keys make that collision impossible; the `demoFoalKeys` guard test locks it in.
export const DEMO_FOALS = {
  demoFoal1: { coat: 'grey',     markings: { dapples: true }, name: 'Foal', breed: 'Dapple grey',    sex: 'female', age: 0 },
  demoFoal2: { coat: 'chestnut', markings: { pinto: true },   name: 'Foal', breed: 'Chestnut pinto', sex: 'male',   age: 0 },
  demoFoal3: { coat: 'bay',      markings: {},                name: 'Foal', breed: 'Bay',            sex: 'female', age: 0 },
};
