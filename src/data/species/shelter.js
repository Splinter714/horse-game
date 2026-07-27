// Generic rain-shelter behavior (#319, generalized by #349). Species-NEUTRAL by
// design — exactly like ./swim.js: any species that wants it registers this one
// module (see ./index.js) and lists `seekShelter` in its `behaviors` array. No
// per-species code lives here.
//
// Originally this was a horse-only behavior pathing to a dedicated open-sided
// lean-to prop. #349 removed that prop and made the BARN the farm's shelter, so
// every pasture grazer (horse, cow, pig, sheep, goat, llama — the species with
// `capabilities.grazes` that roam the pasture) now heads into the barn when it
// starts raining and waits the spell out.
//
// Same { id, test, run } shape as every other species behavior: `test` is pure
// (unit-tested in ./shelter.test.js), `run` is the scene-coupled primitive
// (animalGoToShelter, scenes/paddock/horseAI.js).
//
// Priority note: species register this AFTER their real needs (food/water/begging)
// and BEFORE the ambient charm behaviors (graze/buddy/wallow), so a hungry animal
// still eats first, then comes back round on its next idle tick and goes inside
// instead of grazing in the rain.
//
// Fires for any idle/wandering animal while it's raining — animalGoToShelter is
// itself a no-op once the animal is already 'sheltering' (that state stops it from
// reaching this test at all: the AI tick only considers idle/wandering agents).
// _releaseSheltering (scenes/paddock/weather.js) hands everyone back to wandering
// when the rain clears.

import { WEATHER } from '../weather.js';

export const seekShelter = {
  id: 'seekShelter',
  test: (ctx) => ctx.weather === WEATHER.RAIN,
  run: (scene, a) => scene.animalGoToShelter(a),
};
