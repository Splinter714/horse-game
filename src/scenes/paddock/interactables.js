// World interactables — the static props you activate with the primary action
// (gate, house, trough, gathering sources, nests, farm stand). Each is a
// self-describing descriptor so both input paths (handleTap and the proximity
// pass) share one declarative list instead of two parallel blocks — adding an
// activatable object is a single descriptor. Extracted from player.js (issue #167).
//
// A descriptor is a function instances(item) returning zero or more activatable
// instances for the currently held item/context. Each instance is fully
// self-describing:
//   { x, y, tapRadius, reachDist, promptOffsetY, canAct, label,
//     approach(world), activate() }
// Singletons return a one-element array; collections (sources, nests) return one
// entry per instance. canAct:false still shows a passive hint prompt (e.g.
// "carrier full", "equip a Basket") but can't be triggered.

import Phaser from 'phaser';
import { CONTENT_DEFS } from '../../data/items.js';
import { TROUGH_CAP, BOWL_CAP, PASTURE_BOUNDS, STAND_DEFS } from './constants.js';
import { FEEDER_CAP } from '../../data/feeder.js';

export const WithInteractables = (Base) => class extends Base {
  buildInteractables() {
    const gate = () => {
      const g = this.props.gate;
      if (!g) return [];
      return [{
        x: g.x, y: g.y, tapRadius: 90, reachDist: 100, promptOffsetY: 80,
        canAct: true, label: `${g.open ? 'Close' : 'Open'} Gate`,
        approach: () => ({ x: g.x, y: g.y + (this.player.sprite.y < g.y ? -70 : 70) }),
        activate: () => this.toggleGate(),
      }];
    };

    // Market stall (#29, narrowed by #312) — walk up and interact to open the
    // tool-upgrades buy panel. A bare-hand interact target like the house/gate: no
    // carried item needed.
    const shop = () => {
      const s = this.props.shop;
      if (!s) return [];
      return [{
        x: s.x, y: s.y, tapRadius: 150, reachDist: 150, promptOffsetY: 60,
        canAct: true, label: 'Tool Upgrades',
        approach: () => ({ x: s.x, y: s.y + 30 }), // walk to just below the counter
        activate: () => this.openShop(),
      }];
    };

    // The unified store (#215/#217/#222, unified + relocated to town by #312) —
    // walk up and interact to open the buy panel (spend gold on seeds, food/feed,
    // clothing, and pet supplies — every STORE_COUNTERS tab in one building). A
    // bare-hand interact target like the market stall/house/gate: no carried item
    // needed.
    const generalStore = () => {
      const s = this.props.generalStore;
      if (!s) return [];
      return [{
        x: s.x, y: s.y, tapRadius: 150, reachDist: 150, promptOffsetY: 70,
        canAct: true, label: 'General Store',
        approach: () => ({ x: s.x, y: s.y + 40 }), // walk to just below the door
        activate: () => this.openGeneralStore(),
      }];
    };

    // House (#241/#56) — the home base you walk up to and ENTER. Inside is the
    // enterable interior scene (HouseInteriorScene) with the bed (sleep, #210),
    // dresser/mirror (customizer, #211) and kitchen (#41). Sleeping now happens at
    // the bed inside, so the door just takes you in.
    const house = () => {
      const b = this.props.house;
      if (!b) return [];
      return [{
        x: b.x, y: b.y, tapRadius: 130, reachDist: 150, promptOffsetY: 40,
        canAct: true, label: 'Enter House',
        approach: () => ({ x: b.x, y: b.y + 95 }), // walk to just below the door
        activate: () => this.enterHouse(),
      }];
    };

    const trough = (item) => {
      const t = this.props.trough;
      // Offer "Fill Trough" until it's brim-full, so you can pour bucket after
      // bucket to top it up (#103) — not just when it's bone dry.
      if (!t || t.level >= TROUGH_CAP || item?.content !== 'water') return [];
      return [{
        x: t.x, y: t.y, tapRadius: 240, reachDist: 175, promptOffsetY: 40,
        canAct: true, label: 'Fill Trough',
        // Walk to the side the player is on: the well side (just north of the
        // fence) to fill over it (#106), or — now the trough runs north–south
        // (#336) — up against whichever long SIDE they're already on. The old
        // "just south of it" anchor is inside the rotated trough's own footprint.
        // Reach is generous to match: from over the fence the player stands ~145px
        // from the trough's centre, though only a step from its north end.
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          const refY = world ? world.y : this.player.sprite.y;
          if (refY < PASTURE_BOUNDS.minY) return { x: t.x, y: PASTURE_BOUNDS.minY - 34 };
          return { x: t.x + (refX >= t.x ? 64 : -64), y: t.y };
        },
        activate: () => this.fillTrough(),
      }];
    };

    // Pet bowls (#202 cat rework, #283 generalized, #311 combined into one prop,
    // #347 dog) — refill targets, NOT gather sources. The pet eats/drinks from them
    // directly; the player keeps them stocked. One object now serves both sides: offer
    // "Fill Food Bowl" when holding the matching food carrier, "Fill Water Bowl" when
    // holding a bucket of water — until that side is brim-full — mirroring the
    // trough's fill descriptor. Species-neutral: any bowl in props[propKey] whose
    // food/water side content matches the held carrier gets a fill prompt (only one
    // side can ever match a given carrier, so exactly one prompt shows at a time).
    const petBowl = (propKey, labels) => (item) => {
      const b = this.props[propKey];
      if (!b || !item || item.count <= 0) return [];
      const sideKey = Object.keys(b.sides).find(k => b.sides[k].content === item.content && b.sides[k].level < BOWL_CAP);
      if (!sideKey) return [];
      return [{
        x: b.x, y: b.y, tapRadius: 120, reachDist: 100, promptOffsetY: 60,
        canAct: true, label: `Fill ${labels[sideKey]}`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: b.x + (refX < b.x ? -1 : 1) * 44, y: b.y + 8 };
        },
        activate: () => this.fillPetBowl(item.content),
      }];
    };
    const catBowl   = petBowl('catBowl',   { food: 'Food Bowl',  water: 'Water Bowl' });
    const bunnyBowl = petBowl('bunnyBowl', { food: 'Bunny Bowl', water: 'Bunny Water' });
    const dogBowl   = petBowl('dogBowl',   { food: 'Dog Bowl',   water: 'Dog Water' });

    // Seed bird feeder (#240) — a refill target near the house, NOT a gather source.
    // Offer "Fill Feeder" while holding a basket of seed, until it's brim-full —
    // mirrors the trough/pet-bowl fill descriptor. Reuses the existing `seed` resource
    // (gathered at the grain bin), so no new content type. Birds eat from it directly
    // (ambient), draining it over time (birdEcosystem.js drainSeedFeeder).
    const seedFeeder = (item) => {
      const f = this.props.seedFeeder;
      if (!f || f.level >= FEEDER_CAP || item?.content !== 'seed' || item.count <= 0) return [];
      return [{
        x: f.x, y: f.y, tapRadius: 120, reachDist: 110, promptOffsetY: 90,
        canAct: true, label: 'Fill Feeder',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: f.x + (refX < f.x ? -1 : 1) * 44, y: f.y + 8 };
        },
        activate: () => this.fillSeedFeeder(),
      }];
    };

    // Hummingbird nectar feeder (#226) — refill target near the house, its OWN resource
    // (nectar, from the nectar station), distinct from the seed feeder. Offer "Fill
    // Nectar" while holding a bucket of nectar until it's brim-full. Hummingbirds sip
    // from it directly (ambient), draining it (birdEcosystem.js drainNectarFeeder).
    const nectarFeeder = (item) => {
      const f = this.props.nectarFeeder;
      if (!f || f.level >= FEEDER_CAP || item?.content !== 'nectar' || item.count <= 0) return [];
      return [{
        x: f.x, y: f.y, tapRadius: 120, reachDist: 110, promptOffsetY: 90,
        canAct: true, label: 'Fill Nectar',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: f.x + (refX < f.x ? -1 : 1) * 44, y: f.y + 8 };
        },
        activate: () => this.fillNectarFeeder(),
      }];
    };

    // Beehive (#239) — harvest ripe honey into a basket, like collecting an egg. Only
    // prompts once the hive has ripened (hive.ready); a basket is required (honey is a
    // solid), else a passive hint. Reuses the basket carrier, no new content plumbing.
    const beehive = (item) => {
      const h = this.props.beehive;
      if (!h || !h.ready) return [];
      const hasBasket = item?.carrier === 'basket';
      return [{
        x: h.x, y: h.y, tapRadius: 130, reachDist: 110, promptOffsetY: 60,
        canAct: hasBasket,
        label: hasBasket ? 'Harvest Honey' : 'Honey ready  •  equip a Basket to harvest',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: h.x + (refX < h.x ? -1 : 1) * 60, y: h.y + 10 };
        },
        activate: () => this.harvestBeehive(),
      }];
    };

    const sources = (item) => {
      if (!item || item.type !== 'carrier') return [];
      return this.props.sources
        .filter(s => item.accepts.includes(s.content))
        .map(s => {
          // Food gathers one unit per animal that eats it (#136); other contents
          // (water) just fill to capacity. `target` is what a full gather lands on.
          const target = this._gatherTarget(s.content, item.capacity);
          const have   = item.content === s.content ? item.count : 0;
          const full   = have >= target;
          const fullMsg = have >= item.capacity ? 'carrier full' : 'enough gathered';
          return {
            x: s.x, y: s.y, tapRadius: 120, reachDist: s.reach, promptOffsetY: 80,
            canAct: !full,
            label: full ? `${s.label}  •  ${fullMsg}`
                        : `Gather ${CONTENT_DEFS[s.content].label}`,
            approach: (world) => {
              const refX = world ? world.x : this.player.sprite.x;
              return { x: s.x + (refX < s.x ? -1 : 1) * 70, y: s.y + 10 };
            },
            activate: () => this.gatherFrom(s),
          };
        });
    };

    const nests = (item) => {
      const hasBasket = item?.carrier === 'basket';
      return this.props.nests
        .filter(n => n.hasEgg)
        .map(n => ({
          x: n.x, y: n.y, tapRadius: 100, reachDist: 80, promptOffsetY: 30,
          canAct: hasBasket,
          label: hasBasket ? 'Collect Egg' : 'Egg in nest  •  equip a Basket to collect',
          approach: () => ({ x: n.x, y: n.y + 45 }),
          activate: () => this.collectEgg(n),
        }));
    };

    // Spinning wheel (#233) — spin a basket of raw wool into yarn. Only offers the
    // action when the held carrier actually holds the craftable input (wool); shows a
    // passive hint otherwise so the station is discoverable. Data-driven off the
    // prop's `craft` block (from → to), so it's not sheep- or wool-specific.
    const spinningWheel = (item) => {
      const w = this.props.spinningWheel;
      if (!w) return [];
      const { from, to } = w.craft;
      const holdingInput = item?.type === 'carrier' && item.content === from && item.count > 0;
      return [{
        x: w.x, y: w.y, tapRadius: 130, reachDist: 110, promptOffsetY: 90,
        canAct: holdingInput,
        label: holdingInput
          ? `Spin ${CONTENT_DEFS[from].label} → ${CONTENT_DEFS[to].label}  (basket: ${item.count})`
          : `Spinning Wheel  •  bring a basket of ${CONTENT_DEFS[from].label} to spin`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: w.x + (refX < w.x ? -1 : 1) * 70, y: w.y + 10 };
        },
        activate: () => this.spinWool(),
      }];
    };

    // Kitchen counter (#40) — process a basket of raw crop into its processed form
    // (jam/flour/pig feed). Only offers the action when the held carrier holds a
    // craftable input; shows a passive hint otherwise. Data-driven off the counter's
    // `recipes` list (from → to), so it's not crop-specific — mirrors the spinning
    // wheel but generalized to several recipes on one station.
    const kitchenCounter = (item) => {
      const k = this.props.kitchenCounter;
      if (!k) return [];
      const recipe = k.recipes.find(r => r.from === item?.content && item.count > 0);
      return [{
        x: k.x, y: k.y, tapRadius: 130, reachDist: 110, promptOffsetY: 60,
        canAct: !!recipe,
        label: recipe
          ? `Process ${CONTENT_DEFS[recipe.from].label} → ${CONTENT_DEFS[recipe.to].label}  (basket: ${item.count})`
          : 'Kitchen Counter  •  bring a basket of strawberries, wheat, or carrots to process',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: k.x + (refX < k.x ? -1 : 1) * 70, y: k.y + 10 };
        },
        activate: () => this.processCrop(),
      }];
    };

    // Slop-maker (#225) — feed a basket of junk-tagged leftover dishes into pig
    // slop. Only offers the action when the held carrier holds a craftable input;
    // shows a passive hint otherwise. Data-driven off the maker's `recipes` list
    // (from → to), mirroring the kitchen counter but for leftovers, not raw crop.
    const slopMaker = (item) => {
      const m = this.props.slopMaker;
      if (!m) return [];
      const recipe = m.recipes.find(r => r.from === item?.content && item.count > 0);
      return [{
        x: m.x, y: m.y, tapRadius: 130, reachDist: 110, promptOffsetY: 60,
        canAct: !!recipe,
        label: recipe
          ? `Make Slop: ${CONTENT_DEFS[recipe.from].label} → ${CONTENT_DEFS[recipe.to].label}  (basket: ${item.count})`
          : 'Slop-Maker  •  bring a basket of leftover dishes to grind into pig slop',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: m.x + (refX < m.x ? -1 : 1) * 70, y: m.y + 10 };
        },
        activate: () => this.makeSlop(),
      }];
    };

    // Neighbor NPC (#294) — while visiting, offers a Trade (bare-hand-ish: just needs
    // a compatible empty/matching carrier equipped, checked in tradeWithNeighbor) and
    // accepts a Gift of whatever's in the held carrier (any non-empty carrier). Two
    // separate prompts can't show at once, so gift takes priority when both would
    // apply (you can always trade on repeat visits; gifting is the relationship
    // progress you'd otherwise skip).
    const neighborGift = (item) => {
      const npc = this._neighbor;
      if (!npc || npc.state !== 'visiting') return [];
      const hasGift = item?.type === 'carrier' && (item.count ?? 0) > 0;
      if (!hasGift) return [];
      return [{
        x: npc.sprite.x, y: npc.sprite.y, tapRadius: 130, reachDist: 120, promptOffsetY: 70,
        canAct: true, label: `Gift ${CONTENT_DEFS[item.content]?.label ?? 'item'} to neighbor`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: npc.sprite.x + (refX < npc.sprite.x ? -1 : 1) * 60, y: npc.sprite.y + 10 };
        },
        activate: () => this.giftNeighborWithActiveItem(),
      }];
    };

    const neighborTrade = (item) => {
      const npc = this._neighbor;
      if (!npc || npc.state !== 'visiting') return [];
      const hasGift = item?.type === 'carrier' && (item.count ?? 0) > 0;
      if (hasGift) return []; // gifting takes priority when holding something to give
      const offer = this.neighborTradeOffer();
      const canAfford = this.money >= offer.price;
      const compatibleCarrier = item?.type === 'carrier' && item.accepts?.includes(offer.give.content)
        && (item.count === 0 || item.content === offer.give.content);
      const canAct = canAfford && compatibleCarrier;
      return [{
        x: npc.sprite.x, y: npc.sprite.y, tapRadius: 130, reachDist: 120, promptOffsetY: 70,
        canAct,
        label: !canAfford
          ? `Neighbor  •  need $${offer.price} to trade`
          : compatibleCarrier
            ? `Trade: ${offer.give.qty}× ${CONTENT_DEFS[offer.give.content].label} for $${offer.price}`
            : `Neighbor  •  equip a Basket for ${CONTENT_DEFS[offer.give.content].label} to trade`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: npc.sprite.x + (refX < npc.sprite.x ? -1 : 1) * 60, y: npc.sprite.y + 10 };
        },
        activate: () => this.tradeWithNeighbor(),
      }];
    };

    const farmStand = (item) => {
      const s = this.farmStand;
      const type = item?.content;
      const sellable = s && STAND_DEFS[type] && item.count > 0;
      if (!sellable) return []; // stock is shown visually; only prompt to deposit
      return [{
        x: s.x, y: s.y, tapRadius: 160, reachDist: 120, promptOffsetY: 100,
        canAct: true, label: `Sell ${CONTENT_DEFS[type].label}  (basket: ${item.count})`,
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: s.x + (refX < s.x ? -1 : 1) * 90, y: s.y + 20 };
        },
        activate: () => this.stockStand(),
      }];
    };

    // Farm-stand wool dump (#254) — the dump spot for the shears' wool load, mirroring
    // the compost bin for the scooper. Only prompts when the shears are equipped: "Dump
    // Wool" when they're carrying a load, else a passive hint. Reuses the same farm-stand
    // prop (its `wool` stock), so no new world object.
    const standWoolDump = (item) => {
      const s = this.farmStand;
      if (!s || item?.action !== 'shear') return [];
      const load = item.load ?? 0;
      const canDump = load > 0;
      return [{
        x: s.x, y: s.y, tapRadius: 160, reachDist: 120, promptOffsetY: 100,
        canAct: canDump,
        label: canDump ? `Dump Wool at stand  (${load})`
                       : 'Farm Stand  •  shear a sheep or llama to fill the shears',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: s.x + (refX < s.x ? -1 : 1) * 90, y: s.y + 20 };
        },
        activate: () => this.dumpShearsWool(),
      }];
    };

    // Compost bin (#232) — the dump spot for the scooper. Only prompts when the
    // scooper is equipped: "Dump Compost" when it's carrying a load, else a passive
    // hint. Data-driven off the scooper's reported load (getActiveItem surfaces it).
    const compostBin = (item) => {
      const b = this.props.compostBin;
      if (!b || item?.action !== 'scoop') return [];
      const load = item.load ?? 0;
      const canDump = load > 0;
      return [{
        x: b.x, y: b.y, tapRadius: 130, reachDist: 120, promptOffsetY: 60,
        canAct: canDump,
        label: canDump ? `Dump Compost  (${load})` : 'Compost Bin  •  scoop up droppings to fill',
        approach: () => ({ x: b.x, y: b.y + 40 }), // walk to just below the bin
        activate: () => this.dumpCompost(),
      }];
    };

    // Trash can (#284) — dump the ACTIVE carrier's whole load in one Use, discarding
    // it (unwanted food/water/eggs/wool). Generic: works for any carrier content, no
    // per-content special-casing. Only prompts when the held carrier actually holds
    // something; shows a passive hint otherwise so the bin is discoverable. Nothing is
    // recoverable — it's a discard, not a stock/sell.
    const trashCan = (item) => {
      const t = this.props.trashCan;
      if (!t) return [];
      const holdingLoad = item?.type === 'carrier' && item.count > 0;
      const contentLabel = holdingLoad ? CONTENT_DEFS[item.content]?.label ?? 'contents' : null;
      return [{
        x: t.x, y: t.y - 40, tapRadius: 130, reachDist: 110, promptOffsetY: 30,
        canAct: holdingLoad,
        label: holdingLoad
          ? `Empty ${contentLabel} (${item.count}) in trash`
          : 'Trash can  •  hold a full basket or bucket to dump it',
        approach: (world) => {
          const refX = world ? world.x : this.player.sprite.x;
          return { x: t.x + (refX < t.x ? -1 : 1) * 60, y: t.y + 4 };
        },
        activate: () => this.emptyIntoTrash(),
      }];
    };

    // Barn (#35) — bare-hand interact targets: one "assign horse" per stall + a
    // passive tack-room hint. Built by the barn mixin (paddock/barn.js). Ignores the
    // held item (assignment is a bare-hand interaction).
    const barn = () => this._barnInteractables?.() ?? [];

    // Garden plot (#242) — bare-hand interact by the bed PLANTS the next crop; a filled
    // water bucket + Use on a growing slot WATERS it (#245 — required daily or growth
    // stalls); a basket + Use on a ripe slot HARVESTS it. The garden mixin
    // (paddock/garden.js) supplies the three descriptors; split across the interact/tool
    // input paths accordingly.
    const gardenDescs = this._gardenInteractables?.() ?? { plant: () => [], water: () => [], harvest: () => [] };
    const gardenPlant   = gardenDescs.plant;
    const gardenWater   = gardenDescs.water;
    const gardenHarvest = gardenDescs.harvest;

    // Riding trail (#36) — the one bare-hand collectible out on the trail.
    const trailCollectible = this._trailInteractables?.().collectible ?? (() => []);
    // Tractor (#264) — bare-hand interact: "Enter Tractor" on the vehicle itself, and
    // a separate nearby paint-stand cycle for its color. Both no-op (return []) while
    // already driving (see tractor.js `_tractorInteractables`).
    const tractor = () => this._tractorInteractables?.() ?? [];

    this.interactables = [gate, house, shop, generalStore, barn, gardenPlant, trailCollectible, tractor, trough, catBowl, bunnyBowl, dogBowl, seedFeeder, nectarFeeder, beehive, sources, nests, farmStand, standWoolDump, spinningWheel, kitchenCounter, slopMaker, compostBin, trashCan, gardenWater, gardenHarvest, neighborGift, neighborTrade];
    // Split by input: gate/house/shop/generalStore/barn/garden-plant/
    // trail-collectible/tractor are bare-hand "interact" targets (tap/click/E); the
    // rest require a carried tool/carrier and are triggered by Use (the on-screen
    // button / F / controller). See useActiveTool + handleTap. Neighbor trade/gift
    // (#294) ride the Use path too — trade only needs money (no carrier required to
    // receive), but it's grouped with toolWorld since gifting (the sibling
    // interaction at the same spot) does require a held carrier, and only one of
    // the two ever applies at a time (see neighborGift/neighborTrade above).
    this.interactWorld = [gate, house, shop, generalStore, barn, gardenPlant, trailCollectible, tractor];
    this.toolWorld     = [trough, catBowl, bunnyBowl, dogBowl, seedFeeder, nectarFeeder, beehive, sources, nests, farmStand, standWoolDump, spinningWheel, kitchenCounter, slopMaker, compostBin, trashCan, gardenWater, gardenHarvest, neighborGift, neighborTrade];
  }

  // Nearest activatable instance to (x, y) within each instance's own radius
  // (tapRadius for taps, reachDist for the keyboard), searching the given list of
  // interactable descriptors (defaults to all).
  _nearestInteractable(x, y, item, radiusKey, list = this.interactables) {
    let best = null, bestDist = Infinity;
    for (const instancesOf of list) {
      for (const inst of instancesOf(item)) {
        const d = Phaser.Math.Distance.Between(x, y, inst.x, inst.y);
        if (d <= inst[radiusKey] && d < bestDist) { bestDist = d; best = inst; }
      }
    }
    return best;
  }

  // Tap landed on a world interactable? Walk to it and activate on arrival.
  _tapInteractable(world, item) {
    const inst = this._nearestInteractable(world.x, world.y, item, 'tapRadius', this.interactWorld);
    if (!inst || !inst.canAct) return false;
    const dest = inst.approach(world);
    this.tapMoveTo(dest.x, dest.y, () => inst.activate());
    return true;
  }

  // Player standing next to a world interactable? Queue its prompt; activate on
  // key press. Non-actionable instances show a passive hint (no key prefix).
  _proximityInteractable(item, useJust) {
    const inst = this._nearestInteractable(this.player.sprite.x, this.player.sprite.y, item, 'reachDist', this.interactWorld);
    if (!inst) return false;
    this._pushPrompt(inst.canAct ? 'interact' : null, inst.label);
    if (inst.canAct) this._interactAction = { label: inst.label, run: () => inst.activate() };
    if (useJust && inst.canAct) inst.activate();
    return true;
  }
};
