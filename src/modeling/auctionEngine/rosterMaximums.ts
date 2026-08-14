import { leagueConfig, type Position } from "../../../config/league.js";
import type { OwnerProfile } from "../ownerProfiles.js";
import { OwnerRosterMaximums } from "./configContracts.js";
import { onePlayerRosterCountThreshold } from "./constants.js";

const constrainedRosterPositions: readonly Position[] = ["QB", "TE", "K", "DST"];

export const buildOwnerRosterMaximums = (
  profiles: readonly OwnerProfile[],
): OwnerRosterMaximums => {
  const maximums: OwnerRosterMaximums = {};

  for (const profile of profiles) {
    const ownerMaximums: Partial<Record<Position, number>> = {};
    for (const position of constrainedRosterPositions) {
      const historicalMaximum = profile.rosterCounts[position] <= onePlayerRosterCountThreshold
        ? 1
        : Math.ceil(profile.rosterCounts[position]);
      const cappedMaximum = Math.min(leagueConfig.rosterMaximums[position], historicalMaximum);
      if (cappedMaximum < leagueConfig.rosterMaximums[position]) ownerMaximums[position] = cappedMaximum;
    }
    if (Object.keys(ownerMaximums).length > 0) maximums[profile.owner] = ownerMaximums;
  }

  return maximums;
};
