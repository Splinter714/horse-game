// Dev overlay: "how do I actually use this?" tooltips on world objects (#332).
//
// The third of the dev-only pause-menu toggles, after the object labels + grid
// (#329) and the drag-to-reposition tool (#330). Those two answer WHERE a thing
// is; this one answers WHAT TO DO WITH IT.
//
// Deliberately distinct from the normal in-world contextual prompts: those are a
// short action label shown only once you're already holding the right thing
// ("Fill Trough", "Spin Wool → Yarn"). These are longer explanatory sentences
// that show REGARDLESS of what you're carrying — the whole point is to explain
// the setup you'd need ("bring a basket of wool"), which the play-time prompt
// can't, because it only fires when you've already done it.
//
// Three constraints, mirroring the sibling dev tools:
//   1. Persisted dev setting (`usageTips`), DEFAULT OFF, live-togglable, and
//      available in production builds — the owner reads the game on his iPad, on
//      the deployed build, which is where "wait, how does the slop-maker work?"
//      actually gets asked.
//   2. ZERO gameplay effect. One screen-agnostic Text object on a high depth, no
//      input handlers, no obstacles, nothing built at all while it's off.
//   3. The object list is NOT hand-written — it reuses `_devLabelTargets()` from
//      devLabels.js (derived from `this.props`), same as the drag tool, so the
//      three dev tools can never drift apart as the world grows. This file only
//      adds the per-object PROSE, keyed by the same `name` those targets carry.
//
// ONE tooltip at a time (unlike #329's labels, which show every nearby object):
// these are full sentences, so several at once would paper over the screen. The
// single nearest tooltipped object within TIP_RADIUS wins.
//
// Objects with no good line are simply skipped rather than given filler — a
// missing entry means "nothing worth saying", not "unfinished".

import { loadDevSettings } from '../../data/save.js';
import { dprOf, logicalW } from '../uiUtils.js';

const TIP_DEPTH  = 9503;  // above the #329 labels (9501) and #330 drag marks (9502)
const TIP_RADIUS = 150;   // world px — a bit wider than #329's label radius, since
                          // only ONE shows at a time so there's no clutter risk
const FENCE_RADIUS = 90;  // world px to the nearest tie-able fence rail (#317)

// ─── The prose ───────────────────────────────────────────────────────────────
//
// Keyed by the `name` that `_devLabelTargets()` reports: a `this.props` key for
// named props (`slopMaker`, `trough`), the item's own `label` for list members
// that carry one (the gather sources: 'Hay Pile', 'Well', …), or `key[i]` for
// list members that don't ('nests[0]') — those match on the bare `key` via the
// index-stripping lookup in `_devTipFor` below.
//
// House note: the stove/cooking (#213/#41/#214) and the bed/dresser live INSIDE
// HouseInteriorScene, which is a different scene with no props of its own, so
// their instructions ride along on the front door here rather than needing a
// second copy of this overlay indoors.
export const USAGE_TIPS = {
  // ── Crafting / processing stations (the non-obvious ones) ──────────────────
  slopMaker:
    'Slop-Maker (#225): bring a BASKET holding a leftover cooked dish — stew, '
    + 'pie or bread — and press Use to grind the whole basket into pig slop. Then '
    + 'carry the slop to the pig and Use again to feed it.',
  spinningWheel:
    'Spinning Wheel (#233/#358): shear a sheep or llama for wool, then Use here to '
    + 'spin the whole load into yarn — from a BASKET of wool, or straight off the '
    + 'SHEARS you sheared it with. Yarn sells for more than raw wool at the stand.',
  kitchenCounter:
    'Kitchen Counter (#40): bring a BASKET of one raw crop — strawberries, wheat '
    + 'or carrots — and Use to process the lot into jam, flour or pig feed.',
  house:
    'House (#241/#56): interact bare-handed to go INSIDE. In there: the bed '
    + '(sleep), the dresser/mirror (change your look), the pantry, and the STOVE. '
    + 'At the stove, repeated taps cycle through ingredient PAIRS from the pantry; '
    + 'the prompt tells you whether the current pair cooks into something before '
    + 'you commit (#214 recipe discovery) — that is how sugar cubes, stew, pie and '
    + 'honey bread get made. Press the recipe-book key to see what you have found.',

  // ── Fill targets ──────────────────────────────────────────────────────────
  trough:
    'Water Trough: fill a BUCKET at the well or the stream, stand next to the '
    + 'trough and Use to pour it in. Repeat to top it right up — thirsty horses '
    + 'drink from it on their own.',
  catBowl:
    'Cat Bowl: scoop cat food into a BASKET at the kibble sack, or fill a BUCKET '
    + 'with water, then Use here to stock that side of the bowl. The cat eats and '
    + 'drinks from it by itself.',
  bunnyBowl:
    'Bunny Bowl: gather bunny food into a BASKET at the bunny hutch (or water into '
    + 'a BUCKET) and Use here to fill it. Keeping it stocked also lures more wild '
    + 'bunnies into the yard.',
  petBowls:
    'Pet Bowl: fill a carrier with the matching food (or water) at its source, then '
    + 'Use here to stock the bowl. The pet feeds itself from it.',
  seedFeeder:
    'Bird Feeder (#240): gather seed into a BASKET at the grain bin, then Use here '
    + 'to fill the hopper. Songbirds come to eat and slowly drain it — refill to '
    + 'keep them visiting.',
  nectarFeeder:
    'Hummingbird Feeder (#226): fill a BUCKET at the nectar jug by the house, then '
    + 'Use here to top it up. Hummingbirds sip from it and drain it over time.',

  // ── Harvest / gather ──────────────────────────────────────────────────────
  beehive:
    'Beehive (#239): honey ripens on its own. Once the hive reads as ready, stand '
    + 'here with a BASKET and Use to harvest the honey.',
  'Hay Pile':
    'Hay Pile: equip a BASKET and Use to gather hay. Then Use out in the pasture to '
    + 'drop a pile the horses will walk over and eat.',
  'Carrot Garden':
    'Carrot Garden: equip a BASKET and Use to gather carrots — horse food, and '
    + 'sellable at the farm stand.',
  'Apple Tree':
    'Apple Tree: equip a BASKET and Use to gather apples (horse food / sellable).',
  'Orange Tree':
    'Orange Tree: equip a BASKET and Use to gather oranges (sellable at the stand).',
  'Berry Bush':
    'Berry Bush: equip a BASKET and Use to pick berries (sellable, and a cooking '
    + 'ingredient).',
  'Grain Bin':
    'Grain Bin: equip a BASKET and Use to scoop seed — chicken feed, and what the '
    + 'bird feeder takes.',
  Well:
    'Well: equip a BUCKET and Use to draw water — for the trough, the pet water '
    + 'bowls, and watering the garden.',
  Stream:
    'Stream: same as the well — equip a BUCKET and Use at the bank to fill it with '
    + 'water. Handy when you are working the far side of the farm.',
  'Kibble Sack':
    'Kibble Sack: equip a BASKET and Use to scoop cat food, then pour it into the '
    + 'cat bowl.',
  'Bunny Hutch':
    'Bunny Hutch: equip a BASKET and Use to gather bunny food for the bunny bowl.',
  'Nectar Jug':
    'Nectar Jug (#226): equip a BUCKET and Use to fill it with sugar water for the '
    + 'hummingbird feeder.',
  'Fox Den':
    'Fox Den (#266): equip a BASKET and Use to take fox food, then Use out in the '
    + 'open to DROP a pile — repeat visits from the wild fox tame it over time.',
  'Duck Feeder':
    'Duck Feeder (#275): equip a BASKET and Use to take duck food, then drop piles '
    + 'near the water to befriend the wild ducks.',
  nests:
    'Nest: when a hen has laid, stand here with a BASKET and Use to collect the egg. '
    + 'Eggs sell at the farm stand — or go in the incubator to hatch chicks.',

  // ── Selling / spending / disposal ─────────────────────────────────────────
  farmStand:
    'Farm Stand: bring a BASKET of anything sellable (eggs, produce, wool, yarn, '
    + 'honey, cooked dishes) and Use to stock it — customers buy it over time and '
    + 'the money lands in your purse. Carrying a loaded pair of shears? Use here to '
    + 'dump the load straight into the stand — as wool, or as yarn if you spun it '
    + 'at the wheel on the way over (#358).',
  generalStore:
    'General Store (#215/#312): walk up and interact bare-handed to open the buy '
    + 'panel — seeds, animal feed, clothing and pet supplies, all in one shop.',
  shop:
    'Market Stall (#29): interact bare-handed to open the TOOL UPGRADES panel — '
    + 'bigger buckets and baskets, better brush, and so on.',
  trashCan:
    'Trash Can (#284): holding a carrier you want emptied? Use here to dump its '
    + 'entire load. Nothing comes back — it is a discard, not a sale.',
  compostBin:
    'Compost Bin (#232): equip the SCOOPER, scoop droppings around the pasture until '
    + 'it is loaded, then Use here to dump the load into compost.',

  // ── Places you go into / through ──────────────────────────────────────────
  gate:
    'Pasture Gate: interact bare-handed to swing it open or shut. Animals can only '
    + 'cross between the north yard and the south pasture while it is OPEN.',
  barn:
    'Barn (#35): walk in through the south doorway. Interact bare-handed at a stall '
    + 'to assign a horse to it; the tack room is along the wall.',
  coop:
    'Chicken Coop: no interaction needed — hens file in by themselves at nightfall '
    + 'and out again in the morning. The nests in front of it are where eggs turn up.',
  garden:
    'Garden Plot (#242/#245): interact bare-handed by a bed to PLANT the next crop. '
    + 'Then Use with a filled BUCKET on a growing bed to water it (skip a day and '
    + 'growth stalls), and Use with a BASKET on a ripe bed to harvest it.',
  trailEntrance:
    'Trail Entrance (#36): walk through here to ride out on the trail — best done '
    + 'mounted. Watch for the trailside collectible along the way.',
  trailCollectible:
    'Trail Trinket (#36): interact bare-handed to pocket it, then sell it at the '
    + 'farm stand like any other gathered good.',
  townEntrance:
    'Town Entrance (#312): walk through to reach town — the general store and the '
    + 'market stall live over there.',

  // ── Scenery with an ambient payoff ────────────────────────────────────────
  birdBath:
    'Bird Bath (#219): pure scenery — nothing to fill or refill. Birds fly in on '
    + 'their own to splash and drink; just stand back and watch.',
  birdhouse:
    'Birdhouse (#218): scenery/habitat — no upkeep. Birds nest and perch here; '
    + 'keeping the seed feeder stocked is what actually brings them around.',
  doghouse:
    'Doghouse (#237): the dog\'s home spot — nothing to do here. Pet the dog itself '
    + '(interact) wherever it happens to be.',
  shelter:
    'Covered Shelter (#319): no player action. When it rains, horses path here on '
    + 'their own and wait it out.',
  flowers:
    'Flowers: scenery — hummingbirds hover near them. Nothing to pick.',

  // ── Not a prop: the nearest tie-able fence rail (#317) ────────────────────
  fence:
    'Fence Rail (#317): while LEADING a horse, Use next to a rail to tie the horse '
    + 'there — it stays put until untied. Use on a tied horse again to untie it.',
};

export const WithDevTooltips = (Base) => class extends Base {
  // Called once from create(). Reads the persisted toggle; builds nothing when off.
  buildDevTooltips() {
    this._devTip     = null;  // the single Text object, created on mount
    this._devTipAt   = null;  // last player-position bucket the pick ran for
    this._devTipName = null;  // which target the visible text belongs to
    if (loadDevSettings().usageTips) this._mountDevTooltips();
  }

  // Pause-menu handler: apply the (already saved) toggle live, no reload.
  refreshDevTooltips() {
    this._clearDevTooltips();
    if (loadDevSettings().usageTips) this._mountDevTooltips();
  }

  _clearDevTooltips() {
    this._devTip?.destroy();
    this._devTip     = null;
    this._devTipAt   = null;
    this._devTipName = null;
  }

  _mountDevTooltips() {
    this._devTip = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: '#12162af2',
      padding: { x: 6, y: 4 },
      lineSpacing: 2,
      align: 'center',
      wordWrap: { width: Math.max(220, Math.min(360, logicalW(this) - 40)) },
    }).setOrigin(0.5, 1).setDepth(TIP_DEPTH).setResolution(dprOf(this)).setVisible(false);
    this._pickDevTooltip(); // apply immediately — works while paused, like #329's grid
  }

  // Called every frame from PaddockScene.update(). Cheap no-op when off; when on,
  // it re-picks only once the player has actually moved a few px.
  updateDevTooltips() {
    if (!this._devTip) return;
    this._pickDevTooltip();
  }

  // The tooltip string for a `_devLabelTargets()` name, or null. List members come
  // through as `key[i]` ('nests[0]', 'flowers[3]'); those fall back to the bare
  // list key so one line covers the whole collection.
  _devTipFor(name) {
    if (!name) return null;
    if (USAGE_TIPS[name]) return USAGE_TIPS[name];
    const bare = String(name).replace(/\[\d+\]$/, '');
    return USAGE_TIPS[bare] ?? null;
  }

  // Nearest tie-able fence rail (#317) to the player as a pseudo-target, since
  // fences live in `this.obstacles` (collision rects), not in `this.props`, and so
  // never appear in `_devLabelTargets()`. Returns the closest point ON the rail.
  _devTipFenceTarget(px, py) {
    let best = null, bestD = FENCE_RADIUS;
    for (const o of this.obstacles ?? []) {
      if (!o.isFence) continue;
      const x = Math.min(Math.max(px, o.x), o.x + o.w);
      const y = Math.min(Math.max(py, o.y), o.y + o.h);
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = { name: 'fence', x, y }; }
    }
    return best;
  }

  // Show the single nearest tooltipped object within TIP_RADIUS (fence rails
  // included). Throttled to "the player moved more than a few px" so this is not a
  // real per-frame cost, and a no-op before the player exists (first create frames).
  _pickDevTooltip() {
    const p = this.player?.sprite;
    if (!p) return;
    const at = `${Math.round(p.x / 8)},${Math.round(p.y / 8)}`;
    if (at === this._devTipAt) return;
    this._devTipAt = at;

    let best = null, bestD = TIP_RADIUS;
    for (const t of this._devLabelTargets()) {
      if (!this._devTipFor(t.name)) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    // A fence rail only wins if it's genuinely closer than any real object — you're
    // often standing at the trough or the gate, which are right up against fencing.
    const fence = this._devTipFenceTarget(p.x, p.y);
    if (fence) {
      const d = Math.hypot(fence.x - p.x, fence.y - p.y);
      if (d < bestD) { bestD = d; best = fence; }
    }

    if (!best) {
      this._devTip.setVisible(false);
      this._devTipName = null;
      return;
    }
    if (best.name !== this._devTipName) {
      this._devTipName = best.name;
      this._devTip.setText(this._devTipFor(best.name));
    }
    // Sit above the object, clear of #329's coordinate label when both are on.
    this._devTip.setPosition(Math.round(best.x), Math.round(best.y) - 26).setVisible(true);
  }
};
