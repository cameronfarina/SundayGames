import type { PostDraftStarterSlot } from "../postDraftTeamAnalysis.js";
import type { FantasyProsInSeasonView } from "./contracts.js";
import type { FantasyProsInSeasonDataset } from "./dataset.js";
import { enrichRosterCandidate } from "./enrich.js";
import { buildFantasyProsLineup } from "./lineup.js";
import { emptyFantasyProsPlayerNewsIndex, type FantasyProsPlayerNewsIndex } from "./news.js";
import type { FantasyProsRosterView } from "./roster.js";
import { buildFantasyProsWaiverBoard } from "./waivers.js";

export interface BuildFantasyProsInSeasonViewInput {
  configured: boolean;
  teamId: string;
  ownerId: string;
  rosterView: FantasyProsRosterView;
  starterSlots: readonly PostDraftStarterSlot[];
  dataset: FantasyProsInSeasonDataset;
  news?: FantasyProsPlayerNewsIndex | undefined;
}

export const buildFantasyProsInSeasonView = (
  input: BuildFantasyProsInSeasonViewInput,
): FantasyProsInSeasonView => {
  const news = input.news ?? emptyFantasyProsPlayerNewsIndex();
  const players = input.rosterView.players
    .map(candidate => enrichRosterCandidate(candidate, input.dataset, news));

  return {
    configured: input.configured,
    week: input.dataset.week,
    updatedAt: input.dataset.updatedAt,
    players,
    lineup: buildFantasyProsLineup({
      teamId: input.teamId,
      ownerId: input.ownerId,
      players,
      starterSlots: input.starterSlots,
    }),
    waivers: buildFantasyProsWaiverBoard(input.rosterView.freeAgents, input.dataset, news),
  };
};
