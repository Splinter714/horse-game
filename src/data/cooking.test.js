// Characterization tests for cooking (#41): the recipe table + its pure helpers.
// Mirrors items.test.js's style for the sibling crop-processing feature (#40).

import { describe, it, expect } from 'vitest';
import {
  RECIPES, RECIPE_LIST, DISH_CONTENTS,
  canCookRecipe, rawIngredientValue, dishSellPrice, isProfitableToCook, recipeForDish,
} from './cooking.js';
import { CONTENT_DEFS } from './items.js';
import { STAND_DEFS } from '../scenes/paddock/constants.js';
import { isPantryStorable } from './pantry.js';
import { CARRIER_DEFS } from './items.js';

describe('cooking recipes (#41)', () => {
  it('has a small first-pass recipe set, each combining two ingredients', () => {
    expect(RECIPE_LIST.length).toBeGreaterThanOrEqual(2);
    expect(RECIPE_LIST.length).toBeLessThanOrEqual(3 + 1); // "2-3 dishes" per scope, a little slack
    for (const recipe of RECIPE_LIST) {
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(2);
      expect(recipe.output.content).toBeTruthy();
      expect(recipe.output.amount).toBeGreaterThan(0);
    }
  });

  it('every ingredient and output is a real, known content', () => {
    for (const recipe of RECIPE_LIST) {
      for (const ing of recipe.ingredients) expect(CONTENT_DEFS[ing.content]).toBeDefined();
      expect(CONTENT_DEFS[recipe.output.content]).toBeDefined();
    }
  });

  it('every dish is sellable at the farm stand', () => {
    for (const recipe of RECIPE_LIST) {
      expect(CONTENT_DEFS[recipe.output.content].action).toBe('sell');
      expect(STAND_DEFS[recipe.output.content]).toBeDefined();
      expect(STAND_DEFS[recipe.output.content].price).toBeGreaterThan(0);
    }
  });

  it('every dish sells for MORE than its combined raw ingredients (#41 scope)', () => {
    for (const recipe of RECIPE_LIST) {
      expect(isProfitableToCook(recipe)).toBe(true);
      expect(dishSellPrice(recipe)).toBeGreaterThan(rawIngredientValue(recipe));
    }
  });

  it('rawIngredientValue sums ingredient price × amount at stand prices', () => {
    const stew = RECIPES.vegetableStew;
    const expected = stew.ingredients.reduce(
      (sum, ing) => sum + STAND_DEFS[ing.content].price * ing.amount, 0);
    expect(rawIngredientValue(stew)).toBe(expected);
  });

  it('every dish has a feedEffect naming a target species/stat/amount', () => {
    for (const recipe of RECIPE_LIST) {
      expect(recipe.feedEffect.species).toBeTruthy();
      expect(recipe.feedEffect.stat).toBeTruthy();
      expect(recipe.feedEffect.amount).toBeGreaterThan(0);
    }
  });

  it('canCookRecipe is true only when every ingredient amount is available', () => {
    const stew = RECIPES.vegetableStew; // 2 carrot + 1 potato
    const full = (content) => ({ carrot: 2, potato: 1 }[content] ?? 0);
    const short = (content) => ({ carrot: 1, potato: 1 }[content] ?? 0);
    const none = () => 0;
    expect(canCookRecipe(stew, full)).toBe(true);
    expect(canCookRecipe(stew, short)).toBe(false);
    expect(canCookRecipe(stew, none)).toBe(false);
  });

  it('recipeForDish resolves a recipe back from its output content', () => {
    const stew = RECIPES.vegetableStew;
    expect(recipeForDish(stew.output.content)).toBe(stew);
    expect(recipeForDish('not-a-real-content')).toBeNull();
  });

  it('DISH_CONTENTS lists every dish output, each pantry- and basket-storable', () => {
    expect(DISH_CONTENTS.length).toBe(RECIPE_LIST.length);
    for (const content of DISH_CONTENTS) {
      expect(isPantryStorable(content)).toBe(true);
      expect(CARRIER_DEFS.basket.accepts).toContain(content);
    }
  });
});
