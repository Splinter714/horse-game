// Cooking (#41) — recipes that combine existing crops/animal products into cooked
// dishes at the house's stove/oven (#213). Sits alongside crop processing (#40):
// jam/flour/pig feed are single-ingredient grinds at the kitchen-counter world prop;
// cooking is the house-side follow-up that COMBINES two ingredients into a dish.
//
// Cooked dishes do BOTH (scoped 2026-07-06):
//   • sell for more gold at the farm stand than their raw ingredients combined
//     (mirrors the jam/flour processing payoff, #40) — see items.js CONTENT_DEFS /
//     paddock/constants.js STAND_DEFS for the sell prices this compares against.
//   • restore an animal's stats when FED (mirrors Animal.applyAction) — a first-pass
//     recipe list + effect sizes, flagged for playtest per the issue.
//
// Ingredients resolve via HouseInteriorScene.findIngredient() (#213's stub): pantry
// first, then the player's active carrier. Kept as its own small pure module (not
// folded into items.js) so the recipe/cook contract is unit-testable without Phaser,
// like crops.js/pantry.js.

import { CONTENT_DEFS } from './items.js';
import { STAND_DEFS } from '../scenes/paddock/constants.js';

// Each recipe: two ingredients (content + amount) → one cooked dish. `feedEffect`
// names which species the dish is fed to (at the stove, right where it's cooked —
// there's no in-house animal roster to walk it out to) and the stat/amount it
// restores, mirroring a big top-up care action. Sell price + basket icon live on
// the dish's own CONTENT_DEFS / STAND_DEFS entries (items.js / constants.js) so the
// existing basket → farm-stand → sell pipeline needs no special-casing for cooking.
export const RECIPES = {
  // Carrot + potato → a hearty stew. Fed to the horses — restores a big chunk of
  // hunger, like a supersized feed action.
  vegetableStew: {
    id: 'vegetableStew',
    label: 'Vegetable Stew',
    ingredients: [{ content: 'carrot', amount: 2 }, { content: 'potato', amount: 1 }],
    output: { content: 'vegetableStew', amount: 1 },
    feedEffect: { species: 'horse', stat: 'hunger', amount: 45 },
  },
  // Strawberry + blueberry → a sweet pie. Fed to the chickens — a big happiness
  // treat (chickens have no hunger/thirst needs, so happiness is their only stat).
  berryPie: {
    id: 'berryPie',
    label: 'Berry Pie',
    ingredients: [{ content: 'strawberry', amount: 2 }, { content: 'blueberry', amount: 1 }],
    output: { content: 'berryPie', amount: 1 },
    feedEffect: { species: 'chicken', stat: 'happiness', amount: 30 },
  },
  // Wheat + honey → a sweet loaf. Fed to the cow — a big happiness treat.
  honeyBread: {
    id: 'honeyBread',
    label: 'Honey Bread',
    ingredients: [{ content: 'wheat', amount: 2 }, { content: 'honey', amount: 1 }],
    output: { content: 'honeyBread', amount: 1 },
    feedEffect: { species: 'cow', stat: 'happiness', amount: 35 },
  },
};

export const RECIPE_LIST = Object.values(RECIPES);

// Can `recipe` be cooked right now? `available(content)` is a lookup function —
// HouseInteriorScene passes `(content) => this.findIngredient(content, amount).available`
// style callers; kept generic/pure here so it's testable with a plain stub. Every
// ingredient must have enough available (pantry + inventory are pre-resolved by the
// caller, per-ingredient, since findIngredient only checks ONE content at a time).
export function canCookRecipe(recipe, available) {
  return recipe.ingredients.every((ing) => available(ing.content) >= ing.amount);
}

// The combined raw-ingredient value of a recipe at farm-stand prices — what you'd
// have gotten selling the ingredients uncooked. Used to confirm (and unit-test) that
// every dish's sell price is a genuine premium over its raw inputs, mirroring the
// jam/flour/pig-feed payoff (#40).
export function rawIngredientValue(recipe) {
  return recipe.ingredients.reduce((sum, ing) => {
    const price = STAND_DEFS[ing.content]?.price ?? 0;
    return sum + price * ing.amount;
  }, 0);
}

// The dish's own farm-stand sell price (0 if it isn't sellable there — shouldn't
// happen for a real recipe, but keeps this safe against a data typo).
export function dishSellPrice(recipe) {
  return STAND_DEFS[recipe.output.content]?.price ?? 0;
}

// True if the dish is a genuine premium over selling its raw ingredients — the
// scoped requirement every recipe must satisfy.
export function isProfitableToCook(recipe) {
  return dishSellPrice(recipe) > rawIngredientValue(recipe);
}

// Look up a recipe by its OUTPUT content (e.g. resolve which recipe produced a dish
// already sitting in a basket/pantry) — used by feeding, which only has the dish's
// content key on hand, not the recipe id.
export function recipeForDish(content) {
  return RECIPE_LIST.find((r) => r.output.content === content) ?? null;
}

// Every dish content key, for the pantry/carrier allow-lists.
export const DISH_CONTENTS = RECIPE_LIST.map((r) => r.output.content);

// Sanity: every recipe's ingredients and output must exist in items.js CONTENT_DEFS,
// and the output must be sellable (action 'sell') — otherwise the "sells for more"
// half of the feature silently does nothing. Cheap enough to run at module load;
// throws early (in tests / dev) rather than failing silently in play.
for (const recipe of RECIPE_LIST) {
  for (const ing of recipe.ingredients) {
    if (!CONTENT_DEFS[ing.content]) {
      throw new Error(`cooking.js: recipe ${recipe.id} references unknown ingredient ${ing.content}`);
    }
  }
  if (!CONTENT_DEFS[recipe.output.content]) {
    throw new Error(`cooking.js: recipe ${recipe.id} references unknown output ${recipe.output.content}`);
  }
}
