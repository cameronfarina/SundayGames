import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  localPreviewPlatformCommand,
  readPrimaryWorktreeDirectory,
  resolveLocalPreviewPaths,
} from "../scripts/start-local-preview.js";

describe("local preview paths", () => {
  const workspaceDirectory = resolve("fixtures", "workspace");
  const mainWorktreeDirectory = resolve(workspaceDirectory, "Mockd");
  const linkedWorktreeDirectory = resolve(workspaceDirectory, "Mockd-league-setup-wizard");
  let temporaryDirectory: string | undefined;
  const runGit = (args: readonly string[]): void => {
    execFileSync("git", args, { stdio: "ignore" });
  };

  afterEach(async () => {
    if (temporaryDirectory === undefined) return;
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  });

  it("discovers the primary checkout from a real linked Git worktree", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-local-preview-"));
    const mainDirectory = join(temporaryDirectory, "Mockd");
    const linkedDirectory = join(temporaryDirectory, "Mockd-feature");

    runGit(["init", mainDirectory]);
    runGit(["-C", mainDirectory, "config", "user.email", "local-preview@mockd.local"]);
    runGit(["-C", mainDirectory, "config", "user.name", "Mockd Local Preview"]);
    await writeFile(join(mainDirectory, "README.md"), "# Mockd\n", "utf8");
    runGit(["-C", mainDirectory, "add", "README.md"]);
    runGit(["-C", mainDirectory, "commit", "--no-gpg-sign", "-m", "Initial commit"]);
    runGit([
      "-C",
      mainDirectory,
      "worktree",
      "add",
      "-b",
      "local-preview-test",
      linkedDirectory,
    ]);

    const primaryWorktreeDirectory = readPrimaryWorktreeDirectory(linkedDirectory);
    const canonicalMainDirectory = await realpath(mainDirectory);

    expect(resolve(primaryWorktreeDirectory ?? "")).toBe(resolve(canonicalMainDirectory));
    expect(resolveLocalPreviewPaths({
      cwd: linkedDirectory,
      env: {},
      primaryWorktreeDirectory,
    }).dataFile).toBe(resolve(canonicalMainDirectory, ".mockd", "platform-local-preview.json"));
  });

  it("shares durable preview state across Git worktrees", () => {
    expect(resolveLocalPreviewPaths({
      cwd: linkedWorktreeDirectory,
      env: {},
      primaryWorktreeDirectory: mainWorktreeDirectory,
    })).toEqual({
      dataFile: resolve(mainWorktreeDirectory, ".mockd", "platform-local-preview.json"),
      draftToolsDirectory: resolve(mainWorktreeDirectory, ".mockd", "platform-draft-tools"),
    });
  });

  it("keeps preview state inside the main checkout", () => {
    expect(resolveLocalPreviewPaths({
      cwd: mainWorktreeDirectory,
      env: {},
      primaryWorktreeDirectory: mainWorktreeDirectory,
    })).toEqual({
      dataFile: resolve(mainWorktreeDirectory, ".mockd", "platform-local-preview.json"),
      draftToolsDirectory: resolve(mainWorktreeDirectory, ".mockd", "platform-draft-tools"),
    });
  });

  it("falls back to the current checkout outside Git", () => {
    expect(resolveLocalPreviewPaths({
      cwd: linkedWorktreeDirectory,
      env: {},
      primaryWorktreeDirectory: undefined,
    })).toEqual({
      dataFile: resolve(linkedWorktreeDirectory, ".mockd", "platform-local-preview.json"),
      draftToolsDirectory: resolve(linkedWorktreeDirectory, ".mockd", "platform-draft-tools"),
    });
  });

  it("preserves explicit local preview path overrides", () => {
    const dataFile = resolve(workspaceDirectory, "custom", "platform.json");
    const draftToolsDirectory = resolve(workspaceDirectory, "custom", "draft-tools");

    expect(resolveLocalPreviewPaths({
      cwd: linkedWorktreeDirectory,
      env: {
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: draftToolsDirectory,
        MOCKD_PLATFORM_DATA_FILE: dataFile,
      },
      primaryWorktreeDirectory: mainWorktreeDirectory,
    })).toEqual({
      dataFile,
      draftToolsDirectory,
    });
  });

  it("runs the platform server from current TypeScript source", () => {
    expect(localPreviewPlatformCommand).toEqual(["run", "platform:web:dev"]);
  });
});
