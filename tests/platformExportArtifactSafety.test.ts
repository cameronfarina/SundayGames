import { describe, expect, it } from "vitest";
import type { DraftExportResult } from "../src/platform/draftExport.js";
import {
  InMemoryExportArtifactRepository,
  createDraftExportArtifact,
} from "../src/platform/exportArtifacts.js";

const draftExport: DraftExportResult = {
  sheetName: "Draft Results",
  table: [["Player"], ["De'Von Achane"]],
  csv: "Player\nDe'Von Achane\n",
};

const createArtifact = () => createDraftExportArtifact({
  draftExport,
  leagueId: " league/group ",
  seasonId: "season 2026",
  roomId: "room/final",
  sourceRevision: 4,
  createdAt: new Date("2026-08-09T15:30:00.000Z"),
});

describe("in-memory export artifact safety", () => {
  it("encodes trimmed storage path segments without changing the artifact id", () => {
    const result = createArtifact();

    expect(result.artifact.id).toBe(
      "draft-room-export: league/group :season 2026:room/final:rev4:csv",
    );
    expect(result.artifact.storageKey).toBe(
      "exports/league%2Fgroup/season%202026/room%2Ffinal/rev4.csv",
    );
  });

  it("isolates stored artifacts and content from caller mutation", () => {
    const repository = new InMemoryExportArtifactRepository();
    const incoming = createArtifact();
    const saved = repository.save(incoming, { createdByUserId: "user_commish" });

    incoming.artifact.createdAt.setUTCFullYear(2000);
    incoming.content.fill(0);
    saved.artifact.createdAt.setUTCFullYear(2001);
    saved.content.fill(1);

    expect(repository.get(saved.artifact.id)).toEqual(createArtifact());
  });

  it("restores only snapshot artifacts that have matching content", () => {
    const repository = new InMemoryExportArtifactRepository();
    const result = createArtifact();
    repository.replaceArtifactsAndContents(
      [result.artifact, { ...result.artifact, id: "missing_content" }],
      [{
        artifactId: result.artifact.id,
        contentBase64: result.content.toString("base64"),
      }],
    );

    expect(repository.artifacts()).toEqual([result.artifact]);
    expect(repository.get("missing_content")).toBeUndefined();
  });

  it("orders timestamp ties by revision and then artifact id", () => {
    const repository = new InMemoryExportArtifactRepository();
    const result = createArtifact();
    const artifacts = [
      { ...result.artifact, id: "artifact_z", sourceRevision: 4 },
      { ...result.artifact, id: "artifact_a", sourceRevision: 4 },
      { ...result.artifact, id: "artifact_old", sourceRevision: 3 },
    ];
    repository.replaceArtifactsAndContents(
      artifacts,
      artifacts.map(artifact => ({
        artifactId: artifact.id,
        contentBase64: result.content.toString("base64"),
      })),
    );

    expect(repository.listByRoom("room/final").map(artifact => artifact.id)).toEqual([
      "artifact_a",
      "artifact_z",
      "artifact_old",
    ]);
    expect(repository.findByRoomRevision("room/final", 99)).toBeUndefined();
  });
});
