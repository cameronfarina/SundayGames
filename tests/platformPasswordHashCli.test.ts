import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "../src/platform/auth.js";
import { runPasswordHashCli } from "../scripts/hash-production-password.js";

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runCli = async (
  input: string,
  options: { arguments?: readonly string[]; isTTY?: boolean } = {},
): Promise<CliResult> => {
  let stdout = "";
  let stderr = "";
  const stdin = Readable.from([input]);
  Object.defineProperty(stdin, "isTTY", { value: options.isTTY ?? false });

  const exitCode = await runPasswordHashCli({
    arguments: options.arguments ?? [],
    stdin,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } },
  });

  return { exitCode, stdout, stderr };
};

describe("production password hash CLI", () => {
  it.each([
    ["without a terminal newline", "correct horse battery staple1!"],
    ["with a terminal newline", "correct horse battery staple1!\n"],
    ["with a CRLF terminal newline", "correct horse battery staple1!\r\n"],
  ])("emits only an accepted hash %s", async (_label, input) => {
    const result = await runCli(input);
    const hash = result.stdout.trimEnd();

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(result.stdout).toMatch(/^scrypt\$32768\$8\$3\$[^\n]+\n$/);
    expect(verifyPassword("correct horse battery staple1!", hash)).toBe(true);
    expect(result.stdout).not.toContain("correct horse battery staple1!");
  });

  it.each(["abcdef!", "abcdef1", "abcde1 "])(
    "rejects a password outside the application policy %#",
    async input => {
      const result = await runCli(input);

      expect(result).toEqual({
        exitCode: 1,
        stdout: "",
        stderr: "Unable to generate password hash from stdin.\n",
      });
    },
  );

  it.each(["", "\n", "\r\n", "\n\n"])(
    "fails closed for empty input %#",
    async input => {
      const result = await runCli(input);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("Unable to generate password hash from stdin.\n");
    },
  );

  it.each([
    "first password\nsecond password",
    "first password\nsecond password\n",
    "first password\rsecond password",
    "first password\n\n",
  ])("fails closed for multiline input without echoing it %#", async input => {
    const result = await runCli(input);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Unable to generate password hash from stdin.\n");
    expect(result.stderr).not.toContain("first password");
  });

  it("rejects command-line arguments without reading or echoing them", async () => {
    const result = await runCli("valid password from stdin", {
      arguments: ["plaintext argv secret"],
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Unable to generate password hash from stdin.\n");
    expect(result.stderr).not.toContain("plaintext argv secret");
  });

  it("rejects interactive terminal input so the password cannot be echoed", async () => {
    const result = await runCli("valid password from stdin", { isTTY: true });

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "Unable to generate password hash from stdin.\n",
    });
  });

  it("rejects oversized input before hashing it", async () => {
    const result = await runCli("x".repeat(1_025));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Unable to generate password hash from stdin.\n");
  });
});
