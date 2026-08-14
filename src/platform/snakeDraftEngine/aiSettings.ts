import type { SnakeDraftState, SnakeDraftTeamReadModel } from "./readModels.js";

export interface ResolvedAiSettings {
  rankWeight: number;
  adpWeight: number;
  rosterNeedWeight: number;
  positionalRunWeight: number;
  positionalRunWindow: number;
  randomWeight: number;
  positionPreferences: Readonly<Record<string, number>>;
}

interface DefaultAiWeights {
  rank: number;
  adp: number;
  rosterNeed: number;
  positionalRun: number;
  positionalRunWindow: number;
  random: number;
}

const defaultAiWeights: DefaultAiWeights = {
  rank: 1,
  adp: 0.75,
  rosterNeed: 4,
  positionalRun: 1.5,
  positionalRunWindow: 6,
  random: 0.25,
};

export const aiSettingsFor = (
  state: SnakeDraftState,
  team: SnakeDraftTeamReadModel,
): ResolvedAiSettings => {
  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const ai = state.configuration.ai;

  return {
    rankWeight: tendency?.rankWeight ?? ai?.rankWeight ?? defaultAiWeights.rank,
    adpWeight: tendency?.adpWeight ?? ai?.adpWeight ?? defaultAiWeights.adp,
    rosterNeedWeight: tendency?.rosterNeedWeight ?? ai?.rosterNeedWeight ?? defaultAiWeights.rosterNeed,
    positionalRunWeight: tendency?.positionalRunWeight
      ?? ai?.positionalRunWeight
      ?? defaultAiWeights.positionalRun,
    positionalRunWindow: ai?.positionalRunWindow ?? defaultAiWeights.positionalRunWindow,
    randomWeight: ai?.randomWeight ?? defaultAiWeights.random,
    positionPreferences: tendency?.positionPreferences ?? {},
  };
};
