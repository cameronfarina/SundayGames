import { describe, expect, it } from "vitest";
import type { DraftExportArtifactResult } from "../src/platform/exportArtifacts.js";
import type { DraftRoomExportWithContentRow } from "../src/platform/postgresExportArtifacts/contracts.js";
import { firstRow, jsonbParameter } from "../src/platform/postgresExportArtifacts/databaseValues.js";
import { assertSameArtifactContent } from "../src/platform/postgresExportArtifacts/errors.js";
import { requireCreatedByUserId } from "../src/platform/postgresExportArtifacts/options.js";
import { resultFromRow } from "../src/platform/postgresExportArtifacts/rowCodec.js";

const row = (format = "csv"): DraftRoomExportWithContentRow => ({
  id: "artifact_1",
  league_id: "league_1",
  league_season_id: "season_1",
  draft_room_id: "room_1",
  artifact_type: format,
  storage_key: null,
  payload_hash: "hash_1",
  content_type: "text/csv; charset=utf-8",
  byte_length: 4,
  source_revision: 2,
  created_at: "2026-08-09T15:30:00.000Z",
  content_base64: Buffer.from("csv\n").toString("base64"),
});

const result = (sha256: string): DraftExportArtifactResult => ({
  artifact: {
    id: "artifact_1",
    leagueId: "league_1",
    seasonId: "season_1",
    roomId: "room_1",
    format: "csv",
    sourceRevision: 2,
    createdAt: new Date("2026-08-09T15:30:00.000Z"),
    storageKey: "exports/room_1.csv",
    sha256,
    byteLength: 4,
    contentType: "text/csv; charset=utf-8",
  },
  content: Buffer.from("csv\n"),
});

describe("Postgres export artifact database boundaries", () => {
  it("decodes CSV content, timestamps, and nullable storage keys", () => {
    expect(resultFromRow(row())).toEqual({
      artifact: {
        id: "artifact_1",
        leagueId: "league_1",
        seasonId: "season_1",
        roomId: "room_1",
        format: "csv",
        sourceRevision: 2,
        createdAt: new Date("2026-08-09T15:30:00.000Z"),
        storageKey: "",
        sha256: "hash_1",
        byteLength: 4,
        contentType: "text/csv; charset=utf-8",
      },
      content: Buffer.from("csv\n"),
    });
  });

  it("rejects unsupported persisted artifact formats", () => {
    expect(() => resultFromRow(row("json"))).toThrow(
      "Unsupported export artifact format: json",
    );
  });

  it("requires a nonblank creator identity for new artifacts", () => {
    expect(() => requireCreatedByUserId(undefined)).toThrow("createdByUserId is required");
    expect(() => requireCreatedByUserId({ createdByUserId: "  " })).toThrow(
      "createdByUserId is required",
    );
    expect(requireCreatedByUserId({ createdByUserId: "user_commish" })).toBe("user_commish");
  });

  it("rejects content-hash conflicts while permitting idempotent content", () => {
    expect(() => assertSameArtifactContent(result("hash_1"), result("hash_1"))).not.toThrow();
    expect(() => assertSameArtifactContent(result("hash_1"), result("hash_2"))).toThrow(
      "An export artifact already exists for this id with different content.",
    );
  });

  it("encodes JSON parameters and handles empty query results", () => {
    expect(jsonbParameter({ sheetName: "Draft Results" })).toBe(
      '{"sheetName":"Draft Results"}',
    );
    expect(firstRow({ rows: [] })).toBeUndefined();
  });
});
