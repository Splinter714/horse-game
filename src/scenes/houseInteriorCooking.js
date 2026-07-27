// Cooking at the house stove (#213/#41) — its own concern mixin, split out of
// HouseInteriorScene.js to stay under the scene size budget (modularity.test.js),
// mirroring the houseInteriorDecor.js split. `this` is HouseInteriorScene.
//
// The stove is "dialed to" one recipe at a time (this._kitchenRecipeIdx), shown in
// the contextual prompt. Interacting either COOKS the dialed recipe (if its
// ingredients are on hand) or, when they aren't, CYCLES to the next recipe — so
// repeated taps both browse the small recipe list and act as its "go" button, with
// no second input needed (the house has only one interact key). Once a dish has
// been cooked, a *following* interact offers to feed the most recently cooked dish
// (per its recipe's `feedEffect`) instead of cooking again — a clear two-step
// "cook, then feed" flow using the same single button.
//
// Cooked dishes do BOTH (#41 scope): sell for more at the farm stand than their raw
// ingredients (carried out in a basket via the existing sell pipeline — CONTENT_DEFS/
// STAND_DEFS entries in items.js/paddock/constants.js) AND restore an animal's stats
// when fed (right here at the stove — the house has no in-world roster to walk a
// dish out to).

import { savePantry, ROSTER_SPECIES } from '../data/save.js';
import { addToPantry } from '../data/pantry.js';
import { CONTENT_DEFS } from '../data/items.js';
import { RECIPE_LIST, DISH_CONTENTS, canCookRecipe } from '../data/cooking.js';
import { startMealBuff } from '../data/playerBuff.js';
import { EVENTS } from '../data/events.js';

export const WithHouseInteriorCooking = (Base) => class extends Base {
  // The stove's contextual-prompt label while standing near it: what interacting
  // will do right now — feed a just-cooked dish, cook the dialed recipe, or name
  // what it still needs (mirrors the kitchen-counter/spinning-wheel prompt pattern).
  _kitchenLabel() {
    if (this._lastCookedDish) {
      const target = RECIPE_LIST.find((r) => r.output.content === this._lastCookedDish).feedEffect.species;
      return `Stove  •  Feed ${CONTENT_DEFS[this._lastCookedDish].label} to the ${target}s`;
    }
    const recipe = RECIPE_LIST[this._kitchenRecipeIdx % RECIPE_LIST.length];
    if (this._canCookRecipeNow(recipe)) return `Stove  •  Cook ${recipe.label}`;
    return `Stove  •  ${recipe.label} needs ${this._recipeNeedText(recipe)}`;
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
    const recipe = RECIPE_LIST[this._kitchenRecipeIdx % RECIPE_LIST.length];
    if (this._canCookRecipeNow(recipe)) {
      this._cookRecipe(recipe);
    } else {
      this._kitchenRecipeIdx = (this._kitchenRecipeIdx + 1) % RECIPE_LIST.length;
      this._flashKitchenHint();
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

  // A friendly hint naming the dialed recipe and what it still needs, shown after
  // cycling past a recipe that can't be cooked yet.
  _flashKitchenHint() {
    const recipe = RECIPE_LIST[this._kitchenRecipeIdx % RECIPE_LIST.length];
    this._flashPromptMessage(`${recipe.label}  •  need ${this._recipeNeedText(recipe)}`);
  }

  // Consume each ingredient (pantry first, then the active carrier — mirrors
  // findIngredient's source order) and stock the resulting dish in the pantry.
  // Only called once _canCookRecipeNow has confirmed enough is on hand.
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
    this._lastCookedDish = recipe.output.content;
    this._flashPromptMessage(`Cooked ${recipe.label}!  •  interact again to feed it`);
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
