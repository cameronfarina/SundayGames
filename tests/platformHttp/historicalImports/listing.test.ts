import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, leagueConfig, mockRunner, ownerOrder, playerCatalog } from "../support/index.js";

const uploadFor = (seasonYear: number) => ({
  fileName: `draft-${String(seasonYear)}.csv`,
  mimeType: "text/csv",
  base64: Buffer.from(
    `owner,player,position,price,year\nOwner11,Puka Nacua,WR,70,${String(seasonYear)}`,
  ).toString("base64"),
  seasonYear,
});

const rankedPriceUploadFor = (seasonYear: number) => ({
  fileName: `ranked-prices-${String(seasonYear)}.csv`,
  mimeType: "text/csv",
  base64: Buffer.from(
    `rank,player,position,price,public value,year\n1,Puka Nacua,WR,70,65,${String(seasonYear)}`,
  ).toString("base64"),
  seasonYear,
});

describe("platform HTTP contract", () => {
  it("keeps a commissioner's committed draft years readable after the upload session ends", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => playerCatalog,
    });
    const owner = await createLoggedInAccount(handle, "history-listing-owner@example.com");
    const outsider = await createLoggedInAccount(handle, "history-listing-outsider@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [{ userId: owner.account.id, leagueId: season.leagueId, role: "owner" }],
      },
    });

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}/historical-imports`,
      sessionToken: owner.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { seasonYears: [] } });

    for (const seasonYear of [2024, 2025]) {
      const preview = await handle({
        method: "POST",
        path: `/seasons/${season.id}/historical-imports/upload-preview`,
        sessionToken: owner.sessionToken,
        body: seasonYear === 2024 ? rankedPriceUploadFor(seasonYear) : uploadFor(seasonYear),
      });
      const previewBatch = expectBodyRecord(expectBodyRecord(preview.body).batch);
      expect(previewBatch.status).toBe("previewed");
      await handle({
        method: "POST",
        path: `/historical-imports/${expectString(previewBatch.id)}/commit`,
        sessionToken: owner.sessionToken,
        body: { seasonId: season.id, seasonYear },
      });
    }

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}/historical-imports`,
      sessionToken: owner.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { seasonYears: [2025, 2024] } });
    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}/historical-imports`,
      sessionToken: outsider.sessionToken,
    })).resolves.toMatchObject({ status: 403 });
    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/historical-imports`,
      sessionToken: owner.sessionToken,
    })).resolves.toMatchObject({ status: 405 });
  });
});
