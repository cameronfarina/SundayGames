import { pathToFileURL } from "node:url";
import { hashPassword } from "../src/platform/auth.js";
import { readSinglePassword, type PasswordInput } from "../src/platform/passwordInput.js";

interface TextOutput {
  write(chunk: string): unknown;
}

export interface PasswordHashCliIo {
  arguments: readonly string[];
  stdin: PasswordInput;
  stdout: TextOutput;
  stderr: TextOutput;
}

const failureMessage = "Unable to generate password hash from stdin.\n";

export const runPasswordHashCli = async (io: PasswordHashCliIo): Promise<number> => {
  try {
    if (io.arguments.length > 0) throw new Error("Command-line arguments are not supported.");

    const password = await readSinglePassword(io.stdin);
    io.stdout.write(`${hashPassword(password)}\n`);
    return 0;
  } catch {
    io.stderr.write(failureMessage);
    return 1;
  }
};

const entrypointPath = process.argv[1];
if (entrypointPath !== undefined && import.meta.url === pathToFileURL(entrypointPath).href) {
  process.exitCode = await runPasswordHashCli({
    arguments: process.argv.slice(2),
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
