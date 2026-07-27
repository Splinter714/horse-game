// Cooking at the house stove (#213/#41/#214) — its own concern mixin, split out of
// HouseInteriorScene.js to stay under the scene size budget (modularity.test.js),
// mirroring the houseInteriorDecor.js split. `this` is HouseInteriorScene.
//
// #214 replaced the old "dialed to a known recipe from a fixed list" flow with PURE
// DISCOVERY: there is no purchased/unlocked recipe list. The stove is "dialed to" a
// PAIR of ingredients currently on hand (pantry + active carrier) — repeated taps
// cycle through every distinct pair available, exactly like the old recipe cycling
// did, so the interaction shape (browse + go on one button) is unchanged. What
// changed is what's being browsed: raw ingredient combos, not known dishes.
//
// The contextual-prompt label IS the safe preview: before you ever tap, it already
// tells you whether the dialed combo is a real recipe (and affordable) or an
// unknown/incomplete guess — tapping either COOKS (only when valid+affordable) or
// CYCLES to the next combo. So an invalid guess never costs ingredients; you only
// spend them on a tap that the label already promised would cook something.
//
// A successful cook adds the recipe to the player's persisted recipe book
// (save.js loadRecipeBook/saveRecipeBook) — "discovered" recipes are bubbled to the
// front of the combo cycle (quick to dial back up next time) and listed in the
// recipe-book panel (houseInteriorRecipeBook.js, toggled with R).
//
// Once a dish has been cooked, a *following* interact offers to feed the most
// recently cooked dish (per its recipe's `feedEffect`) instead of cooking/trying
// again — the existing two-step "cook, then feed" flow, unchanged by #214.
//
// Cooked dishes do BOTH (#41 scope): sell for more at the farm stand than their raw
// ingredients (carried out in a basket via the existing sell pipeline — CONTENT_DEFS/
// STAND_DEFS entries in items.js/paddock/constants.js) AND restore an animal's stats
// when fed (right here at the stove — the house has no in-world roster to walk a
// dish out to).

import { loadPantry, savePantry, loadRecipeBook, saveRecipeBook, ROSTER_SPECIES } from '../data/save.js';
import { addToPantry } from '../data/pantry.js';
import { CONTENT_DEFS } from '../data/items.js';
import {
  RECIPE_LIST, DISH_CONTENTS, canCookRecipe, matchRecipe, discoverRecipe, isRecipeDiscovered,
  INGREDIENT_CONTENTS,
} from '../data/cooking.js';
import { startMealBuff } from '../data/playerBuff.js';
import { EVENTS } from '../data/events.js';

export const WithHouseInteriorCooking = (Base) => class extends Base {
  // Called once from create() — sets up every bit of cooking-related state
  // (combo-cycle index, pantry, recipe book) in one place so the scene core stays
  // a single call instead of three separate load/initialize lines.
  _initCooking() {
    this._kitchenComboIdx = 0;
    this.pantry = loadPantry();
    this.recipeBook = loadRecipeBook();
  }

  // Which ingredient contents are available RIGHT NOW (pantry + active carrier),
  // restricted to contents any recipe actually uses — the pool the combo picker
  // draws pairs from. Sorted for a stable cycle order.
  _availableIngredientContents() {
    return INGREDIENT_CONTENTS
      .filter((content) => this._availableIngredient(content) > 0)
      .sort();
  }

  // Every distinct unordered pair of currently-available ingredients, discovered
  // combos first (so a recipe you already know is quick to dial back up) then
  // alphabetically — the "quick-cookable next time" half of #214's ask.
  _comboCandidates() {
    const contents = this._availableIngredientContents();
    const pairs = [];
    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        pairs.push([contents[i], contents[j]]);
      }
    }
    return pairs.sort((pairA, pairB) => {
      const recipeA = matchRecipe(pairA[0], pairA[1]);
      const recipeB = matchRecipe(pairB[0], pairB[1]);
      const knownA = recipeA && isRecipeDiscovered(this.recipeBook, recipeA.id) ? 0 : 1;
      const knownB = recipeB && isRecipeDiscovered(this.recipeBook, recipeB.id) ? 0 : 1;
      if (knownA !== knownB) return knownA - knownB;
      return 0; // stable sort keeps the alphabetical order from contents.sort() above
    });
  }

  _comboLabel(pair) {
    return pair.map((content) => CONTENT_DEFS[content]?.label ?? content).join(' + ');
  }

  // The stove's contextual-prompt label while standing near it: what interacting
  // will do right now — feed a just-cooked dish, cook the dialed combo, or name why
  // it can't yet (mirrors the kitchen-counter/spinning-wheel prompt pattern). This
  // label IS the safe preview #214 asks for: it always tells you what a tap will do
  // BEFORE you tap it.
  _kitchenLabel() {
    if (this._lastCookedDish) {
      const target = RECIPE_LIST.find((r) => r.output.content === this._lastCookedDish).feedEffect.species;
      return `Stove  •  Feed ${CONTENT_DEFS[this._lastCookedDish].label} to the ${target}s`;
    }
    const candidates = this._comboCandidates();
    if (candidates.length === 0) {
      return 'Stove  •  Gather two different ingredients to try a recipe  •  [R] Recipe book';
    }
    const pair = candidates[this._kitchenComboIdx % candidates.length];
    const recipe = matchRecipe(pair[0], pair[1]);
    if (recipe && this._canCookRecipeNow(recipe)) {
      return `Stove  •  Cook ${recipe.label}?  (${this._comboLabel(pair)})`;
    }
    if (recipe) {
      return `Stove  •  ${recipe.label} needs ${this._recipeNeedText(recipe)}`;
    }
    return `Stove  •  Try ${this._comboLabel(pair)}?  (unknown combo)`;
  }

  _recipeNeedText(recipe) {
    return recipe.ingredients
      .map((ing) => `${ing.amount} ${CONTENT_DEFS[ing.content].label}`)
      .join(' + ');
  }

  _useKitchen() {
    if (this._lastCookedDish) {
      this._feedCookedDish(this._lastCookedDish);
      return;
    }
    const candidates = this._comboCandidates();
    if (candidates.length === 0) {
      this._flashPromptMessage('Need two different ingredients to try a recipe');
      return;
    }
    this._kitchenComboIdx = this._kitchenComboIdx % candidates.length;
    const pair = candidates[this._kitchenComboIdx];
    const recipe = matchRecipe(pair[0], pair[1]);
    if (recipe && this._canCookRecipeNow(recipe)) {
      this._cookRecipe(recipe);
    } else {
      this._kitchenComboIdx = (this._kitchenComboIdx + 1) % candidates.length;
      this._flashKitchenHint(recipe, pair);
    }
  }

  // A friendly hint naming the dialed combo and what it still needs (a real but
  // unaffordable recipe) or that it's simply not a recipe at all — shown after
  // cycling past a combo that couldn't be cooked. No ingredients are ever consumed
  // to show this — the preview (the prompt label) already knew before the tap.
  _flashKitchenHint(recipe, pair) {
    if (recipe) {
      this._flashPromptMessage(`${recipe.label}  •  need ${this._recipeNeedText(recipe)}`);
    } else {
      this._flashPromptMessage(`${this._comboLabel(pair)}  •  not a recipe`);
    }
  }

  // How many of `content` are available RIGHT NOW across pantry + inventory
  // (findIngredient only reports whichever single source has more — this sums both,
  // since a recipe ingredient may be split across the two, e.g. some carrots in the
  // pantry and more in the held basket).
  _availableIngredient(content) {
    const inPantry = this.pantryCount(content);
    const hot = this.scene.get('HotbarScene');
    const item = hot?.getActiveItem?.();
    const inInventory = item?.content === content ? (item.count ?? 0) : 0;
    return inPantry + inInventory;
  }

  _canCookRecipeNow(recipe) {
    return canCookRecipe(recipe, (content) => this._availableIngredient(content));
  }

  // Consume each ingredient (pantry first, then the active carrier — mirrors
  // findIngredient's source order), stock the resulting dish in the pantry, and
  // (#214) record the recipe as discovered so it's remembered/quick-cookable next
  // time. Only called once _canCookRecipeNow has confirmed enough is on hand.
  _cookRecipe(recipe) {
    for (const ing of recipe.ingredients) {
      let remaining = ing.amount;
      const fromPantry = Math.min(this.pantryCount(ing.content), remaining);
      if (fromPantry > 0) {
        this.takePantryIngredient(ing.content, fromPantry);
        remaining -= fromPantry;
      }
      if (remaining > 0) {
        this.scene.get('HotbarScene')?.useActiveCarrier?.(remaining);
      }
    }
    this.pantry = addToPantry(this.pantry, recipe.output.content, recipe.output.amount);
    savePantry(this.pantry);
    const wasKnown = isRecipeDiscovered(this.recipeBook, recipe.id);
    this.recipeBook = discoverRecipe(this.recipeBook, recipe.id);
    saveRecipeBook(this.recipeBook);
    this._lastCookedDish = recipe.output.content;
    this._flashPromptMessage(wasKnown
      ? `Cooked ${recipe.label}!  •  interact again to feed it`
      : `Discovered ${recipe.label}!  •  interact again to feed it`);
  }

  // Feed the most recently cooked dish to its recipe's target species (right here at
  // the stove — the house has no in-world animal roster to walk it out to). Takes one
  // dish from the pantry and bumps every live member of that species' stat by the
  // recipe's feedEffect amount, then persists that species' roster. No-op (with a
  // gentle hint) if the dish was somehow already used up.
  _feedCookedDish(dishContent) {
    this._lastCookedDish = null;
    const recipe = RECIPE_LIST.find((r) => r.output.content === dishContent);
    if (!recipe) return;
    const taken = this.takePantryIngredient(dishContent, 1);
    if (taken <= 0) {
      this._flashPromptMessage(`No ${CONTENT_DEFS[dishContent].label} left to feed`);
      return;
    }
    const { species, stat, amount } = recipe.feedEffect;
    const roster = ROSTER_SPECIES.find((r) => r.id === species);
    const all = roster ? this.registry.get(roster.registryKey) : null;
    let fed = 0;
    if (all) {
      for (const animal of Object.values(all)) {
        if (!(stat in animal.stats)) continue;
        animal.stats[stat] = Math.min(100, animal.stats[stat] + amount);
        if (typeof animal._tended === 'function') animal._tended('fed');
        fed++;
      }
      if (fed > 0) roster.save(all);
    }
    this.game.events.emit(EVENTS.STATS_CHANGED);
    this._flashPromptMessage(fed > 0
      ? `Fed ${CONTENT_DEFS[dishContent].label} to the ${species}s  •  +${amount} ${stat}`
      : `Fed ${CONTENT_DEFS[dishContent].label}  •  no ${species}s here to enjoy it`);
  }

  // ── Player eats a meal (#277) ──────────────────────────────────────────────
  // The pantry's "nothing to stock" moment (HouseInteriorScene._usePantry, when the
  // active carrier has nothing storable) becomes "something to eat" whenever the
  // pantry itself is holding a cooked dish — reuses the same single interact button,
  // mirroring the stove's own "cook, then feed" two-step. Eating takes one dish and
  // grants a short move-speed + chore-energy buff (single slot, no stacking — eating
  // again just refreshes it); PaddockScene's playerBuff.js mixin reads it back off
  // the shared registry for the live multipliers + HUD.
  _eatMealFromPantry() {
    const dish = DISH_CONTENTS.find((content) => this.pantryCount(content) > 0);
    if (!dish) {
      this._flashPromptMessage('Nothing to stock');
      return;
    }
    this.takePantryIngredient(dish, 1);
    this.registry.set('playerBuff', startMealBuff(Date.now()));
    this._flashPromptMessage(`Ate ${CONTENT_DEFS[dish].label}!  •  feeling fast & energized`);
  }
};
