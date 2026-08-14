import type {
  League,
  LeagueSeason,
  LeagueSeasonSettings,
} from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";

export interface ProductionProvisioningAccount {
  id: string;
  email: string;
  passwordHashEnv: string;
}

export interface ProductionProvisioningCatalogEntry extends LiveDraftRoomPlayerCatalogEntry {
  playerId: string;
  provider?: string | undefined;
  providerPlayerId?: string | undefined;
}

export interface ProductionProvisioningInitialRosterPlayer extends LiveDraftRoomInitialRosterPlayer {
  playerId: string;
}

export interface ProductionProvisioningKeeper {
  id: string;
  teamId: string;
  playerId: string;
  keeperCost: number;
  previousCost?: number | undefined;
  status: "draft" | "active" | "published" | "removed";
  source: string;
}

export interface ProductionProvisioningDocument {
  schemaVersion: "mockd.production-provisioning/v1";
  provisioningId: string;
  environment: "production";
  actorAccountId: string;
  accounts: readonly ProductionProvisioningAccount[];
  league: League;
  memberships: readonly PlatformLeagueMembership[];
  season: LeagueSeason<LeagueSeasonSettings>;
  catalog: readonly ProductionProvisioningCatalogEntry[];
  initialRosters: readonly ProductionProvisioningInitialRosterPlayer[];
  keepers: readonly ProductionProvisioningKeeper[];
}

export type ProductionProvisioningMode = "apply" | "dry-run" | "verify";
export type ProductionProvisioningChangeAction = "create" | "update" | "unchanged";

export interface ProductionProvisioningChange {
  resourceType: string;
  resourceId: string;
  action: ProductionProvisioningChangeAction;
}

export interface ProductionProvisioningInspection {
  changes: readonly ProductionProvisioningChange[];
  conflicts: readonly string[];
  auditRecorded: boolean;
}

export interface ResolvedProductionProvisioningAccount extends ProductionProvisioningAccount {
  passwordHash: string;
}

export interface ResolvedProductionProvisioningDocument
  extends Omit<ProductionProvisioningDocument, "accounts"> {
  accounts: readonly ResolvedProductionProvisioningAccount[];
}

export interface ProductionProvisioningContext {
  inputDigest: string;
  auditEventId: string;
  now: Date;
}

export interface ProductionProvisioningRepository {
  inspect(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<ProductionProvisioningInspection>;
  apply(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<void>;
  verify(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<readonly string[]>;
}

export interface ExecuteProductionProvisioningOptions {
  mode: ProductionProvisioningMode;
  document: ProductionProvisioningDocument;
  repository: ProductionProvisioningRepository;
  env?: Readonly<Record<string, string | undefined>> | undefined;
  now?: Date | undefined;
}

export interface ProductionProvisioningResult {
  mode: ProductionProvisioningMode;
  status: "planned" | "applied" | "unchanged" | "verified";
  provisioningId: string;
  inputDigest: string;
  auditEventId: string;
  changes: readonly ProductionProvisioningChange[];
}
