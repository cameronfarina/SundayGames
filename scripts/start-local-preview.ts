import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  localPreviewPlatformCommand,
  localPreviewPlatformPort,
  localPreviewWebCommand,
  localPreviewWebPort,
  startLocalDevelopmentProcesses,
} from "./local-development-processes.js";

export {
  localPreviewPlatformCommand,
  localPreviewPlatformPort,
  localPreviewWebCommand,
  localPreviewWebPort,
};

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

export const startLocalPreview = async (env: NodeJS.ProcessEnv = process.env): Promise<void> => {
  const cwd = process.cwd();
  const previewPaths = resolveLocalPreviewPaths({
    cwd,
    env,
    primaryWorktreeDirectory: readPrimaryWorktreeDirectory(cwd),
  });
  await mkdir(dirname(previewPaths.dataFile), { recursive: true });
  await startLocalDevelopmentProcesses({ ...previewPaths, env });
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startLocalPreview().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
