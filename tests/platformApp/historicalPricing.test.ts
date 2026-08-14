import { describe, it, InMemoryPlatformStore, PlatformAppError, baselinePrices, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("runs shared historical imports and league pricing rebuilds behind commissioner permissions", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const importSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2025,
    });
    const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const importCamTeam = importSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    const draftCamTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    const draftSethTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Owner04");
    if (importCamTeam === undefined || draftCamTeam === undefined || draftSethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: importSeason,
      memberships: [
        { userId: owner11.account.id, leagueId: importSeason.leagueId, role: "owner", ownerId: importCamTeam.ownerId, teamId: importCamTeam.id },
      ],
      now,
    });
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: draftSeason,
      memberships: [
        { userId: owner11.account.id, leagueId: draftSeason.leagueId, role: "owner", ownerId: draftCamTeam.ownerId, teamId: draftCamTeam.id },
        { userId: owner04.account.id, leagueId: draftSeason.leagueId, role: "member", ownerId: draftSethTeam.ownerId, teamId: draftSethTeam.id },
      ],
      now,
    });

    await expect(
      app.previewHistoricalImportSource({
        actorSessionToken: owner04.sessionToken,
        leagueId: importSeason.leagueId,
        seasonYear: importSeason.seasonYear,
        sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,70,2025,player-puka",
        now,
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const preview = await app.previewHistoricalImportSource({
      actorSessionToken: owner11.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,70,2025,player-puka",
      now,
    });
    const committed = await app.commitHistoricalImport({
      actorSessionToken: owner11.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const replacementPreview = await app.previewHistoricalImportSource({
      actorSessionToken: owner11.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,90,2025,player-puka",
      replacementRequested: true,
      now: new Date(now.getTime() + 1_500),
    });
    await app.commitHistoricalImport({
      actorSessionToken: owner11.sessionToken,
      batchId: replacementPreview.batch.id,
      now: new Date(now.getTime() + 1_750),
    });
    const pricing = await app.rebuildLeaguePricing({
      actorSessionToken: owner11.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      now: new Date(now.getTime() + 2_000),
    });

    expect(committed.committedRecords).toEqual([
      expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 }),
    ]);
    expect(pricing.snapshots[0]?.rows.find(row => row.playerName === "Puka Nacua")).toMatchObject({
      marketPrice: 70,
      scenarioPrice: 70,
    });
    expect(await app.listLeaguePricingSnapshots({
      actorSessionToken: owner04.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
    })).toEqual(pricing.snapshots);
  });
});
