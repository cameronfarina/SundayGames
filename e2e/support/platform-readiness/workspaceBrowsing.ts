import { expect } from "@playwright/test";
import { accountMenuButton } from "../auth.js";
import { exerciseBoardSimulations } from "./boardSimulations.js";
import { exerciseDurableMockWorkspace, openUnifiedBoard } from "./practiceWorkspace.js";
import type { ReadySmokeWorkspace } from "./types.js";

export const exerciseWorkspaceBrowsing = async (workspace: ReadySmokeWorkspace): Promise<void> => {
  const {
    commissionerPage: camPage,
    memberPage: sethPage,
    season: appliedSeason,
    room: createdRoom,
    memberTeamName,
  } = workspace;

  await Promise.all([
    camPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await expect(camPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await expect(sethPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await expect(sethPage.getByRole("heading", { name: memberTeamName })).toBeVisible();

  const fullPlayerCount = createdRoom.board.length + createdRoom.teamSummaries.reduce(
    (count, team) => count + team.roster.length,
    0,
  );
  await openUnifiedBoard(camPage, appliedSeason.id, fullPlayerCount);
  await expect(camPage.getByRole("link", { name: "Enter draft" })).toHaveCount(0);
  await camPage.getByRole("link", { name: "League", exact: true }).click();
  await expect(camPage).toHaveURL(/\/league\?seasonId=/);
  await expect(camPage.getByRole("heading", { name: appliedSeason.league.name })).toBeVisible();
  await accountMenuButton(camPage).click();
  await expect(camPage.getByRole("menu")).toBeVisible();
  await camPage.keyboard.press("Escape");
  await expect(camPage.getByRole("menu")).toBeHidden();

  await openUnifiedBoard(sethPage, appliedSeason.id, fullPlayerCount);
  await exerciseBoardSimulations(sethPage, appliedSeason);
  await exerciseDurableMockWorkspace(sethPage, appliedSeason);

  await Promise.all([
    camPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
    sethPage.goto(`/league?seasonId=${encodeURIComponent(appliedSeason.id)}`),
  ]);
  await Promise.all([
    camPage.getByRole("link", { name: "Enter draft" }).click(),
    sethPage.getByRole("link", { name: "Enter draft" }).click(),
  ]);
};
