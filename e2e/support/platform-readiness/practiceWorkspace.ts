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
  seasonId: string,
  expectedPlayerCount?: number,
): Promise<void> => {
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(/\/practice\?seasonId=/);
  expect(new URL(page.url()).searchParams.get("seasonId")).toBe(seasonId);
  await expect(page.getByRole("heading", { name: "Draft lab" })).toBeVisible();
  await expectPracticeBoard(page, expectedPlayerCount);
};

export const exerciseDurableMockWorkspace = async (
  page: Page,
  season: LeagueSeason,
): Promise<void> => {
  const persistedSessionId = await createAuctionMock(page);
  expect(new URL(page.url()).searchParams.get("seasonId")).toBe(season.id);
  await expectAuctionMockSetup(page);
  const otherTeam = season.teams[1];
  if (otherTeam !== undefined) await chooseRoster(page, otherTeam.displayName);
  await startAuctionMock(page);
  const beforeReload = await page.getByRole("main").textContent();
  await page.reload();
  await expect(page.getByRole("region", { name: "Live auction" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBe(persistedSessionId);
  await expect(page.getByRole("main")).toHaveText(beforeReload ?? "");
  await abandonAuctionMock(page);
  const replacementSessionId = await createAuctionMock(page);
  expect(replacementSessionId).not.toBe(persistedSessionId);
  await expectAuctionMockSetup(page);
};
