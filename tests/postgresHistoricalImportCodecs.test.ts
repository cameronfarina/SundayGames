import { describe, expect, it } from "vitest";
import { batchFromRow } from "../src/platform/postgresHistoricalImports/batchCodec.js";
import { saleRecordFromRow } from "../src/platform/postgresHistoricalImports/saleCodec.js";
import type {
  HistoricalImportBatchRow,
  HistoricalSaleRow,
} from "../src/platform/postgresHistoricalImports/rows.js";

const batchRow = (status = "committed"): HistoricalImportBatchRow => ({
  id: "batch-1",
  league_id: "league-private",
  league_season_id: "season-2025",
  season_year: 2025,
  uploaded_by_user_id: "user-1",
  file_hash: "sha256:private",
  status,
  replacement_requested: true,
  mapping_json: JSON.stringify({
    rows: [{
      rowNumber: 2,
      status: "ready",
      blockers: [],
      warnings: [],
      record: null,
    }],
  }),
  warnings_json: JSON.stringify([{ code: "keeper_inferred", severity: "warning", message: "Inferred." }]),
  blockers_json: "[]",
  created_at: "2026-08-09T12:00:00.000Z",
  committed_at: "2026-08-09T12:01:00.000Z",
  superseded_at: null,
  superseded_by_batch_id: null,
});

const saleRow = (position = "WR", acquisitionType = "auction"): HistoricalSaleRow => ({
  id: "sale-1",
  league_id: "league-private",
  league_season_id: "season-2025",
  season_year: 2025,
  import_batch_id: "batch-1",
  owner_id: "team-1",
  owner_display_name: "Owner One",
  player_id: "player-1",
  player_name: "Player One",
  position,
  price_dollars: 20,
  public_price_dollars: null,
  keeper: false,
  acquisition_type: acquisitionType,
  row_number: 2,
});

describe("Postgres historical import codecs", () => {
  it("decodes valid JSONB rows into isolated domain values", () => {
    const batch = batchFromRow(batchRow());

    expect(batch).toMatchObject({
      id: "batch-1",
      leagueId: "league-private",
      status: "committed",
      warnings: [{ code: "keeper_inferred", severity: "warning" }],
      rows: [{ rowNumber: 2, status: "ready", record: null }],
    });
    expect(batch.createdAt).toEqual(new Date("2026-08-09T12:00:00.000Z"));
  });

  it("rejects invalid persisted domain enums", () => {
    expect(() => batchFromRow(batchRow("unknown"))).toThrow("Invalid historical import batch status");
    expect(() => saleRecordFromRow(saleRow("FLEX"))).toThrow("Invalid historical sale position");
    expect(() => saleRecordFromRow(saleRow("WR", "waiver"))).toThrow("Invalid historical acquisition type");
  });

  it("drops malformed JSONB preview rows instead of exposing unvalidated data", () => {
    const stored = batchRow();
    stored.mapping_json = JSON.stringify({
      rows: [{ rowNumber: "private", status: "ready", record: null }],
    });

    expect(batchFromRow(stored).rows).toEqual([]);
  });
});
