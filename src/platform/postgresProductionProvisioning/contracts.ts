import type { AuthRepository } from "../auth.js";
import type { LiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { ProductionProvisioningChange } from "../productionProvisioning.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export interface ProductionProvisioningDependencies {
  client: PostgresQueryClient;
  authRepository: AuthRepository;
  leagueSetupRepository: LeagueSetupRepository;
  draftSetupRepository: LiveDraftRoomSetupRepository;
}

export interface InspectionPart {
  changes: readonly ProductionProvisioningChange[];
  conflicts: readonly string[];
}

export interface PlayerRow {
  id: string;
  provider: string | null;
  provider_player_id: string | null;
  canonical_name: string;
  position: string;
  nfl_team: string | null;
  bye_week: number | null;
  active: boolean;
}

export interface KeeperRow {
  id: string;
  fantasy_team_id: string;
  player_id: string;
  player_name: string;
  position: string;
  keeper_cost: number;
  previous_cost: number | null;
  status: string;
  source: string;
}
