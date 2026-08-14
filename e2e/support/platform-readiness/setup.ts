import { expect, type Page } from "@playwright/test";
import { ownerOrder } from "../../../config/league.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomReadModel } from "../../../src/platform/liveDraftRoomStream.js";
import { expectAuthenticatedAccount } from "../auth.js";
import { api, expectOk } from "./api.js";
import { setupRowsFor } from "./seasons.js";
import type { LiveDraftRoomBody } from "./types.js";

export const applyCommissionerSetup = async (
  page: Page,
  season: LeagueSeason,
  camEmail: string,
): Promise<string> => {
  await page.goto(`/setup?seasonId=${encodeURIComponent(season.id)}`);
  await expectAuthenticatedAccount(page, camEmail);
  await expect(page.locator("#setup-season-id-input")).toHaveValue(season.id);
  await page.getByText("Advanced: paste a team list", { exact: true }).click();
  await page.locator("#setup-rows-input").fill(setupRowsFor(camEmail));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator("#setup-status")).toHaveText("Ready to apply.");
  await expect(page.locator("#setup-preview-body tr")).toHaveCount(ownerOrder.length);
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator("#setup-status")).toHaveText("League setup updated.");
  await page.getByRole("button", { name: "Create league link" }).click();
  await expect(page.locator("#league-invite-link-row")).toBeVisible();
  const invitationUrl = await page.locator("#league-invite-link-input").inputValue();
  expect(invitationUrl).toContain("/invite?token=");
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.locator("#invitation-create-status")).toHaveText("League link copied.");
  await page.reload();
  await expect(page.locator("#league-invite-link-row")).toBeVisible();
  await expect(page.locator("#league-invite-link-input")).toHaveValue(invitationUrl);
  await expect(page.getByRole("button", { name: "Generate new link" })).toBeVisible();

  const finalReview = page.locator("#setup-final-review");
  const publishButton = page.getByRole("button", { name: "Publish league" });
  const createRoomButton = page.getByRole("button", { name: "Create draft room" });
  await expect(page.locator("#setup-settings-summary")).toContainText("$200 auction");
  await expect(finalReview).not.toBeChecked();
  await expect(publishButton).toBeDisabled();
  await expect(createRoomButton).toBeDisabled();
  await finalReview.check();
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
  await expect(page.locator("#live-room-setup-status")).toHaveText(
    "League setup published. The shared draft room can now be created.",
  );
  await expect(finalReview).toBeChecked();
  await expect(finalReview).toBeDisabled();
  await expect(createRoomButton).toBeEnabled();

  await page.goto(`/league?seasonId=${encodeURIComponent(season.id)}`);
  await expect(page.locator("#live-draft-readiness-action")).toHaveText("Create draft room");
  await expect(page.locator("#open-live-draft-button")).toHaveText("Create draft room");
  await page.locator("#live-draft-readiness-action").click();
  await expect(page).toHaveURL(new RegExp(`/setup\\?seasonId=${season.id}#live-room-setup-title$`, "u"));
  await expect(page.locator("#setup-season-id-input")).toHaveValue(season.id);
  await expect(page.getByRole("button", { name: "Create draft room" })).toBeEnabled();

  return invitationUrl;
};

export const createLiveRoomFromSetup = async (
  page: Page,
  season: LeagueSeason,
): Promise<LiveDraftRoomReadModel> => {
  await Promise.all([
    page.waitForURL(/\/draft-room\?seasonId=.*&roomId=/),
    page.getByRole("button", { name: "Create draft room" }).click(),
  ]);
  const roomId = new URL(page.url()).searchParams.get("roomId");
  if (roomId === null) throw new Error("Expected created room URL to include roomId.");
  const room = expectOk(await api<LiveDraftRoomBody>(page, `/live-rooms/${encodeURIComponent(roomId)}`)).room;
  expect(room).toMatchObject({
    roomId,
    seasonId: season.id,
    status: "setup",
  });
  expect(room.board.length).toBeGreaterThan(0);

  return room;
};
