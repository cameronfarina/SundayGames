import { InMemoryPlatformInvitationRepository, InMemoryPlatformStore, createPlatformApp, createPlatformHttpHandler, describe, expect, expectPublicBrowserPayload, hashPlatformInvitationToken, it, mockRunner, now } from "../support/index.js";

describe("platform HTTP contract", () => {
it("creates accounts, logs in, and returns stable auth error responses", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const created = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "  Owner11@Example.com ",
        password: "secure password",
        now,
      },
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "owner11@example.com",
      },
    });

    const duplicate = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "owner11@example.com",
        password: "different password",
        now,
      },
    });

    expect(duplicate).toEqual({
      status: 409,
      body: {
        error: {
          code: "duplicate_email",
          message: "An account with this email already exists.",
        },
      },
    });

    const rejectedLogin = await handle({
      method: "POST",
      path: "/sessions",
      body: {
        email: "owner11@example.com",
        password: "wrong password",
        now,
      },
    });

    expect(rejectedLogin).toEqual({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
          message: "Email or password is incorrect.",
        },
      },
    });

    const login = await handle({
      method: "POST",
      path: "/sessions",
      headers: { host: "mockd.example.com" },
      body: {
        email: "owner11@example.com",
        password: "secure password",
        now,
      },
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "owner11@example.com",
      },
      session: {
        id: expect.stringMatching(/^sess_/),
        accountId: expect.any(String),
      },
    });
    expectPublicBrowserPayload(login.body);
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
    expect(JSON.stringify(login.body)).not.toContain("scrypt");
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("mockd_session="));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("HttpOnly"));
    expect(login.headers?.["Set-Cookie"]).toEqual(expect.stringContaining("Secure"));
  });

it("limits production account creation to matching pending invitations", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    await invitationRepository.savePending({
      id: "invite_seth",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "team",
      email: "owner04@example.com",
      role: "member",
      ownerId: "owner04",
      teamId: "team_seth",
      ownerDisplayName: "Owner04",
      teamDisplayName: "Owner04",
      invitedByUserId: "acct_owner11",
      tokenHash: hashPlatformInvitationToken("valid-invitation-token"),
      status: "pending",
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    });
    await invitationRepository.savePending({
      id: "invite_league",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "league",
      role: "member",
      invitedByUserId: "acct_owner11",
      tokenHash: hashPlatformInvitationToken("shared-league-token"),
      status: "pending",
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    });
    const handle = createPlatformHttpHandler(app, { invitationRepository });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: { email: "other@example.com", password: "secure password" },
    })).resolves.toEqual({
      status: 403,
      body: {
        error: {
          code: "invitation_required",
          message: "Use the account link from your league invitation.",
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "owner04@example.com",
        password: "secure password",
        invitationToken: "valid-invitation-token",
      },
    })).resolves.toMatchObject({
      status: 201,
      body: { account: { email: "owner04@example.com" } },
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "new-manager@example.com",
        password: "secure password",
        invitationToken: "shared-league-token",
      },
    })).resolves.toMatchObject({
      status: 201,
      body: { account: { email: "new-manager@example.com" } },
    });
  });
});
