import type {
  ResolveSeasonSimulationPreferencesInput,
  ResolveSeasonSimulationPreferencesResult,
} from "./contracts.js";
import { createPreferenceContext } from "./context.js";
import { infeasiblePreferenceWarning, resolvePreference } from "./feasibility.js";
import { rankPreference } from "./ranking.js";

export const resolveSeasonSimulationPreferences = (
  input: ResolveSeasonSimulationPreferencesInput,
): ResolveSeasonSimulationPreferencesResult => {
  const context = createPreferenceContext(input);
  const preferences = input.preferences.map(preference =>
    resolvePreference(context, preference, rankPreference(context, preference))
  );
  return {
    preferences,
    warnings: preferences.filter(preference => !preference.feasible).map(infeasiblePreferenceWarning),
  };
};
