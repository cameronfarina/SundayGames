import { expect, type Page } from "@playwright/test";
import { ownerOrder } from "../../../config/league.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomReadModel } from "../../../src/platform/liveDraftRoomStream.js";
import { expectAuthenticatedAccount } from "../auth.js";
import { api, expectOk } from "./api.js";
import type { LiveDraftRoomBody, OnboardingBody } from "./types.js";

const fillDraftTimeWhenMissing = async (page: Page): Promise<void> => {
  const draftTime = page.getByLabel("Draft date and time");
  if (await draftTime.inputValue() === "") {
    await draftTime.fill("2030-09-01T20:30");
  }
};

export const applyCommissionerSetup = async (
  page: Page,
  season: LeagueSeason,
  camEmail: string,
): Promise<string> => {
  await page.goto(`/commissioner?seasonId=${encodeURIComponent(season.id)}`);
  await expectAuthenticatedAccount(page, camEmail);
  await expect(page).toHaveURL(/\/leagues\/[^/]+\/commissioner$/u);
  const leaguePath = new URL(page.url()).pathname.replace(/\/commissioner$/u, "");
  const setupSection = page.locator("#league-setup");
  const lastTeamName = setupSection.getByRole("textbox", {
    name: `Team name ${String(ownerOrder.length)}`,
  });
  await lastTeamName.fill(`${ownerOrder.at(-1) ?? "Final team"} E2E`);
  await setupSection.getByRole("button", { name: "Apply changes" }).click();
  await expect(setupSection.getByRole("status")).toHaveText("League teams saved.");

  await page.getByRole("button", { name: "Create and publish league" }).click();
  const copyInvitation = page.getByRole("button", { name: "Copy league invitation" });
  await expect(copyInvitation).toBeVisible();
  await copyInvitation.click();
  await expect(page.getByText("League link copied.", { exact: true })).toBeVisible();
  const invitationUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(invitationUrl).toContain("/invite?token=");
  await page.reload();
  await expect(page.getByRole("button", { name: "Copy league invitation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create league invitation" })).toBeHidden();

  await expect(page.getByText("$200 auction", { exact: true })).toBeVisible();

  await page.goto(`/league?seasonId=${encodeURIComponent(season.id)}`);
  await page.getByRole("link", { name: "Create draft room" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${leaguePath}/commissioner\\?section=live-draft$`, "u"),
  );
  await expect(page.getByRole("button", { name: "Plan live draft" })).toBeEnabled();

  return invitationUrl;
};

export const createLiveRoomThroughWizard = async (page: Page): Promise<void> => {
  if (!await page.getByRole("heading", { name: "Live draft room" }).isVisible()) {
    await page.getByRole("button", { name: "Live Draft" }).click();
  }
  await page.getByRole("button", { name: "Plan live draft" }).click();
  await page.getByRole("button", { name: "Continue to schedule" }).click();
  await fillDraftTimeWhenMissing(page);
  await page.getByRole("button", { name: "Review draft room" }).click();
  await page.getByRole("button", { name: "Create live draft room" }).click();
};

export const createLiveRoomFromSetup = async (
  page: Page,
  season: LeagueSeason,
): Promise<LiveDraftRoomReadModel> => {
  await createLiveRoomThroughWizard(page);
  const enterRoom = page.getByRole("link", { name: "Enter draft room" });
  await expect(enterRoom).toBeVisible();
  const onboarding = expectOk(await api<OnboardingBody>(page, "/onboarding"));
  const roomId = onboarding.leagues.find(league => league.seasonId === season.id)?.liveDraft?.roomId;
  if (roomId === undefined) throw new Error("Expected onboarding to include the created room.");
  await Promise.all([page.waitForURL(/\/leagues\/[^/]+\/draft$/u), enterRoom.click()]);
  expect(new URL(page.url()).searchParams.has("roomId")).toBe(false);
  const room = expectOk(await api<LiveDraftRoomBody>(page, `/live-rooms/${encodeURIComponent(roomId)}`)).room;
  expect(room).toMatchObject({
    roomId,
    seasonId: season.id,
    status: "countdown",
  });
  expect(room.board.length).toBeGreaterThan(0);

  return room;
};
