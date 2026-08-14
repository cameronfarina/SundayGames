import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PlatformDraftStorageReadinessProbe } from "./contracts.js";

export const probeWritableDraftToolsDirectory: PlatformDraftStorageReadinessProbe =
  async directory => {
    await mkdir(directory, { recursive: true });
    const probePath = join(directory, `.mockd-readiness-${randomUUID()}`);
    let probeFile: Awaited<ReturnType<typeof open>> | undefined;
    try {
      probeFile = await open(probePath, "wx", 0o600);
      await probeFile.writeFile("mockd readiness probe\n", "utf8");
      await probeFile.sync();
    } finally {
      try {
        await probeFile?.close();
      } finally {
        if (probeFile !== undefined) await rm(probePath, { force: true });
      }
    }
  };
