import { espnApiOrigin } from "./constants.js";

export const leagueIdFor = (leagueIdOrUrl: number | string): string => {
  const rawValue = String(leagueIdOrUrl).trim();
  const directId = /^\d+$/u.test(rawValue) ? rawValue : null;
  if (directId !== null && Number(directId) > 0) return directId;

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("Enter a positive ESPN league ID or an ESPN fantasy-football league URL.");
  }

  if (!/(^|\.)espn\.com$/iu.test(url.hostname)) {
    throw new Error("Enter an ESPN fantasy-football league URL.");
  }

  const leagueId = [...url.searchParams.entries()]
    .find(([key]) => key.toLowerCase() === "leagueid")?.[1]
    ?.trim();
  if (leagueId === undefined || !/^\d+$/u.test(leagueId) || Number(leagueId) <= 0) {
    throw new Error("The ESPN URL does not contain a positive leagueId.");
  }

  return leagueId;
};

export const requestUrlFor = (leagueId: string, season: number): string => {
  if (!Number.isSafeInteger(season) || season <= 0) {
    throw new Error("ESPN season must be a positive whole number.");
  }

  const path = `/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`;
  const url = new URL(path, espnApiOrigin);
  url.searchParams.append("view", "mSettings");
  url.searchParams.append("view", "mTeam");
  return url.toString();
};
