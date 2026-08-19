import {
  InMemoryPlatformStore,
  buildCurrentMockdLeagueSeason,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  it,
  leagueConfig,
  mockRunner,
  ownerOrder,
} from "../support/index.js";

const leagueWithOwner = async () => {
  const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
  const handle = createPlatformHttpHandler(app);
  const owner = await createLoggedInAccount(handle, "inflation-owner@example.com");
  const member = await createLoggedInAccount(handle, "inflation-member@example.com");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
  await handle({
    method: "PUT",
    path: `/seasons/${season.id}`,
    sessionToken: owner.sessionToken,
    body: {
      season,
      memberships: [
        { userId: owner.account.id, leagueId: season.leagueId, role: "owner" },
        { userId: member.account.id, leagueId: season.leagueId, role: "member" },
      ],
    },
  });
  return { handle, member, owner, season };
};

const setInflation = async (
  context: Awaited<ReturnType<typeof leagueWithOwner>>,
  body: Record<string, unknown>,
  sessionToken?: string,
) => await context.handle({
  method: "PUT",
  path: `/seasons/${context.season.id}/inflation`,
  sessionToken: sessionToken ?? context.owner.sessionToken,
  body,
});

const savedMultiplier = async (
  context: Awaited<ReturnType<typeof leagueWithOwner>>,
): Promise<unknown> => {
  const response = await context.handle({
    method: "GET",
    path: `/seasons/${context.season.id}`,
    sessionToken: context.owner.sessionToken,
  });
  const body: unknown = response.body;
  if (body === null || typeof body !== "object") return undefined;
  const season: unknown = Object.getOwnPropertyDescriptor(body, "season")?.value;
  if (season === null || typeof season !== "object") return undefined;
  const settings: unknown = Object.getOwnPropertyDescriptor(season, "settings")?.value;
  if (settings === null || typeof settings !== "object") return undefined;
  return Object.getOwnPropertyDescriptor(settings, "manualInflationMultiplier")?.value;
};

describe("league inflation percentage", () => {
  it("saves a percentage the commissioner typed as a multiplier", async () => {
    const context = await leagueWithOwner();

    await expect(setInflation(context, { inflationPercent: 120 }))
      .resolves.toMatchObject({ status: 200 });
    await expect(savedMultiplier(context)).resolves.toBe(1.2);
  });

  it("clears the percentage when none is sent", async () => {
    const context = await leagueWithOwner();
    await setInflation(context, { inflationPercent: 120 });

    await expect(setInflation(context, {})).resolves.toMatchObject({ status: 200 });
    await expect(savedMultiplier(context)).resolves.toBeUndefined();
  });

  it("refuses a percentage no league could be paying", async () => {
    const context = await leagueWithOwner();

    for (const inflationPercent of [0, -5, 1001]) {
      await expect(setInflation(context, { inflationPercent })).resolves.toMatchObject({
        status: 400,
        body: { error: { code: "inflation_out_of_range" } },
      });
    }
    await expect(savedMultiplier(context)).resolves.toBeUndefined();
  });

  it("lets only a league manager set it", async () => {
    const context = await leagueWithOwner();

    await expect(setInflation(context, { inflationPercent: 120 }, context.member.sessionToken))
      .resolves.toMatchObject({ status: 403 });
  });

  it("refuses anything but a write", async () => {
    const context = await leagueWithOwner();

    await expect(context.handle({
      method: "GET",
      path: `/seasons/${context.season.id}/inflation`,
      sessionToken: context.owner.sessionToken,
    })).resolves.toMatchObject({ status: 405 });
  });
});
