import { expect, test } from "@playwright/test";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { api, expectOk } from "../support/platform-readiness/api.js";
import { isDeployedSmoke, provisioningToken } from "../support/platform-readiness/environment.js";
import { buildKeeperHistorySeason, wideDraft } from "../support/platform-readiness/keeperHistoryFixture.js";
import { teamByOwner } from "../support/platform-readiness/seasons.js";
import { createLiveRoomFromSetup } from "../support/platform-readiness/setup.js";
import type { LiveDraftRoomBody, PricingSnapshotsBody, SeasonBody } from "../support/platform-readiness/types.js";

test("commissioner history and keepers persist into an unopened live room", async ({ browser }) => {
  test.skip(isDeployedSmoke, "Local fixture bootstrap is not allowed against a deployed target.");
  const { page, account } = await pageForLocalFixtureUser(browser, "keeper.history.e2e@example.com");
  const season = buildKeeperHistorySeason();
  const claimedTeam = teamByOwner(season, "Alex");
  expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "admin",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
    },
  }));

  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#keeper-save-state")).toHaveText("2 keepers saved");
  await page.locator("#historical-import-file").setInputFiles([
    {
      name: "league-auction-2023.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(wideDraft(42, 58)),
    },
    {
      name: "league-auction-2024.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(wideDraft(45, 61)),
    },
  ]);
  const historyRows = page.locator("#historical-import-file-list .historical-file-row");
  await expect(historyRows).toHaveCount(2);
  await expect(historyRows.nth(0).locator("input[data-historical-year]")).toHaveValue("2023");
  await expect(historyRows.nth(1).locator("input[data-historical-year]")).toHaveValue("2024");
  await historyRows.nth(1).locator("input[data-historical-year]").fill("2023");
  await expect(page.locator("#historical-import-button")).toBeDisabled();
  await expect(page.locator("#historical-import-status")).toHaveText(
    "Each selected file needs a different draft year. 2023 is selected more than once.",
  );
  await historyRows.nth(1).locator("input[data-historical-year]").fill("2024");
  await expect(page.locator("#historical-import-button")).toBeEnabled();
  await page.locator("#historical-import-button").click();
  await expect(page.locator("#historical-import-status")).toHaveText(
    "Imported 2 draft files. Draft history is saved. Market now blends baseline projections with up to three years of open-auction sales; keeper rows are excluded. Files with same-season public/AAV values also improve player-level estimates.",
  );
  await expect(historyRows.nth(0)).toContainText("8 draft rows imported for 2023");
  await expect(historyRows.nth(1)).toContainText("8 draft rows imported for 2024");

  const keeperCommand = page.locator("#keeper-command-input");
  await keeperCommand.fill("Alex Lamb 50");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Use '<team or manager> keeping <player> <number>'.",
  );
  await expect(keeperCommand).toHaveValue("Alex Lamb 50");
  await expect(page.locator("#keeper-save-state")).toHaveText("2 keepers saved");
  await keeperCommand.fill("Alex keeping Lamb 50");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Alex keeps CeeDee Lamb for $50. League values are updated.",
  );
  await expect(keeperCommand).toHaveValue("");
  await expect(page.locator("#keeper-list")).toContainText("Alex · CeeDee Lamb");
  await expect(page.locator("#keeper-list")).toContainText("$50");

  await page.reload();
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(page.locator("#keeper-list")).toContainText("Alex · CeeDee Lamb");
  await page.locator("#setup-final-review").check();
  await page.getByRole("button", { name: "Publish league" }).click();
  await expect(page.locator("#live-room-setup-status")).toHaveText(
    "League setup published. The shared draft room can now be created.",
  );

  const room = await createLiveRoomFromSetup(page, season);
  await expect(page.locator("#draft-team-budget")).toHaveText("$150");
  await expect(page.locator("#draft-team-spent")).toHaveText("$50");
  await expect(page.locator("#draft-team-open-slots")).toHaveText("15");
  await expect(page.locator("#draft-team-roster")).toContainText("CeeDee Lamb");

  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#keeper-save-state")).toHaveText("3 keepers saved");
  await expect(keeperCommand).toBeEnabled();
  await keeperCommand.fill("Alex keeping Lamb 47");
  await keeperCommand.press("Enter");
  await expect(page.locator("#keeper-status")).toHaveText(
    "Alex keeps CeeDee Lamb for $47. League values and the draft room are updated.",
  );
  await page.goto(
    `/draft-room?seasonId=${encodeURIComponent(season.id)}&roomId=${encodeURIComponent(room.roomId)}`,
  );
  await expect(page.locator("#draft-team-budget")).toHaveText("$153");
  await expect(page.locator("#draft-team-spent")).toHaveText("$47");
  await expect(page.locator("#draft-team-open-slots")).toHaveText("15");
  await expect(page.locator("#draft-team-roster")).toContainText("CeeDee Lamb");
  await expect(page.locator("#draft-team-roster")).toContainText("$47");

  const updatedRoom = expectOk(await api<LiveDraftRoomBody>(
    page,
    `/live-rooms/${encodeURIComponent(room.roomId)}`,
  )).room;
  const latestPricing = expectOk(await api<PricingSnapshotsBody>(
    page,
    `/seasons/${encodeURIComponent(season.id)}/pricing-snapshots?scenarioId=expected`,
  )).pricingSnapshots.at(-1);
  const expectedPukaPrice = latestPricing?.rows.find(row => row.playerName === "Puka Nacua")?.personalValue;
  expect(expectedPukaPrice).toBeDefined();
  expect(updatedRoom.board.find(player => player.name === "Puka Nacua")?.expectedPrice)
    .toBe(Math.round(expectedPukaPrice ?? Number.NaN));
  const pukaRow = page.locator('#draft-board-rows tr[data-player-name="Puka Nacua"]');
  await expect(pukaRow.locator("td").last()).toHaveText(`$${Math.round(expectedPukaPrice ?? Number.NaN)}`);
});
