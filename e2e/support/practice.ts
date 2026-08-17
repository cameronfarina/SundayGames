import { expect, type Locator, type Page } from "@playwright/test";

export const practiceBoard = (page: Page): Locator =>
  page.getByRole("region", { name: "Available players" });

export const practicePlayerRows = (page: Page): Locator =>
  practiceBoard(page).getByRole("table").getByRole("row").filter({
    has: page.getByRole("button", { name: /simulation plan/u }),
  });

export const choosePracticeOption = async (
  page: Page,
  label: string,
  option: string,
): Promise<void> => {
  const select = page.getByRole("main").getByRole("combobox", { name: label });
  await select.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(select).toHaveText(option);
};

export const expectPracticeBoard = async (
  page: Page,
  loadedPlayerCount?: number,
): Promise<void> => {
  const board = practiceBoard(page);
  await expect(board).toBeVisible();
  await expect(board.getByRole("heading", { name: "Available players" })).toBeVisible();
  await expect(practicePlayerRows(page).first()).toBeVisible();
  await expect(board.getByRole("columnheader")).toHaveText([
    "Target", "Rank", "Player", "Pos", "NFL", "Bye", "Market", "Simulation", "My value",
  ]);
  if (loadedPlayerCount !== undefined) {
    await expect(board).toContainText(`${String(loadedPlayerCount)} loaded`);
  }
};

export const exercisePracticeBoardControls = async (page: Page): Promise<void> => {
  const board = practiceBoard(page);
  const rows = practicePlayerRows(page);
  const firstName = (await rows.first().getByRole("cell").nth(2).textContent())?.trim();
  if (firstName === undefined || firstName.length === 0) {
    throw new Error("Expected the Practice board to expose a player name.");
  }

  await board.getByRole("button", { name: "RB", exact: true }).click();
  await expect(board.getByRole("button", { name: "RB", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const filteredRowCount = await practicePlayerRows(page).count();
  expect(filteredRowCount).toBeGreaterThan(0);
  for (let index = 0; index < filteredRowCount; index += 1) {
    await expect(practicePlayerRows(page).nth(index).getByRole("cell").nth(3)).toHaveText("RB");
  }
  await board.getByRole("button", { name: "All", exact: true }).click();

  const search = board.getByRole("searchbox", { name: "Search players" });
  await search.fill(firstName);
  await expect(practicePlayerRows(page)).toHaveCount(1);
  await expect(practicePlayerRows(page).first()).toContainText(firstName);
  await search.fill("");

  await choosePracticeOption(page, "Sort players", "Rank");
  await expect(practicePlayerRows(page).first()).toBeVisible();

  const addTarget = practicePlayerRows(page).first().getByRole("button", {
    name: /Add .+ to simulation plan/u,
  });
  await addTarget.click();
  await expect(practicePlayerRows(page).first().getByRole("button", {
    name: /Remove .+ from simulation plan/u,
  })).toBeVisible();
  await board.getByRole("checkbox", { name: /Draft targets only \(1\)/u }).check();
  await expect(practicePlayerRows(page)).toHaveCount(1);
};
