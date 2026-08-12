import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AnyLeagueSeason,
} from "../src/platform/leagueSeason.js";
import {
  InMemoryHistoricalImportRepository,
  type HistoricalImportPlayerCatalogEntry,
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

const playerCatalog = [
  { playerId: "player-jamarr-chase", name: "Ja'Marr Chase", position: "WR" },
  { name: "De'Von Achane", position: "RB" },
] as const satisfies readonly HistoricalImportPlayerCatalogEntry[];
const camTeam = leagueSeason.teams.find(team => team.ownerDisplayName === "Cam");

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
  it("resolves an ordinary no-ID spreadsheet row against the current catalog", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Ja'Marr Chase,WR,$61",
        "Sam,Devon Achane,RB,$50",
      ].join("\n"),
      playerCatalog,
      now,
    });

    expect(preview.source.playerResolutionIssues).toEqual([]);
    expect(preview.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(preview.batch.rows).toEqual([
      expect.objectContaining({
        status: "ready",
        record: expect.objectContaining({
          ownerId: "owner-cam",
          playerId: "player-jamarr-chase",
          playerName: "Ja'Marr Chase",
        }),
      }),
      expect.objectContaining({
        status: "ready",
        record: expect.objectContaining({
          ownerId: "owner-sam",
          playerId: "player-devon-achane-rb",
          playerName: "De'Von Achane",
        }),
      }),
    ]);
  });

  it("keeps retired historical players that are absent from the current catalog", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Mark Ingram,RB,$1",
      ].join("\n"),
      playerCatalog,
      now,
    });

    expect(preview.source.playerResolutionIssues).toEqual([
      expect.objectContaining({
        code: "player_historical_only",
        severity: "warning",
        rowNumber: 2,
        sourceValue: "Mark Ingram",
        message: expect.stringContaining(
          "Mark Ingram (RB) is not in the current player catalog and was imported as a historical-only player.",
        ),
      }),
    ]);
    expect(preview.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(preview.batch.rows[0]?.record).toEqual(expect.objectContaining({
      playerId: "player-mark-ingram-rb",
      playerName: "Mark Ingram",
      position: "RB",
      priceDollars: 1,
    }));
  });

  it("warns about likely catalog matches without blocking a historical-only player", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Jahmyr Gibs,RB,$70",
      ].join("\n"),
      playerCatalog: [
        ...playerCatalog,
        { playerId: "player-jahmyr-gibbs", name: "Jahmyr Gibbs", position: "RB" },
      ],
      now,
    });

    expect(preview.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(preview.batch.rows[0]?.record).toEqual(expect.objectContaining({
      playerId: "player-jahmyr-gibs-rb",
      playerName: "Jahmyr Gibs",
    }));
    expect(preview.source.playerResolutionIssues).toEqual([
      expect.objectContaining({
        code: "player_historical_only",
        severity: "warning",
        rowNumber: 2,
        sourceValue: "Jahmyr Gibs",
        candidates: [expect.objectContaining({
          playerId: "player-jahmyr-gibbs",
          playerName: "Jahmyr Gibbs",
          position: "RB",
        })],
        message: expect.stringContaining("Possible current match: Jahmyr Gibbs (RB)."),
      }),
    ]);
  });

  it.each([
    {
      label: "is absent from the catalog",
      source: sourceText({ playerId: "bogus-id" }),
      message: "Player ID \"bogus-id\" is not in the current player catalog.",
    },
    {
      label: "does not match the row name",
      source: sourceText({ player: "De'Von Achane" }),
      message: "Player ID \"player-jamarr-chase\" belongs to Ja'Marr Chase, not \"De'Von Achane\".",
    },
    {
      label: "does not match the row position",
      source: sourceText({ position: "RB" }),
      message: "Player ID \"player-jamarr-chase\" is a WR, not RB.",
    },
  ])("blocks a supplied player ID that $label", async ({ source, message }) => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: source,
      playerCatalog,
      now,
    });

    expect(preview.batch.status).toBe("blocked");
    expect(preview.source.playerResolutionIssues).toEqual([
      expect.objectContaining({
        code: "player_unresolved",
        rowNumber: 2,
        message: expect.stringContaining(message),
      }),
    ]);
    expect(preview.batch.rows[0]).toMatchObject({
      status: "blocked",
      record: null,
      blockers: [expect.objectContaining({ code: "player_unresolved", rowNumber: 2 })],
    });
  });

  it("blocks an ambiguous no-ID player with explicit catalog candidates", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Chris Jones,WR,$4",
      ].join("\n"),
      playerCatalog: [
        { playerId: "player-chris-jones-a", name: "Chris Jones", position: "WR" },
        { playerId: "player-chris-jones-b", name: "Chris Jones", position: "WR" },
      ],
      now,
    });

    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers).toEqual([
      expect.objectContaining({
        code: "player_ambiguous",
        rowNumber: 2,
        candidates: [
          expect.objectContaining({ playerId: "player-chris-jones-a" }),
          expect.objectContaining({ playerId: "player-chris-jones-b" }),
        ],
      }),
    ]);
    expect(preview.source.playerResolutionIssues).toEqual([
      expect.objectContaining({ code: "player_ambiguous", rowNumber: 2 }),
    ]);

    const mapped = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Chris Jones,WR,$4",
      ].join("\n"),
      playerCatalog: [
        { playerId: "player-chris-jones-a", name: "Chris Jones", position: "WR" },
        { playerId: "player-chris-jones-b", name: "Chris Jones", position: "WR" },
      ],
      playerMappings: [{ rowNumber: 2, playerId: "player-chris-jones-b" }],
      now,
    });

    expect(mapped.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(mapped.batch.rows[0]?.record).toEqual(expect.objectContaining({
      playerId: "player-chris-jones-b",
      playerName: "Chris Jones",
    }));
  });

  it("does not collapse duplicate catalog rows that both need generated player IDs", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "owner,player,position,price",
        "Cam,Chris Jones,WR,$4",
      ].join("\n"),
      playerCatalog: [
        { name: "Chris Jones", position: "WR" },
        { name: "Chris Jones", position: "WR" },
      ],
      now,
    });

    expect(preview.batch.blockers[0]).toEqual(expect.objectContaining({
      code: "player_ambiguous",
      candidates: [
        expect.objectContaining({ playerId: "player-chris-jones-wr-1" }),
        expect.objectContaining({ playerId: "player-chris-jones-wr-2" }),
      ],
    }));
  });

  it("automatically maps a uniquely recognizable renamed historical owner label", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const source = [
      "team,player,position,price",
      "Cam's Old Team,Ja'Marr Chase,WR,$61",
    ].join("\n");
    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: source,
      playerCatalog,
      now,
    });

    expect(preview.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(preview.batch.rows[0]).toEqual(expect.objectContaining({
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "owner_fuzzy_match", severity: "warning" }),
      ]),
      identityAudit: expect.objectContaining({
        sourceOwnerOrTeamLabel: "Cam's Old Team",
        resolution: "fuzzy",
        mappedTeamId: camTeam?.id,
        mappedCurrentOwnerDisplayName: "Cam",
      }),
      record: expect.objectContaining({
        ownerId: "owner-cam",
        ownerDisplayName: "Cam's Old Team",
      }),
    }));
  });

  it("blocks a renamed owner label when fuzzy identity matching is ambiguous", async () => {
    const cam = leagueSeason.teams.find(team => team.ownerDisplayName === "Cam");
    const sam = leagueSeason.teams.find(team => team.ownerDisplayName === "Sam");
    expect(cam).toBeDefined();
    expect(sam).toBeDefined();
    const ambiguousSeason = {
      ...leagueSeason,
      teams: leagueSeason.teams.map(team =>
        team.id === sam?.id ? { ...team, managerDisplayNames: ["Cam Old"] } : team
      ),
    };
    const repository = new InMemoryHistoricalImportRepository([ambiguousSeason]);

    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: ambiguousSeason.leagueId,
      seasonYear: 2025,
      sourceText: [
        "team,player,position,price",
        "Cam's Old Team,Ja'Marr Chase,WR,$61",
      ].join("\n"),
      playerCatalog,
      now,
    });

    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers).toEqual([
      expect.objectContaining({
        code: "owner_ambiguous",
        sourceValue: "Cam's Old Team",
        candidates: expect.arrayContaining([
          expect.objectContaining({ teamId: cam?.id }),
          expect.objectContaining({ teamId: sam?.id }),
        ]),
      }),
    ]);
  });

  it("does not auto-map an owner from generic identity words alone", async () => {
    const seasonWithGenericTeamName = {
      ...leagueSeason,
      teams: leagueSeason.teams.map(team =>
        team.id === camTeam?.id ? { ...team, displayName: "Team" } : team
      ),
    };
    const repository = new InMemoryHistoricalImportRepository([seasonWithGenericTeamName]);

    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: seasonWithGenericTeamName.leagueId,
      seasonYear: 2025,
      sourceText: [
        "team,player,position,price",
        "Mystery Team,Ja'Marr Chase,WR,$61",
      ].join("\n"),
      playerCatalog,
      now,
    });

    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers).toEqual([
      expect.objectContaining({
        code: "owner_unknown",
        sourceValue: "Mystery Team",
      }),
    ]);
  });

  it("requires an explicit mapping when an owner label matches multiple teams", async () => {
    const cam = leagueSeason.teams.find(team => team.ownerDisplayName === "Cam");
    const sam = leagueSeason.teams.find(team => team.ownerDisplayName === "Sam");
    expect(cam).toBeDefined();
    expect(sam).toBeDefined();
    const ambiguousSeason = {
      ...leagueSeason,
      teams: leagueSeason.teams.map(team =>
        team.id === sam?.id ? { ...team, managerDisplayNames: ["Cam"] } : team
      ),
    };
    const repository = new InMemoryHistoricalImportRepository([ambiguousSeason]);
    const source = [
      "owner,player,position,price",
      "Cam,Ja'Marr Chase,WR,$61",
    ].join("\n");
    const blocked = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: ambiguousSeason.leagueId,
      seasonYear: 2025,
      sourceText: source,
      playerCatalog,
      now,
    });

    expect(blocked.batch.blockers).toEqual([
      expect.objectContaining({
        code: "owner_ambiguous",
        candidates: expect.arrayContaining([
          expect.objectContaining({ teamId: cam?.id }),
          expect.objectContaining({ teamId: sam?.id }),
        ]),
      }),
    ]);

    const mapped = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: ambiguousSeason.leagueId,
      seasonYear: 2025,
      sourceText: source,
      playerCatalog,
      ownerMappings: [{ sourceOwnerOrTeamLabel: "Cam", teamId: cam?.id ?? "missing-team" }],
      now,
    });
    expect(mapped.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(mapped.batch.rows[0]?.record).toEqual(expect.objectContaining({ ownerId: "owner-cam" }));
  });

  it("imports a prior draft year using the current season as its validation template", async () => {
    const currentLeagueSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      seasonYear: 2026,
      setupStatus: "draft",
    });
    const repository = new InMemoryHistoricalImportRepository([currentLeagueSeason]);

    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: currentLeagueSeason.leagueId,
      seasonYear: 2025,
      seasonContext: { currentLeagueSeason },
      sourceText: sourceText(),
      now,
    });
    const commit = await commitHistoricalImportWorkflow({
      repository,
      batchId: preview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });

    expect(preview.batch).toMatchObject({
      leagueId: currentLeagueSeason.leagueId,
      leagueSeasonId: currentLeagueSeason.id,
      seasonYear: 2025,
      status: "previewed",
    });
    expect(preview.batch.warnings).toEqual([
      expect.objectContaining({
        code: "season_spend_mismatch",
        message: "Imported spend is $61, expected $2800.",
      }),
    ]);
    expect(commit.committedRecords).toEqual([
      expect.objectContaining({
        leagueSeasonId: currentLeagueSeason.id,
        seasonYear: 2025,
        ownerId: "owner-cam",
      }),
    ]);
    expect(repository.findLeagueSeason(currentLeagueSeason.leagueId, 2025)).toBeNull();
    expect(repository.currentRecords(currentLeagueSeason.leagueId, 2025)).toHaveLength(1);
    expect(repository.currentRecords(currentLeagueSeason.leagueId, 2026)).toEqual([]);
  });

  it("uses a snake current-season template without calculating auction spend", async () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      seasonYear: 2026,
      setupStatus: "draft",
    });
    const currentLeagueSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: auctionSeason.settings.scoring,
        snake: {
          rounds: auctionSeason.settings.roster.rosterSize,
          order: auctionSeason.teams.map(team => team.id),
          reversal: "standard",
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };
    const repository = new InMemoryHistoricalImportRepository([currentLeagueSeason]);

    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: currentLeagueSeason.leagueId,
      seasonYear: 2025,
      seasonContext: { currentLeagueSeason },
      sourceText: sourceText(),
      now,
    });

    expect(preview.batch).toMatchObject({
      leagueSeasonId: currentLeagueSeason.id,
      seasonYear: 2025,
      status: "previewed",
      warnings: [],
    });
  });

  it("previews source text and commits the ready batch records", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const preview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const commit = await commitHistoricalImportWorkflow({
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

  it("surfaces parse warnings without bypassing downstream blockers", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);

    const preview = await previewHistoricalImportSourceWorkflow({
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
    await expect(
      commitHistoricalImportWorkflow({
        repository,
        batchId: preview.batch.id,
        now: new Date("2026-08-09T12:02:00.000Z"),
      }),
    ).rejects.toThrow("Cannot commit historical import batch with blockers.");
  });

  it("treats duplicate source files as idempotent through preview and commit", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstPreview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const duplicatePreview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now: new Date("2026-08-09T12:00:30.000Z"),
    });

    const firstCommit = await commitHistoricalImportWorkflow({
      repository,
      batchId: firstPreview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });
    const duplicateCommit = await commitHistoricalImportWorkflow({
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

  it("treats wide-sheet keeper inference as part of the import identity", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const wideSource = [
      "Team,Cam,,,Sam,,",
      "1,$50,RB,De'Von Achane,$61,WR,Ja'Marr Chase",
    ].join("\n");
    const ordinaryPreview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: wideSource,
      playerCatalog,
      now,
    });
    const keeperPreview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: wideSource,
      inferFirstRosterRowAsKeeper: true,
      playerCatalog,
      now: new Date("2026-08-09T12:00:30.000Z"),
    });

    expect(keeperPreview.source.fileHash).not.toBe(ordinaryPreview.source.fileHash);
    expect(keeperPreview.batch.id).not.toBe(ordinaryPreview.batch.id);
    expect(ordinaryPreview.batch.rows.map(row => row.record?.keeper)).toEqual([false, false]);
    expect(keeperPreview.batch.rows.map(row => row.record?.keeper)).toEqual([true, true]);
  });

  it("commits replacement imports as the current batch and supersedes the prior batch", async () => {
    const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
    const firstPreview = await previewHistoricalImportSourceWorkflow({
      repository,
      leagueId: leagueSeason.leagueId,
      seasonYear: 2025,
      sourceText: sourceText(),
      now,
    });
    const firstCommit = await commitHistoricalImportWorkflow({
      repository,
      batchId: firstPreview.batch.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });
    const replacementPreview = await previewHistoricalImportSourceWorkflow({
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

    const replacementCommit = await commitHistoricalImportWorkflow({
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
