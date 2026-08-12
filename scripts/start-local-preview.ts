import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const platformPort = "4319";

interface LocalPreviewPathOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly primaryWorktreeDirectory: string | undefined;
}

interface LocalPreviewPaths {
  readonly dataFile: string;
  readonly draftToolsDirectory: string;
}

export const resolveLocalPreviewPaths = ({
  cwd,
  env,
  primaryWorktreeDirectory,
}: LocalPreviewPathOptions): LocalPreviewPaths => {
  const stateDirectory = resolve(primaryWorktreeDirectory ?? cwd, ".mockd");

  return {
    dataFile:
      env.MOCKD_PLATFORM_DATA_FILE?.trim() || resolve(stateDirectory, "platform-local-preview.json"),
    draftToolsDirectory:
      env.MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY?.trim()
      || resolve(stateDirectory, "platform-draft-tools"),
  };
};

export const readPrimaryWorktreeDirectory = (cwd: string): string | undefined => {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain", "-z"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const firstField = output.split("\0", 1)[0];
    const prefix = "worktree ";

    return firstField?.startsWith(prefix) ? firstField.slice(prefix.length) : undefined;
  } catch {
    return undefined;
  }
};

const npmCommand = (): string => process.platform === "win32" ? "npm.cmd" : "npm";

const waitForExit = (child: ChildProcess): Promise<number> =>
  new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolveExit(code ?? 1));
  });

const terminate = (children: readonly ChildProcess[]): void => {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
};

export const startLocalPreview = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const cwd = process.cwd();
  const previewPaths = resolveLocalPreviewPaths({
    cwd,
    env,
    primaryWorktreeDirectory: readPrimaryWorktreeDirectory(cwd),
  });
  const dataFile = previewPaths.dataFile;
  const baseEnv = { ...env };
  delete baseEnv.DATABASE_URL;
  delete baseEnv.MOCKD_DATABASE_URL;
  const platformEnv = {
    ...baseEnv,
    HOST: "127.0.0.1",
    PORT: platformPort,
    MOCKD_PLATFORM_DATA_FILE: dataFile,
    MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: previewPaths.draftToolsDirectory,
    MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
    MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    MOCKD_PROVISIONING_TOKEN: "local-preview-provisioning-token",
  };

  await mkdir(dirname(dataFile), { recursive: true });

  const seed = spawn(npmCommand(), ["run", "platform:seed:e2e"], {
    env: platformEnv,
    stdio: "inherit",
  });
  const seedExitCode = await waitForExit(seed);
  if (seedExitCode !== 0) throw new Error(`Local platform seed exited with code ${seedExitCode}.`);

  const platform = spawn(npmCommand(), ["run", "platform:web"], {
    env: platformEnv,
    stdio: "inherit",
  });
  const children = [platform];
  const shutdown = (): void => terminate(children);

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log(`Mockd local preview: http://127.0.0.1:${platformPort}/login`);

  const exitCode = await waitForExit(platform);
  terminate(children);
  process.exitCode = exitCode;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startLocalPreview().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
