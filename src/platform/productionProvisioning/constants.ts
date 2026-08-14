import type { Position } from "../../../config/league.js";
import type {
  KeeperPolicy,
  LeagueProvider,
  LeagueSeasonSetupStatus,
} from "../leagueSeason.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";
import type { ProductionProvisioningKeeper } from "./contracts.js";

export const productionProvisioningSchemaVersion: "mockd.production-provisioning/v1" =
  "mockd.production-provisioning/v1";

export const positions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
export const membershipRoles: readonly WorkspaceRole[] = ["owner", "admin", "member", "observer"];
export const leagueProviders: readonly LeagueProvider[] = ["mockd", "espn", "sleeper", "yahoo"];
export const seasonStatuses: readonly LeagueSeasonSetupStatus[] = ["draft", "published", "locked"];
export const keeperStatuses: readonly ProductionProvisioningKeeper["status"][] = [
  "draft",
  "active",
  "published",
  "removed",
];
export const keeperPolicyModes: readonly KeeperPolicy["mode"][] = ["previous-cost-multiplier"];
export const keeperPolicyRoundings: readonly KeeperPolicy["rounding"][] = ["ceil"];
export const initialRosterSources: readonly ("keeper" | "imported")[] = ["keeper", "imported"];
export const localE2eFixturePatterns: readonly RegExp[] = [
  /mockd[_-]e2e/i,
  /mockd local e2e/i,
  /@mockd\.local$/i,
];
