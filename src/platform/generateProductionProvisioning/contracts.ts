import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Owner } from "../../../config/league.js";
import type { FantasyTeam } from "../leagueSeason.js";
import type { ProductionProvisioningCatalogEntry } from "../productionProvisioning.js";

export interface ProductionOwnerAccountMapping {
  owner: Owner;
  email: string;
  passwordHashEnv: string;
}

export interface ProductionKeeperSelection {
  owner: Owner;
  player: string;
}

export interface ProductionOwnerAccountMappingDocument {
  commissionerOwner: Owner;
  owners: readonly ProductionOwnerAccountMapping[];
  selectedKeepers: readonly ProductionKeeperSelection[];
}

export interface ProductionProvisioningAccountReference {
  id: string;
  email: string;
  passwordHashEnv: string;
}

export interface ResolvedKeeperRecord {
  keeper: KeeperDeclaration;
  team: FantasyTeam;
  player: ProductionProvisioningCatalogEntry;
}
