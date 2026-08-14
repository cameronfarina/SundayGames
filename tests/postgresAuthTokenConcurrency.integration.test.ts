import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuthError,
  CapturingAuthMailSender,
  createAuthService,
  hashPassword,
} from "../src/platform/auth.js";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { PostgresAuthRepository } from "../src/platform/postgresAuth.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;
const concurrentAttempts = 20;
const now = new Date("2026-08-14T12:00:00.000Z");

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const tokenFromLatestMessage = (mail: CapturingAuthMailSender): string => {
  const actionUrl = mail.messages.at(-1)?.actionUrl;
  if (actionUrl === undefined) throw new Error("Expected an authentication email.");
  return new URL(actionUrl).searchParams.get("token") ?? "";
};

const expectSingleWinner = (results: readonly PromiseSettledResult<unknown>[]): void => {
  let fulfilled = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      fulfilled += 1;
      continue;
    }
    expect(result.reason).toEqual(
      new AuthError("invalid_or_expired_token", "This link is invalid or has expired."),
    );
  }
  expect(fulfilled).toBe(1);
};

describeWithPostgres("Postgres authentication token admission", () => {
  let adminClient: NodePostgresClient;
  let client: NodePostgresClient;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_auth_admission_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    client = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 30 });
    await applyPlatformPostgresMigrations(client);
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("admits one hash per single-use token across concurrent requests", async () => {
    const mail = new CapturingAuthMailSender();
    const storedHash = hashPassword("mailbox proven password");
    let hashCalls = 0;
    const auth = createAuthService({
      repository: new PostgresAuthRepository(client),
      emailVerificationRequired: true,
      mailSender: mail,
      publicBaseUrl: "https://mockd.test",
      passwordHasher: async () => {
        hashCalls += 1;
        await Promise.resolve();
        return storedHash;
      },
    });
    await auth.createUser({ email: "postgres-concurrency@example.com", now });
    let callsBeforeAction = hashCalls;
    const verificationToken = tokenFromLatestMessage(mail);
    const verificationResults = await Promise.allSettled(Array.from(
      { length: concurrentAttempts },
      () => auth.verifyEmail({
        token: verificationToken,
        newPassword: "mailbox proven password",
        newPasswordConfirmation: "mailbox proven password",
        now,
      }),
    ));
    expectSingleWinner(verificationResults);
    expect(hashCalls - callsBeforeAction).toBe(1);

    await auth.requestPasswordReset({ email: "postgres-concurrency@example.com", now });
    callsBeforeAction = hashCalls;
    const resetToken = tokenFromLatestMessage(mail);
    const resetResults = await Promise.allSettled(Array.from(
      { length: concurrentAttempts },
      () => auth.resetPasswordWithToken({
        token: resetToken,
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
        now,
      }),
    ));
    expectSingleWinner(resetResults);
    expect(hashCalls - callsBeforeAction).toBe(1);
  }, 30_000);
});
