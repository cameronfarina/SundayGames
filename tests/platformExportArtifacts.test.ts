import { describe, expect, it } from "vitest";
import type { DraftExportResult } from "../src/platform/draftExport.js";
import {
  ExportArtifactError,
  InMemoryExportArtifactRepository,
  createDraftExportArtifact,
} from "../src/platform/exportArtifacts.js";

const createdAt = new Date("2026-08-09T15:30:00.000Z");

const draftExportResult: DraftExportResult = {
  sheetName: "Draft Results",
  table: [
    ["Slot", "Player", "Price"],
    ["QB", "Jayden Daniels", 25],
  ],
  csv: "Slot,Player,Price\nQB,Jayden Daniels,25\n",
};

const artifactInput = {
  draftExport: draftExportResult,
  leagueId: "league_214674",
  seasonId: "season_2026",
  roomId: "room_final",
  sourceRevision: 7,
  createdAt,
} as const;

describe("platform export artifacts", () => {
  it("wraps a draft CSV export with deterministic metadata and a sha256 payload hash", () => {
    const { artifact, content } = createDraftExportArtifact(artifactInput);

    expect(Buffer.isBuffer(content)).toBe(true);
    expect(content.toString("utf8")).toBe(draftExportResult.csv);
    expect(artifact).toEqual({
      id: "draft-room-export:league_214674:season_2026:room_final:rev7:csv",
      leagueId: "league_214674",
      seasonId: "season_2026",
      roomId: "room_final",
      format: "csv",
      sourceRevision: 7,
      createdAt,
      storageKey: "exports/league_214674/season_2026/room_final/rev7.csv",
      sha256: "f213e24300b0bd03d1b0e0302472b5bed1aef6e42bbe08533efe4a01cdcc8d55",
      byteLength: 39,
      contentType: "text/csv; charset=utf-8",
    });
  });

  it("keeps storage keys stable across export creation times", () => {
    const first = createDraftExportArtifact(artifactInput).artifact;
    const replay = createDraftExportArtifact({
      ...artifactInput,
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
    }).artifact;

    expect(replay.id).toBe(first.id);
    expect(replay.storageKey).toBe(first.storageKey);
    expect(replay.createdAt).not.toEqual(first.createdAt);
  });

  it("saves identical artifacts idempotently", () => {
    const repository = new InMemoryExportArtifactRepository();
    const artifactResult = createDraftExportArtifact(artifactInput);

    const saved = repository.save(artifactResult);
    const replay = repository.save({
      artifact: { ...artifactResult.artifact },
      content: Buffer.from(artifactResult.content),
    });

    expect(replay).toEqual(saved);
    expect(repository.get(artifactResult.artifact.id)).toEqual(saved);
    expect(repository.findByRoomRevision("room_final", 7)).toEqual(saved);
    expect(repository.listByRoom("room_final")).toEqual([saved.artifact]);
    expect(repository.contents()).toEqual([
      {
        artifactId: artifactResult.artifact.id,
        contentBase64: artifactResult.content.toString("base64"),
      },
    ]);
  });

  it("rejects a same-id artifact with different content hash", () => {
    const repository = new InMemoryExportArtifactRepository();
    const first = createDraftExportArtifact(artifactInput).artifact;
    const conflicting = createDraftExportArtifact({
      ...artifactInput,
      draftExport: {
        ...draftExportResult,
        csv: `${draftExportResult.csv}RB,Bijan Robinson,70\n`,
      },
    }).artifact;

    repository.save({ artifact: first, content: Buffer.from(draftExportResult.csv, "utf8") });

    expect(conflicting.id).toBe(first.id);
    expect(conflicting.sha256).not.toBe(first.sha256);
    expect(() =>
      repository.save({
        artifact: conflicting,
        content: Buffer.from(`${draftExportResult.csv}RB,Bijan Robinson,70\n`, "utf8"),
      }),
    ).toThrow(new ExportArtifactError(
      "artifact_conflict",
      "An export artifact already exists for this id with different content.",
    ));
  });

  it("lists room artifacts newest first and filters other rooms", () => {
    const repository = new InMemoryExportArtifactRepository();
    const older = createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 6,
      createdAt: new Date("2026-08-09T15:00:00.000Z"),
    }).artifact;
    const newer = createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 8,
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
    }).artifact;
    const otherRoom = createDraftExportArtifact({
      ...artifactInput,
      roomId: "room_consolation",
      sourceRevision: 1,
      createdAt: new Date("2026-08-09T17:00:00.000Z"),
    }).artifact;

    repository.save(createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 6,
      createdAt: new Date("2026-08-09T15:00:00.000Z"),
    }));
    repository.save(createDraftExportArtifact({
      ...artifactInput,
      roomId: "room_consolation",
      sourceRevision: 1,
      createdAt: new Date("2026-08-09T17:00:00.000Z"),
    }));
    repository.save(createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 8,
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
    }));

    expect(repository.listByRoom("room_final").map(artifact => artifact.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });
});
