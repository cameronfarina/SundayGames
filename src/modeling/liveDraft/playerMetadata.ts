import { nflTeamByEspnProTeamId } from "../../../config/nflTeams.js";
import { cleanPlayerName, normalizePlayerName } from "../../data/normalizePlayerName.js";
import { compactWordPattern } from "./constants.js";

export interface TeamMetadata {
  teamAbbreviation?: string;
  byeWeek?: number;
}

export const teamMetadataFor = (proTeamId: number | undefined): TeamMetadata => {
  const metadata = proTeamId === undefined ? undefined : nflTeamByEspnProTeamId[proTeamId];
  return metadata ? { teamAbbreviation: metadata.abbreviation, byeWeek: metadata.byeWeek } : {};
};

export const searchKeyFor = (value: string): string =>
  normalizePlayerName(cleanPlayerName(value))
    .toLowerCase()
    .replace(compactWordPattern, " ")
    .trim();

export const lastSearchToken = (value: string): string | undefined =>
  searchKeyFor(value).split(" ").filter(Boolean).at(-1);
