import { expect, test } from "@playwright/test";
import { pageForLocalFixtureUser } from "../support/platform-readiness/accounts.js";
import { api, expectOk } from "../support/platform-readiness/api.js";
import {
  isDeployedSmoke,
  provisioningToken,
} from "../support/platform-readiness/environment.js";
import {
  buildKeeperHistorySeason,
  wideDraft,
} from "../support/platform-readiness/keeperHistoryFixture.js";
import { teamByOwner } from "../support/platform-readiness/seasons.js";
import { createLiveRoomFromSetup } from "../support/platform-readiness/setup.js";
import type {
  LiveDraftRoomBody,
  PricingSnapshotsBody,
  SeasonBody,
} from "../support/platform-readiness/types.js";

test("commissioner history and keepers persist into an unopened live room", async ({
  browser,
}) => {
  test.skip(
    isDeployedSmoke,
    "Local fixture bootstrap is not allowed against a deployed target.",
  );
  const { page, account } = await pageForLocalFixtureUser(
    browser,
    "keeper.history.e2e@example.com",
  );
  const season = buildKeeperHistorySeason();
  const claimedTeam = teamByOwner(season, "Alex");
  expectOk(
    await api<SeasonBody>(page, "/seasons", {
      method: "POST",
      headers: { "x-mockd-provisioning-token": provisioningToken },
      body: {
        season,
        memberships: [
          {
            userId: account.id,
            leagueId: season.leagueId,
            role: "admin",
            ownerId: claimedTeam.ownerId,
            teamId: claimedTeam.id,
          },
        ],
      },
    }),
  );

  await page.goto(`/commissioner?seasonId=${encodeURIComponent(season.id)}`);
  const setupSection = page.locator("#league-setup");
  await expect(setupSection.locator(".team-keepers__chip")).toHaveCount(2);
  await page.getByRole("button", { name: "History" }).click();
  await page.getByLabel("Choose historical draft files").setInputFiles([
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
  const historyRows = page.locator(".history-file");
  await expect(historyRows).toHaveCount(2);
  const draftYears = page.getByLabel("Draft year");
  await expect(draftYears.nth(0)).toHaveValue("2023");
  await expect(draftYears.nth(1)).toHaveValue("2024");
  await draftYears.nth(1).fill("2023");
  await expect(
    page.getByRole("button", { name: "Import 2 files" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a different draft year for each pending file.",
  );
  await draftYears.nth(1).fill("2024");
  const importButton = page.getByRole("button", { name: "Import 2 files" });
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await expect(historyRows.nth(0)).toContainText("8 players imported");
  await expect(historyRows.nth(1)).toContainText("8 players imported");
  await page.getByRole("button", { name: "Overview" }).click();

  // Keepers are typed on the row of the team that keeps them.
  const keepFor = async (owner: string, entry: string): Promise<void> => {
    const managers = setupSection.getByRole("textbox", { name: /^Manager \d+$/u });
    const names = await managers.evaluateAll(
      inputs => inputs.map(input => input instanceof HTMLInputElement ? input.value : ""),
    );
    await setupSection.getByRole("button", { name: "+ Keeper" }).nth(names.indexOf(owner)).click();
    await setupSection.getByRole("textbox", { name: `Keeper for ${owner}` }).fill(entry);
    await page.keyboard.press("Enter");
  };
  await keepFor("Alex", "Lamb 50");
  await expect(setupSection).toContainText("CeeDee Lamb $50");
  await expect(
    setupSection.getByRole("button", { name: "Remove CeeDee Lamb from Alex" }),
  ).toBeVisible();

  await page.reload();
  await expect(setupSection).toContainText("CeeDee Lamb $50");
  await page.getByRole("button", { name: "Create and publish league" }).click();
  await expect(page.getByRole("button", { name: "Copy league invitation" })).toBeVisible();

  const room = await createLiveRoomFromSetup(page, season);
  const alexRoster = page.getByRole("complementary", { name: "Alex roster" });
  await expect(alexRoster.getByText("Budget left")).toContainText("$150");
  await expect(alexRoster.getByText("Spent")).toContainText("$50");
  await expect(alexRoster.getByText("Open slots")).toContainText("15");
  await expect(alexRoster).toContainText("CeeDee Lamb");

  await page.goto(`/commissioner?seasonId=${encodeURIComponent(season.id)}`);
  await expect(setupSection.locator(".team-keepers__chip")).toHaveCount(3);
  await setupSection.getByRole("button", { name: "Remove CeeDee Lamb from Alex" }).click();
  await keepFor("Alex", "Lamb 47");
  await expect(setupSection).toContainText("CeeDee Lamb $47");
  await page.goto(
    `/draft-room?seasonId=${encodeURIComponent(season.id)}&roomId=${encodeURIComponent(room.roomId)}`,
  );
  await expect(alexRoster.getByText("Budget left")).toContainText("$153");
  await expect(alexRoster.getByText("Spent")).toContainText("$47");
  await expect(alexRoster.getByText("Open slots")).toContainText("15");
  await expect(alexRoster).toContainText("CeeDee Lamb");
  await expect(alexRoster).toContainText("$47");

  const updatedRoom = expectOk(
    await api<LiveDraftRoomBody>(
      page,
      `/live-rooms/${encodeURIComponent(room.roomId)}`,
    ),
  ).room;
  const latestPricing = expectOk(
    await api<PricingSnapshotsBody>(
      page,
      `/seasons/${encodeURIComponent(season.id)}/pricing-snapshots?scenarioId=expected`,
    ),
  ).pricingSnapshots.at(-1);
  const expectedPukaPrice = latestPricing?.rows.find(
    (row) => row.playerName === "Puka Nacua",
  )?.personalValue;
  expect(expectedPukaPrice).toBeDefined();
  expect(
    updatedRoom.board.find((player) => player.name === "Puka Nacua")
      ?.expectedPrice,
  ).toBe(Math.round(expectedPukaPrice ?? Number.NaN));
  const pukaRow = page
    .getByRole("row")
    .filter({ hasText: "Puka Nacua" })
    .first();
  await expect(pukaRow.locator("td").last()).toHaveText(
    `$${Math.round(expectedPukaPrice ?? Number.NaN)}`,
  );
});
