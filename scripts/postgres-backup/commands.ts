import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { PostgresCommandRunner } from "./contracts.js";

export const runPostgresCommand: PostgresCommandRunner = async ({ command, args, env }) => {
  const child = spawn(command, [...args], { env, stdio: "ignore" });
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolveExit(code ?? 1));
  });

  if (exitCode !== 0) throw new Error(`${command} exited with code ${exitCode}.`);
};

export const sha256File = async (path: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);

  return hash.digest("hex");
};
