import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryHistoricalImportRepository,
} from "../src/platform/historicalImports.js";
import {
  commitHistoricalImportWorkflow,
  previewHistoricalImportSourceWorkflow,
} from "../src/platform/platformHistoricalImportWorkflow.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const leagueSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
  seasonYear: 2025,
  setupStatus: "locked",
});

const sourceText = (
  overrides: {
    owner?: string;
    player?: string;
    position?: string;
    price?: string;
    playerId?: string;
    keeper?: string;
    acquisitionType?: string;
  } = {},
): string => [
  "owner,player,position,price,year,player id,keeper,acquisition",
  [
    overrides.owner ?? "Cam",
    overrides.player ?? "Ja'Marr Chase",
    overrides.position ?? "WR",
    overrides.price ?? "$61",
    "2025",
    overrides.playerId ?? "player-jamarr-chase",
    overrides.keeper ?? "false",
    overrides.acquisitionType ?? "auction",
  ].join(","),
].join("\n");

describe("platform historical import workflow", () => {
  it("previews source text and commits the ready batch records", () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const preview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const commit = commitHistoricalImportWorkflow({
      repository,
      batchId: preview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });

    expect(preview.source).toMatchObject({
      fileHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      sourceRowCount: 2,
      sourceWarnings: [],
    });
    expect(preview.batch).toMatchObject({
      fileHash: preview.source.fileHash,
      status: "previewed",
      blockers: [],
    });
    expect(commit.batch).toMatchObject({
      id: preview.batch.id,
      status: "committed",
      committedAt: new Date("2026-08-09T12:01:00.000Z"),
    });
    expect(commit.committedRecords).toEqual([
      expect.objectContaining({
        batchId: preview.batch.id,
        leagueId: leagueSeason.leagueId,
        leagueSeasonId: leagueSeason.id,
        playerId: "player-jamarr-chase",
        playerName: "Ja'Marr Chase",
        priceDollars: 61,
      }),
    ]);
  });

  it("surfaces parse warnings without bypassing downstream blockers", () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const preview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText({
        owner: "Mystery Owner",
        player: "Unknown Player",
        playerId: "",
        keeper: "maybe",
      }),
      now,
    });

    expect(preview.source.sourceWarnings.map(warning => warning.code)).toEqual(["invalid_keeper"]);
    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers.map(blocker => blocker.code)).toEqual([
      "owner_unknown",
      "player_unresolved",
    ]);
    expect(() =>
      commitHistoricalImportWorkflow({
        repository,
        batchId: preview.batch.id,
        now: new Date("2026-08-09T12:02:00.000Z"),
      }),
    ).toThrow("Cannot commit historical import batch with blockers.");
  });

  it("treats duplicate source files as idempotent through preview and commit", () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstPreview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const duplicatePreview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now: new Date("2026-08-09T12:00:30.000Z"),
    });

    const firstCommit = commitHistoricalImportWorkflow({
      repository,
      batchId: firstPreview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });
    const duplicateCommit = commitHistoricalImportWorkflow({
      repository,
      batchId: duplicatePreview.batch.id,
      now: new Date("2026-08-09T12:02:00.000Z"),
    });

    expect(duplicatePreview.batch.id).toBe(firstPreview.batch.id);
    expect(firstCommit.batch.id).toBe(firstPreview.batch.id);
    expect(duplicateCommit.batch.id).toBe(firstCommit.batch.id);
    expect(duplicateCommit.committedRecords).toEqual(firstCommit.committedRecords);
    expect(repository.records()).toHaveLength(1);
  });

  it("commits replacement imports as the current batch and supersedes the prior batch", () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstPreview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const firstCommit = commitHistoricalImportWorkflow({
      repository,
      batchId: firstPreview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });
    const replacementPreview = previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText({
        owner: "Sam",
        player: "Justin Jefferson",
        playerId: "player-justin-jefferson",
      }),
      replacementRequested: true,
      now: new Date("2026-08-09T12:02:00.000Z"),
    });

    const replacementCommit = commitHistoricalImportWorkflow({
      repository,
      batchId: replacementPreview.batch.id,
      now: new Date("2026-08-09T12:03:00.000Z"),
    });

    expect(replacementCommit.batch).toMatchObject({
      id: replacementPreview.batch.id,
      status: "committed",
    });
    expect(repository.findBatchById(firstCommit.batch.id)).toEqual(expect.objectContaining({
      status: "superseded",
      supersededByBatchId: replacementCommit.batch.id,
    }));
    expect(replacementCommit.committedRecords).toEqual([
      expect.objectContaining({
        batchId: replacementCommit.batch.id,
        playerId: "player-justin-jefferson",
      }),
    ]);
    expect(repository.records()).toEqual([
      expect.objectContaining({ batchId: firstCommit.batch.id, playerId: "player-jamarr-chase" }),
      expect.objectContaining({ batchId: replacementCommit.batch.id, playerId: "player-justin-jefferson" }),
    ]);
    expect(repository.currentRecords(leagueSeason.leagueId, 2025)).toEqual([
      expect.objectContaining({ batchId: replacementCommit.batch.id, playerId: "player-justin-jefferson" }),
    ]);
  });
});
