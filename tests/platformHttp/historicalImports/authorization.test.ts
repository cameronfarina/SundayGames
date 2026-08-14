import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, leagueConfig, mockRunner, ownerOrder } from "../support/index.js";

describe("platform HTTP contract", () => {
it("authorizes commissioner spreadsheet imports before parsing the upload", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner = await createLoggedInAccount(handle, "history-owner@example.com");
    const member = await createLoggedInAccount(handle, "history-member@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [
          { userId: owner.account.id, leagueId: season.leagueId, role: "owner" },
          { userId: member.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });
    const upload = {
      fileName: "draft.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: Buffer.from("not an xlsx archive").toString("base64"),
      seasonYear: 2025,
    };

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: member.sessionToken,
      body: upload,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: owner.sessionToken,
      body: upload,
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_historical_upload" } },
    });
  });

it("returns a clear document limit error without saving a historical preview", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner = await createLoggedInAccount(handle, "history-size-limit@example.com");
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
    const rows = Array.from(
      { length: 2_500 },
      (_, index) => `Owner11,Player ${index + 1},RB,1,2025`,
    );

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: owner.sessionToken,
      body: {
        sourceText: ["owner,player,position,price,year", ...rows].join("\n"),
        seasonYear: 2025,
      },
    })).resolves.toMatchObject({
      status: 422,
      body: {
        error: {
          code: "historical_import_document_too_large",
          message: "Historical draft files may contain at most 2500 rows.",
        },
      },
    });
    expect(store.historicalImports.batches()).toEqual([]);
  });
});
