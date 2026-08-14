import type { Owner } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { MockResultsRun } from "./reportContracts.js";
import type { MockResultsTeam } from "./teamContracts.js";

export interface RosteredTarget {
  owner: Owner;
  price: number;
  team: MockResultsTeam;
}

export const rosteredTargetFor = (
  run: MockResultsRun,
  playerName: string,
): RosteredTarget | undefined => {
  const normalized = normalizePlayerName(playerName);

  for (const team of run.teams) {
    const player = team.players.find(candidate => normalizePlayerName(candidate.name) === normalized);
    if (player) return { owner: team.owner, price: player.price, team };
  }

  return undefined;
};

export const isRosteredTarget = (target: RosteredTarget | undefined): target is RosteredTarget =>
  target !== undefined;
