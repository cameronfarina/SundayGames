import { expect, type Page } from "@playwright/test";
import { ownerOrder } from "../../../config/league.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomReadModel } from "../../../src/platform/liveDraftRoomStream.js";
import { expectAuthenticatedAccount } from "../auth.js";
import { api, expectOk } from "./api.js";
import { setupRowsFor } from "./seasons.js";
import type { LiveDraftRoomBody, OnboardingBody } from "./types.js";

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
  const teamRows = setupSection.getByRole("textbox", { name: "Teams and managers" });
  await teamRows.fill(setupRowsFor(camEmail));
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(setupSection.getByRole("status")).toHaveText(
    `Ready to apply ${String(ownerOrder.length)} teams.`,
  );
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(setupSection.getByRole("status")).toHaveText("League teams saved.");
  const invitationSection = page.locator("#league-invite");
  await page.getByRole("button", { name: "Create league link" }).click();
  const invitationLink = page.getByLabel("Shareable league link");
  await expect(invitationLink).toBeVisible();
  const invitationUrl = await invitationLink.inputValue();
  expect(invitationUrl).toContain("/invite?token=");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(invitationSection.getByRole("status")).toHaveText("League link copied.");
  await page.reload();
  await expect(page.getByLabel("Shareable league link")).toHaveValue(invitationUrl);
  await expect(page.getByRole("button", { name: "Generate new link" })).toBeVisible();

  await expect(page.getByText("$200 auction", { exact: true })).toBeVisible();
  const publishButton = page.getByRole("button", { name: "Publish reviewed league" });
  const createRoomButton = page.getByRole("button", { name: "Create room" });
  await expect(publishButton).toBeEnabled();
  await expect(createRoomButton).toBeDisabled();
  await publishButton.click();
  await expect(createRoomButton).toBeEnabled();

  await page.goto(`/league?seasonId=${encodeURIComponent(season.id)}`);
  await page.getByRole("link", { name: "Create draft room" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${leaguePath}/commissioner#live-room$`, "u"),
  );
  await expect(page.getByRole("button", { name: "Create room" })).toBeEnabled();

  return invitationUrl;
};

export const createLiveRoomFromSetup = async (
  page: Page,
  season: LeagueSeason,
): Promise<LiveDraftRoomReadModel> => {
  await page.getByRole("button", { name: "Create room" }).click();
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
    status: "setup",
  });
  expect(room.board.length).toBeGreaterThan(0);

  return room;
};
