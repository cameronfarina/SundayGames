import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createAuthService, InMemoryAuthRepository } from "../src/platform/auth.js";
import { runProductionPasswordResetCli } from "../src/platform/resetProductionPassword.js";

const now = new Date("2026-08-11T12:00:00.000Z");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runCli = async (input: string, options: {
  arguments?: readonly string[];
  email?: string;
  isTTY?: boolean;
  repository?: InMemoryAuthRepository;
} = {}): Promise<CliResult & { repository: InMemoryAuthRepository; close: ReturnType<typeof vi.fn> }> => {
  let stdout = "";
  let stderr = "";
  const repository = options.repository ?? new InMemoryAuthRepository();
  const close = vi.fn(async () => {});
  const stdin = Readable.from([input]) as Readable & { isTTY?: boolean };
  stdin.isTTY = options.isTTY ?? false;
  const exitCode = await runProductionPasswordResetCli({
    arguments: options.arguments ?? [],
    env: {
      DATABASE_URL: "postgres://mockd:secret@database.internal/mockd",
      ...(options.email === undefined ? {} : { MOCKD_PASSWORD_RESET_EMAIL: options.email }),
    },
    stdin,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
    now,
    createRuntime: () => ({ repository, close }),
  });

  return { exitCode, stdout, stderr, repository, close };
};

describe("production password reset CLI", () => {
  it("resets the env-selected account from one stdin password and revokes every session", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    await auth.createUser({ email: "owner@example.com", password: "current secure password", now });
    const firstLogin = await auth.login({ email: "owner@example.com", password: "current secure password", now });
    const secondLogin = await auth.login({ email: "owner@example.com", password: "current secure password", now });
    if (firstLogin === null || secondLogin === null) throw new Error("Expected logins.");

    const result = await runCli("replacement secure password\n", {
      email: " OWNER@EXAMPLE.COM ",
      repository,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "Password reset complete.\n",
      stderr: "",
    });
    expect(result.stdout).not.toContain("replacement secure password");
    expect(result.stdout).not.toContain("scrypt$");
    expect(result.close).toHaveBeenCalledOnce();
    await expect(auth.lookupSession(firstLogin.sessionToken, new Date(now.getTime() + 1))).resolves.toBeNull();
    await expect(auth.lookupSession(secondLogin.sessionToken, new Date(now.getTime() + 1))).resolves.toBeNull();
    await expect(auth.login({ email: "owner@example.com", password: "current secure password", now }))
      .resolves.toBeNull();
    await expect(auth.login({ email: "owner@example.com", password: "replacement secure password", now }))
      .resolves.toMatchObject({ account: { email: "owner@example.com" } });
  });

  it.each([
    ["missing target email", "replacement secure password\n", {}],
    ["unknown target email", "replacement secure password\n", { email: "missing@example.com" }],
    ["multiline stdin", "first password\nsecond password\n", { email: "owner@example.com" }],
    ["interactive stdin", "replacement secure password\n", { email: "owner@example.com", isTTY: true }],
    ["command-line argument", "replacement secure password\n", { email: "owner@example.com", arguments: ["argv secret"] }],
  ])("fails closed for %s without exposing credential material", async (_label, input, options) => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    await auth.createUser({ email: "owner@example.com", password: "current secure password", now });

    const result = await runCli(input, { ...options, repository });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Password reset failed.\n");
    expect(result.stderr).not.toMatch(/first password|second password|replacement secure password|argv secret|scrypt\$/);
  });

  it("reports a completed reset as successful when database cleanup fails", async () => {
    let stdout = "";
    let stderr = "";
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    await auth.createUser({ email: "owner@example.com", password: "current secure password", now });
    const stdin = Readable.from(["replacement secure password\n"]) as Readable & { isTTY?: boolean };
    stdin.isTTY = false;

    const exitCode = await runProductionPasswordResetCli({
      arguments: [],
      env: {
        DATABASE_URL: "postgres://mockd:secret@database.internal/mockd",
        MOCKD_PASSWORD_RESET_EMAIL: "owner@example.com",
      },
      stdin,
      stdout: { write: chunk => { stdout += chunk; } },
      stderr: { write: chunk => { stderr += chunk; } },
      now,
      createRuntime: () => ({
        repository,
        close: async () => { throw new Error("close failed"); },
      }),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("Password reset complete.\n");
    expect(stderr).toBe("Password reset complete, but database cleanup failed.\n");
    await expect(auth.login({
      email: "owner@example.com",
      password: "replacement secure password",
      now,
    })).resolves.toMatchObject({ account: { email: "owner@example.com" } });
  });
});
