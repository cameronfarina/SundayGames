import {
  playerContextCategories,
  type PlayerContextCategory,
} from "../../../config/playerContext.js";

const categorySet = new Set<string>(playerContextCategories);

export const isPlayerContextCategory = (value: string): value is PlayerContextCategory =>
  categorySet.has(value);
