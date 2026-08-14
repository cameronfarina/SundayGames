import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";
import { sameCanonicalValue } from "./canonicalValue.js";
import { provisioningChange } from "./change.js";
import type { InspectionPart, ProductionProvisioningDependencies } from "./contracts.js";
import { normalizedMemberships, seasonComparable } from "./documentValues.js";

export const inspectSeason = async (
  document: ResolvedProductionProvisioningDocument,
  dependencies: ProductionProvisioningDependencies,
): Promise<InspectionPart> => {
  const seasonById = await dependencies.leagueSetupRepository.findLeagueSeason(document.season.id);
  const seasonForYear = await dependencies.leagueSetupRepository.findLeagueSeasonForLeagueYear(
    document.league.id,
    document.season.seasonYear,
  );
  const memberships = await dependencies.leagueSetupRepository.membershipsForLeague(
    document.league.id,
  );
  const changes = [];
  const conflicts: string[] = [];

  if (seasonById === null) {
    if (seasonForYear !== null) {
      conflicts.push(
        `League ${document.league.id} already has season ${seasonForYear.id} for ${document.season.seasonYear}.`,
      );
    }
    if (memberships.length > 0) {
      conflicts.push(`League ${document.league.id} already has memberships outside this provisioning receipt.`);
    }
    changes.push(provisioningChange("league-season", document.season.id, "create"));
  } else if (!sameCanonicalValue(seasonComparable(document.season), seasonComparable(seasonById))) {
    conflicts.push(`League season ${document.season.id} differs from the provisioning document.`);
    changes.push(provisioningChange("league-season", document.season.id, "unchanged"));
  } else if (!sameCanonicalValue(normalizedMemberships(memberships), normalizedMemberships(document.memberships))) {
    conflicts.push(`League memberships for ${document.league.id} differ from the provisioning document.`);
    changes.push(provisioningChange("league-season", document.season.id, "unchanged"));
  } else {
    changes.push(provisioningChange("league-season", document.season.id, "unchanged"));
  }

  return { changes, conflicts };
};
