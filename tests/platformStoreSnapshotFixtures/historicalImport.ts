import type {
  HistoricalImportBatch,
  HistoricalImportIssue,
  HistoricalSaleRecord,
} from "../../src/platform/historicalImports.js";

const sale: HistoricalSaleRecord = {
  id: "sale-1",
  batchId: "batch-1",
  leagueId: "league-1",
  leagueSeasonId: "season-1",
  seasonYear: 2025,
  rowNumber: 2,
  ownerId: "owner-1",
  ownerDisplayName: "Cam",
  playerId: "puka-nacua",
  playerName: "Puka Nacua",
  position: "WR",
  priceDollars: 62,
  publicPriceDollars: 58,
  keeper: true,
  acquisitionType: "keeper",
};

const issue: HistoricalImportIssue = {
  code: "player_ambiguous",
  severity: "blocker",
  message: "Choose the matching player.",
  rowNumber: 3,
  sourceValue: "Puka",
  candidates: [
    { playerId: "puka-nacua", playerName: "Puka Nacua", position: "WR" },
    { teamId: "team-1", teamDisplayName: "Short King", ownerDisplayName: "Cam" },
  ],
};

export const persistedHistoricalImport = (): HistoricalImportBatch => ({
  id: "batch-1",
  leagueId: "league-1",
  leagueSeasonId: "season-1",
  seasonYear: 2025,
  fileHash: "file-hash",
  uploadedByUserId: "user-cam",
  status: "superseded",
  replacementRequested: true,
  createdAt: new Date("2026-08-09T12:00:00.000Z"),
  committedAt: new Date("2026-08-09T12:01:00.000Z"),
  supersededAt: new Date("2026-08-09T12:02:00.000Z"),
  supersededByBatchId: "batch-2",
  blockers: [issue],
  warnings: [{
    code: "owner_fuzzy_match",
    severity: "warning",
    message: "Owner matched by name.",
  }],
  rows: [{
    rowNumber: 2,
    status: "ready",
    blockers: [],
    warnings: [],
    record: sale,
    identityAudit: {
      sourceOwnerOrTeamLabel: "Cam",
      resolution: "fuzzy",
      mappedTeamId: "team-1",
      mappedCurrentOwnerDisplayName: "Cam",
      mappedCurrentTeamDisplayName: "Short King",
      candidates: [{
        teamId: "team-1",
        teamDisplayName: "Short King",
        ownerDisplayName: "Cam",
      }],
    },
  }, {
    rowNumber: 3,
    status: "blocked",
    blockers: [issue],
    warnings: [],
    record: null,
  }],
});
