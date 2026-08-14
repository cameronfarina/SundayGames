import type {
  HistoricalImportBatch,
  HistoricalImportPlayerCatalogEntry,
  HistoricalOwnerMapping,
  HistoricalSaleRecord,
} from "../../historicalImports.js";
import type { HistoricalPlayerMapping } from "../../platformHistoricalImportWorkflow.js";

export interface PreviewPlatformHistoricalImportInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number;
  currentSeasonId?: string | undefined;
  sourceText: string;
  inferFirstRosterRowAsKeeper?: boolean | undefined;
  replacementRequested?: boolean | undefined;
  playerCatalog?: readonly HistoricalImportPlayerCatalogEntry[] | undefined;
  ownerMappings?: readonly HistoricalOwnerMapping[] | undefined;
  requireCompleteTeamMapping?: boolean | undefined;
  playerMappings?: readonly HistoricalPlayerMapping[] | undefined;
  now?: Date | undefined;
}

export interface CommitPlatformHistoricalImportInput {
  actorSessionToken: string;
  batchId: string;
  expectedLeagueId?: string | undefined;
  expectedLeagueSeasonId?: string | undefined;
  expectedSeasonYear?: number | undefined;
  now?: Date | undefined;
}

export interface PreparePlatformHistoricalImportCommitInput extends CommitPlatformHistoricalImportInput {
  pricingSeasonYear: number;
}

export interface PreparePlatformHistoricalImportCommitResult {
  batch: HistoricalImportBatch;
  projectedHistoricalSaleRecords: readonly HistoricalSaleRecord[];
}
