import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, snakeSeason } from "../support/index.js";
import type { LeagueSeason } from "../support/index.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../src/platform/liveDraftRooms.js";

// Money in the room is 4 x $200 = $800 and the published board totals $800,
// so the no-history inflation fallback multiplies every price by exactly 1.
const fillerRb = (index: number): LiveDraftRoomPlayerCatalogEntry => ({
  name: `Filler RB ${index + 1}`,
  position: "RB",
  expectedPrice: 10,
});
const styleCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Stud RB", position: "RB", expectedPrice: 60 },
  ...Array.from({ length: 74 }, (_, index) => fillerRb(index)),
];

const historyCsv = Buffer.from([
  "owner,player,position,price,year",
  "Owner12,Filler RB 1,RB,5,2025",
  "Matt,Filler RB 2,RB,5,2025",
  "Nick,Filler RB 3,RB,5,2025",
].join("\n")).toString("base64");

describe("platform HTTP contract", () => {
  it("bids studs down in season simulations when imported history shows stud-avoiders", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: styleCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "owner-styles@example.com");
    const snake = snakeSeason();
    if (snake.settings.draftFormat !== "snake") throw new Error("Expected snake settings.");
    const { expectedTeamCount, scoring, keeperPolicy } = snake.settings;
    const season: LeagueSeason = {
      ...snake,
      id: "styles-season-2026",
      teams: snake.teams.map(team => ({ ...team, leagueSeasonId: "styles-season-2026" })),
      settings: {
        expectedTeamCount,
        scoring,
        keeperPolicy,
        roster: {
          rosterSize: 2,
          lineup: { RB: 1, BENCH: 1 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
        },
        draftFormat: "auction",
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    const preview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: owner11.sessionToken,
      body: { fileName: "draft-2025.csv", mimeType: "text/csv", base64: historyCsv, seasonYear: 2025 },
    });
    const previewBatch = expectBodyRecord(expectBodyRecord(preview.body).batch);
    await expect(handle({
      method: "POST",
      path: `/historical-imports/${expectString(previewBatch.id)}/commit`,
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, seasonYear: 2025 },
    })).resolves.toMatchObject({ status: 200 });

    const simulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, count: 1 },
    });
    expect(simulationResponse).toMatchObject({ status: 200 });
    const historyId = expectString(expectBodyRecord(simulationResponse.body).historyId);

    const detailResponse = await handle({
      method: "GET",
      path: `/season-simulations/${historyId}/runs/1`,
      sessionToken: owner11.sessionToken,
    });
    expect(detailResponse).toMatchObject({ status: 200 });
    const run = expectBodyRecord(expectBodyRecord(detailResponse.body).run);
    const teams = Array.isArray(run.teams) ? run.teams : [];
    const studPrice = teams
      .flatMap(team => expectBodyRecord(team).roster)
      .map(player => expectBodyRecord(player))
      .find(player => player.playerName === "Stud RB")?.price;

    // Every AI owner's imported history tops out at $5, so nobody chases the
    // $60 stud to full value and it clears far under the market price.
    expect(studPrice).toBeDefined();
    expect(typeof studPrice === "number" && studPrice <= 45).toBe(true);
  });
});
