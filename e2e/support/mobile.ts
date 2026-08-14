import { expect, type Locator, type Page } from "@playwright/test";
import { z } from "zod";
import { leagueConfig, ownerOrder } from "../../config/league.js";
import type { AccountRecord } from "../../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../src/platform/liveDraftRooms.js";
import {
  expectAuthenticatedAccount,
  expectSignedOut,
  signOutThroughAccountMenu,
} from "./auth.js";

export const mobileViewport = { width: 390, height: 844 };
export const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
export const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";
export const emailDomain = process.env.MOCKD_E2E_EMAIL_DOMAIN?.trim() || "example.com";
export const provisioningToken = process.env.MOCKD_E2E_PROVISIONING_TOKEN?.trim()
  || "local-e2e-provisioning-token";
export const smokeRunId = process.env.MOCKD_E2E_RUN_ID?.trim()
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
export const namespace = smokeRunId === undefined || smokeRunId.length === 0
  ? "local"
  : smokeRunId;
export const leagueName = `Mobile Release League ${namespace}`;
export const roomId = `room_mobile_release_${namespace.replace(/-/g, "_")}`;

export const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 8 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50, teamAbbreviation: "MIA", byeWeek: 12 },
  { name: "George Kittle", position: "TE", expectedPrice: 28, teamAbbreviation: "SF", byeWeek: 9 },
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9, teamAbbreviation: "JAC", byeWeek: 8 },
];

interface JsonResponse<TBody> {
  status: number;
  body: TBody;
}

export const api = async <TBody>(
  page: Page,
  path: string,
  bodySchema: z.ZodType<TBody>,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<JsonResponse<TBody>> => {
  const rawResponse = await page.evaluate(async ({ requestPath, method, body, headers }) => {
    const request: RequestInit = {
      method,
      credentials: "same-origin",
      ...(headers === undefined ? {} : { headers }),
    };
    if (body !== undefined) {
      request.headers = { ...headers, "content-type": "application/json" };
      request.body = JSON.stringify(body);
    }
    const response = await fetch(requestPath, request);
    const text = await response.text();
    return {
      status: response.status,
      body: text.length === 0 ? null : JSON.parse(text),
    };
  }, {
    requestPath: path,
    method: options.method ?? "GET",
    body: options.body,
    headers: options.headers,
  });
  const response = z.object({ status: z.number(), body: z.unknown() }).parse(rawResponse);
  return { status: response.status, body: bodySchema.parse(response.body) };
};

export const expectOk = <TBody>(response: JsonResponse<TBody>): TBody => {
  expect(response.status, JSON.stringify(response.body)).toBeGreaterThanOrEqual(200);
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
  return response.body;
};

export const signUpAndLogIn = async (page: Page, email: string): Promise<AccountRecord> => {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectAuthenticatedAccount(page, email).catch(async error => {
    const authError = (await page.getByRole("alert").textContent())?.trim() ?? "";
    if (!authError.includes("already exists")) throw error;
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expectAuthenticatedAccount(page, email);
  });
  await signOutThroughAccountMenu(page);
  await expectSignedOut(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return await expectAuthenticatedAccount(page, email);
};

export const signInExisting = async (
  page: Page,
  email: string,
  accountPassword: string,
): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectAuthenticatedAccount(page, email, [
    `Could not sign in to the pre-provisioned mobile smoke account ${email}.`,
    "Verify the deployed smoke credential secrets and provisioning receipt.",
  ].join(" "));
};

export const requiredDeployedValue = (key: string): string => {
  const value = process.env[key]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Deployed mobile smoke requires ${key}. Provision the smoke records before running Playwright.`);
  }
  return value;
};

export const seasonForMobileRelease = (): LeagueSeason => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "published",
  });
  const leagueId = `${season.leagueId}-mobile-${namespace}`;
  const seasonId = `${leagueId}-season-${season.seasonYear}`;
  return {
    ...season,
    id: seasonId,
    leagueId,
    league: {
      ...season.league,
      id: leagueId,
      externalLeagueId: `${season.league.externalLeagueId}-mobile-${namespace}`,
      name: leagueName,
    },
    teams: season.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-mobile-${namespace}`,
    })),
  };
};

export const expectNoHorizontalPageOverflow = async (page: Page): Promise<void> => {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.visualViewport?.width ?? window.innerWidth,
    documentWidth: document.documentElement.getBoundingClientRect().width,
    bodyWidth: document.body.scrollWidth,
    rootWidth: document.getElementById("root")?.scrollWidth ?? 0,
  }));
  expect(dimensions.viewportWidth).toBe(mobileViewport.width);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.rootWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
};

export const expectNoControlOverlap = async (controls: readonly Locator[]): Promise<void> => {
  const boxes = await Promise.all(controls.map(async control => {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    if (box === null) throw new Error("Expected visible control bounds.");
    return box;
  }));
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(mobileViewport.width);
  }
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      if (left === undefined || right === undefined) throw new Error("Expected control bounds.");
      const overlaps = left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
      expect(overlaps).toBe(false);
    }
  }
};
