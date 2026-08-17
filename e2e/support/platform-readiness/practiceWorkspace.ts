import { expect, type Page } from "@playwright/test";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import {
  abandonAuctionMock,
  chooseRoster,
  createAuctionMock,
  expectAuctionMockSetup,
  startAuctionMock,
} from "../mockDraft.js";
import { expectPracticeBoard } from "../practice.js";

export const openUnifiedBoard = async (
  page: Page,
  expectedPlayerCount?: number,
): Promise<void> => {
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/leagues\/[^/]+\/practice$/u);
  expect(new URL(page.url()).searchParams.has("seasonId")).toBe(false);
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expectPracticeBoard(page, expectedPlayerCount);
};

export const exerciseDurableMockWorkspace = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  const persistedSessionId = await createAuctionMock(page);
  expect(new URL(page.url()).searchParams.has("seasonId")).toBe(false);
  await expectAuctionMockSetup(page);
  const otherTeam = season.teams[1];
  if (otherTeam !== undefined) await chooseRoster(page, otherTeam.displayName);
  await startAuctionMock(page);
  const liveAuction = page.getByRole("region", { name: "Live auction" });
  // Simulated owners keep bidding, so the panel's text changes on its own.
  // Its activity history only grows, which survives a reload without racing.
  const auctionActivity = liveAuction
    .getByRole("list", { name: "Auction activity" })
    .getByRole("listitem");
  await expect.poll(async () => await auctionActivity.count()).toBeGreaterThan(0);
  const activityBeforeReload = await auctionActivity.count();
  await page.reload();
  await expect(liveAuction).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBe(persistedSessionId);
  await expect.poll(async () => await auctionActivity.count())
    .toBeGreaterThanOrEqual(activityBeforeReload);
  await abandonAuctionMock(page);
  const replacementSessionId = await createAuctionMock(page);
  expect(replacementSessionId).not.toBe(persistedSessionId);
  await expectAuctionMockSetup(page);
};
