import type {
  HistoricalWeights,
  ProfilePosition,
  SpecialTeamsPosition,
} from "./contracts.js";

export const profilePositions: readonly ProfilePosition[] = ["QB", "RB", "WR", "TE"];
export const specialTeamsPositions: readonly SpecialTeamsPosition[] = ["K", "DST"];
export const maximumRepresentativeSpecialTeamsPrice = 10;

export const defaultHistoricalWeights: HistoricalWeights = {
  2023: 0.2,
  2024: 0.3,
  2025: 0.5,
};
