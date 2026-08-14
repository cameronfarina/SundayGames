import { expect, type Locator, type Page } from "@playwright/test";

export const availablePlayersTable = (page: Page): Locator =>
  page.getByRole("table", { name: "Available players" });

export const createAuctionMock = async (page: Page): Promise<string> => {
  await page.getByRole("link", { name: "Start auction mock" }).click();
  await expect(page.getByRole("heading", { name: "Auction mock draft" })).toBeVisible();
  await page.getByRole("button", { name: "Create auction mock" }).click();
  await expect(page.getByRole("button", { name: "Start draft" })).toBeEnabled();
  const sessionId = new URL(page.url()).searchParams.get("sessionId");
  if (sessionId === null) throw new Error("Expected the auction mock URL to include sessionId.");
  return sessionId;
};

export const expectAuctionMockSetup = async (page: Page): Promise<void> => {
  await expect(page.getByRole("heading", { name: "Auction mock draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start draft" })).toBeEnabled();
  await expect(availablePlayersTable(page)).toBeVisible();
  await expect(availablePlayersTable(page).getByRole("columnheader")).toHaveText([
    "Market value", "Our value", "Player", "Pos", "NFL", "Bye", "Status", "Action",
  ]);
  await expect(page.getByRole("combobox", { name: "Inspect team roster" })).toBeVisible();
};

export const startAuctionMock = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("region", { name: "Live auction" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abandon mock" })).toBeVisible();
};

export const abandonAuctionMock = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Abandon mock" }).click();
  const dialog = page.getByRole("dialog", { name: "Abandon this mock?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Abandon mock" }).click();
  await expect(page.getByText("Mock abandoned", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create auction mock" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("sessionId")).toBeNull();
};

export const chooseRoster = async (page: Page, teamName: string): Promise<void> => {
  const select = page.getByRole("combobox", { name: "Inspect team roster" });
  await select.click();
  await page.getByRole("option", { name: `${teamName} roster`, exact: true }).click();
  await expect(page.getByRole("region", { name: `${teamName} roster` })).toBeVisible();
};
