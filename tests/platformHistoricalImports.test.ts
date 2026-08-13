import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryHistoricalImportRepository,
  commitHistoricalImportBatch,
  previewHistoricalImportBatch,
  type NormalizedHistoricalImportRow,
} from "../src/platform/historicalImports.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const leagueSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
  seasonYear: 2025,
  setupStatus: "locked",
});

const row = (
  overrides: Partial<NormalizedHistoricalImportRow> = {},
): NormalizedHistoricalImportRow => {
  const playerId = overrides.playerId ?? "player-jamarr-chase";

  return {
    sourceRowNumber: 2,
    seasonYear: 2025,
    ownerDisplayName: "Cam",
    playerName: "Ja'Marr Chase",
    playerId,
    position: "WR",
    priceDollars: 61,
    playerResolution: { status: "resolved", playerId },
    keeper: false,
    acquisitionType: "auction",
    ...overrides,
  };
};

describe("platform historical imports", () => {
  const rowsForHistoricalTeams = (
    labels: readonly string[],
    seasonYear: number,
  ): NormalizedHistoricalImportRow[] => labels.map((ownerDisplayName, index) => ({
    sourceRowNumber: index + 2,
    seasonYear,
    ownerDisplayName,
    playerName: `Historical Player ${seasonYear}-${index + 1}`,
    playerId: `historical-player-${seasonYear}-${index + 1}`,
    position: "WR",
    priceDollars: 1,
    playerResolution: {
      status: "resolved",
      playerId: `historical-player-${seasonYear}-${index + 1}`,
    },
    keeper: false,
    acquisitionType: "auction",
  }));

  it("creates a preview batch from normalized rows", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:first",
      rows: [row()],
      now,
    });

    expect(batch).toMatchObject({
      id: "historical-import-league-214674-2025-sha256-first-001",
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:first",
      status: "previewed",
      blockers: [],
      warnings: [
        {
          code: "season_spend_mismatch",
          severity: "warning",
        },
      ],
    });
    expect(batch.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        status: "ready",
        blockers: [],
        warnings: [],
        record: expect.objectContaining({
          leagueId: leagueSeason.leagueId,
          seasonYear: 2025,
          ownerId: "owner-cam",
          playerId: "player-jamarr-chase",
          playerName: "Ja'Marr Chase",
          position: "WR",
          priceDollars: 61,
          keeper: false,
          acquisitionType: "auction",
        }),
      }),
    ]);
  });

  it("rejects a 14-team historical file before offering mappings for a four-team league", async () => {
    const fourTeamSeason = {
      ...leagueSeason,
      teams: leagueSeason.teams.slice(0, 4),
    };
    const repository = new InMemoryHistoricalImportRepository([fourTeamSeason]);
    const historicalLabels = Array.from({ length: 14 }, (_, index) => `Old Team ${index + 1}`);

    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: fourTeamSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:fourteen-into-four",
      requireCompleteTeamMapping: true,
      rows: rowsForHistoricalTeams(historicalLabels, 2025),
      now,
    });

    expect(batch.status).toBe("blocked");
    expect(batch.blockers).toEqual([
      expect.objectContaining({
        code: "team_count_mismatch",
        message: "This draft file contains 14 teams, but the current league has 4 teams.",
      }),
    ]);
    expect(batch.rows.flatMap(batchRow => batchRow.blockers)).toEqual([]);
  });

  it("requires historical team mappings to target every current team exactly once", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const historicalLabels = leagueSeason.teams.map((_, index) => `Legacy Team ${index + 1}`);
    const ownerMappings = historicalLabels.map((sourceOwnerOrTeamLabel, index) => ({
      sourceOwnerOrTeamLabel,
      teamId: leagueSeason.teams[index === 1 ? 0 : index]?.id ?? "missing-team",
    }));

    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:duplicate-team-target",
      ownerMappings,
      requireCompleteTeamMapping: true,
      rows: rowsForHistoricalTeams(historicalLabels, 2025),
      now,
    });

    expect(batch.status).toBe("blocked");
    expect(batch.blockers).toContainEqual(expect.objectContaining({
      code: "owner_mapping_not_one_to_one",
      message: "Each historical team must map to a different current team.",
    }));
  });

  it("accepts one normalized 14-team mapping set across multiple historical years", async () => {
    const currentSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      seasonYear: 2026,
      setupStatus: "draft",
    });
    const repository = new InMemoryHistoricalImportRepository([currentSeason]);
    const mappingLabels = currentSeason.teams.map((_, index) => ` Legacy Team ${index + 1} `);
    const ownerMappings = mappingLabels.map((sourceOwnerOrTeamLabel, index) => ({
      sourceOwnerOrTeamLabel,
      teamId: currentSeason.teams[index]?.id ?? "missing-team",
    }));

    for (const seasonYear of [2024, 2025]) {
      const sourceLabels = mappingLabels.map(label => label.trim().toUpperCase().replaceAll(" ", "   "));
      const batch = await previewHistoricalImportBatch({
        repository,
        leagueId: currentSeason.leagueId,
        seasonYear,
        seasonContext: { currentLeagueSeason: currentSeason },
        fileHash: `sha256:normalized-mappings-${seasonYear}`,
        ownerMappings,
        requireCompleteTeamMapping: true,
        rows: rowsForHistoricalTeams(sourceLabels, seasonYear),
        now,
      });

      expect(batch.status).toBe("previewed");
      expect(batch.blockers).toEqual([]);
      expect(new Set(batch.rows.map(batchRow => batchRow.record?.ownerId))).toHaveLength(14);
      const committed = await commitHistoricalImportBatch({
        repository,
        batchId: batch.id,
        now,
      });
      expect(committed.status).toBe("committed");
    }
    expect(repository.records()).toHaveLength(28);
  });

  it("blocks commit for missing season, invalid rows, duplicates, and unresolved required players", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const missingSeasonBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2024,
      fileHash: "sha256:missing-season",
      rows: [row({ seasonYear: 2024 })],
      now,
    });

    expect(missingSeasonBatch.status).toBe("blocked");
    expect(missingSeasonBatch.blockers.map(blocker => blocker.code)).toEqual(["season_missing"]);
    await expect(
      commitHistoricalImportBatch({
        repository,
        batchId: missingSeasonBatch.id,
        now,
      }),
    ).rejects.toThrow("Cannot commit historical import batch with blockers.");

    const invalidRowsBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:invalid-rows",
      rows: [
        row({
          sourceRowNumber: 3,
          ownerDisplayName: "Mystery Owner",
          position: "P",
          playerName: "",
          priceDollars: 12.5,
        }),
        row({
          sourceRowNumber: 4,
          playerName: "Bijan Robinson",
          playerId: "",
          position: "RB",
          playerResolution: { status: "unresolved", required: true, candidates: ["Bijan Robinson Jr."] },
        }),
        row({ sourceRowNumber: 5, priceDollars: -1 }),
        row({ sourceRowNumber: 6, playerName: "Amon-Ra St. Brown", playerId: "player-arsb" }),
        row({ sourceRowNumber: 7, playerName: "Amon-Ra St. Brown", playerId: "player-arsb", ownerDisplayName: "Sam" }),
      ],
      now,
    });

    expect(invalidRowsBatch.status).toBe("blocked");
    expect(invalidRowsBatch.blockers.map(blocker => blocker.code)).toEqual([
      "owner_unknown",
      "position_invalid",
      "player_missing",
      "price_invalid",
      "player_unresolved",
      "price_invalid",
      "player_duplicate",
      "player_duplicate",
    ]);
    expect(invalidRowsBatch.rows.map(batchRow => batchRow.status)).toEqual([
      "blocked",
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    await expect(
      commitHistoricalImportBatch({
        repository,
        batchId: invalidRowsBatch.id,
        now,
      }),
    ).rejects.toThrow("Cannot commit historical import batch with blockers.");
  });

  it("warns for spend mismatch and inferred keeper or acquisition details", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:warnings",
      rows: [
        {
          sourceRowNumber: 2,
          seasonYear: 2025,
          ownerDisplayName: "Cam",
          playerName: "Ja'Marr Chase",
          playerId: "player-jamarr-chase",
          position: "WR",
          priceDollars: 61,
          playerResolution: { status: "resolved", playerId: "player-jamarr-chase" },
        },
      ],
      now,
    });

    expect(batch.status).toBe("previewed");
    expect(batch.warnings.map(warning => warning.code)).toEqual(["season_spend_mismatch"]);
    expect(batch.rows[0]?.warnings.map(warning => warning.code)).toEqual([
      "keeper_inferred",
      "acquisition_type_inferred",
    ]);
    expect(batch.rows[0]?.record).toEqual(expect.objectContaining({
      keeper: false,
      acquisitionType: "auction",
    }));
  });

  it("commits a preview batch into normalized historical sale records", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:commit",
      rows: [row()],
      now,
    });

    const committed = await commitHistoricalImportBatch({
      repository,
      batchId: batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });

    expect(committed.status).toBe("committed");
    expect(committed.committedAt).toEqual(new Date("2026-08-09T12:01:00.000Z"));
    expect(repository.records()).toEqual([
      expect.objectContaining({
        id: `${batch.id}-row-001`,
        batchId: batch.id,
        leagueId: leagueSeason.leagueId,
        leagueSeasonId: leagueSeason.id,
        seasonYear: 2025,
        ownerId: "owner-cam",
        playerId: "player-jamarr-chase",
      }),
    ]);
  });

  it("validates the intended season target before mutating import state", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const batch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:target-guard",
      rows: [row()],
      now,
    });

    await expect(commitHistoricalImportBatch({
      repository,
      batchId: batch.id,
      expectedLeagueSeasonId: "another-season",
      expectedSeasonYear: 2024,
      now: new Date("2026-08-09T12:01:00.000Z"),
    })).rejects.toMatchObject({ code: "batch_target_mismatch" });

    const unchangedBatch = repository.findBatchById(batch.id);
    expect(unchangedBatch).toEqual(expect.objectContaining({ status: "previewed" }));
    expect(unchangedBatch).not.toHaveProperty("committedAt");
    expect(repository.records()).toEqual([]);
  });

  it("requires explicit replacement before superseding a committed batch for a season", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:first-season-file",
      rows: [row()],
      now,
    });
    const secondBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:second-season-file",
      rows: [row({
        playerName: "Justin Jefferson",
        playerId: "player-justin-jefferson",
        playerResolution: { status: "resolved", playerId: "player-justin-jefferson" },
      })],
      now: new Date("2026-08-09T12:02:00.000Z"),
    });

    await commitHistoricalImportBatch({
      repository,
      batchId: firstBatch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });

    await expect(
      commitHistoricalImportBatch({
        repository,
        batchId: secondBatch.id,
        now: new Date("2026-08-09T12:03:00.000Z"),
      }),
    ).rejects.toThrow("Historical import batch already exists for this league season. Request replacement to supersede it.");
    const stillCurrentBatch = repository.findBatchById(firstBatch.id);
    expect(stillCurrentBatch).toEqual(expect.objectContaining({ status: "committed" }));
    expect(stillCurrentBatch).not.toHaveProperty("supersededByBatchId");
    expect(repository.currentRecords(leagueSeason.leagueId, 2025)).toEqual([
      expect.objectContaining({ batchId: firstBatch.id, playerId: "player-jamarr-chase" }),
    ]);
  });

  it("supersedes the prior committed batch for a league season without deleting old records", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:first-season-file",
      rows: [row({ playerName: "Ja'Marr Chase", playerId: "player-jamarr-chase" })],
      now,
    });
    const committedFirst = await commitHistoricalImportBatch({
      repository,
      batchId: firstBatch.id,
      now,
    });
    const replacementBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:replacement-season-file",
      replacementRequested: true,
      rows: [row({ playerName: "Justin Jefferson", playerId: "player-justin-jefferson" })],
      now: new Date("2026-08-09T12:02:00.000Z"),
    });

    const committedReplacement = await commitHistoricalImportBatch({
      repository,
      batchId: replacementBatch.id,
      now: new Date("2026-08-09T12:03:00.000Z"),
    });

    expect(committedReplacement.status).toBe("committed");
    expect(repository.findBatchById(committedFirst.id)).toEqual(expect.objectContaining({
      status: "superseded",
      supersededByBatchId: committedReplacement.id,
    }));
    expect(repository.records()).toEqual([
      expect.objectContaining({ batchId: committedFirst.id, playerId: "player-jamarr-chase" }),
      expect.objectContaining({ batchId: committedReplacement.id, playerId: "player-justin-jefferson" }),
    ]);
  });

  it("treats the same league season file hash as idempotent unless replacement is requested", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstBatch = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:same-file",
      rows: [row()],
      now,
    });
    const duplicatePreviewBeforeCommit = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:same-file",
      rows: [row({ playerName: "Changed Input", playerId: "player-changed" })],
      now: new Date("2026-08-09T12:00:30.000Z"),
    });

    expect(duplicatePreviewBeforeCommit.id).toBe(firstBatch.id);

    const committedFirst = await commitHistoricalImportBatch({
      repository,
      batchId: firstBatch.id,
      now,
    });

    const idempotentPreview = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:same-file",
      rows: [row({ playerName: "Changed Input", playerId: "player-changed" })],
      now: new Date("2026-08-09T12:04:00.000Z"),
    });
    const idempotentCommit = await commitHistoricalImportBatch({
      repository,
      batchId: idempotentPreview.id,
      now: new Date("2026-08-09T12:05:00.000Z"),
    });

    expect(idempotentPreview.id).toBe(committedFirst.id);
    expect(idempotentCommit.id).toBe(committedFirst.id);
    expect(repository.records()).toHaveLength(1);

    const replacementPreview = await previewHistoricalImportBatch({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      fileHash: "sha256:same-file",
      replacementRequested: true,
      rows: [row({ playerName: "Changed Input", playerId: "player-changed" })],
      now: new Date("2026-08-09T12:06:00.000Z"),
    });
    const committedReplacement = await commitHistoricalImportBatch({
      repository,
      batchId: replacementPreview.id,
      now: new Date("2026-08-09T12:07:00.000Z"),
    });

    expect(committedReplacement.id).not.toBe(committedFirst.id);
    expect(repository.records()).toEqual([
      expect.objectContaining({ batchId: committedFirst.id, playerId: "player-jamarr-chase" }),
      expect.objectContaining({ batchId: committedReplacement.id, playerId: "player-changed" }),
    ]);
  });
});
