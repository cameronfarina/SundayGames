import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe } from "vitest";
import {
  createPlatformServer,
  type PlatformServer,
} from "../../../src/platform/platformServer.js";
import { mockRunner, now } from "./domainFixtures.js";
import { listen } from "./http.js";

export interface PlatformServerTestContext {
  servers: PlatformServer[];
  temporaryDirectory: (prefix?: string) => Promise<string>;
  storePath: () => Promise<string>;
  createListeningServer: (
    options?: Partial<Parameters<typeof createPlatformServer>[0]>,
  ) => Promise<{ platformServer: PlatformServer; baseUrl: string }>;
}

export const describePlatformServer = (
  registerTests: (context: PlatformServerTestContext) => void,
): void => {
  describe("platform server composition", () => {
    let directory: string | undefined;
    const servers: PlatformServer[] = [];

    afterEach(async () => {
      await Promise.all(servers.map(server => server.close()));
      servers.length = 0;

      if (directory !== undefined) {
        await rm(directory, { force: true, recursive: true });
        directory = undefined;
      }
    });

    const temporaryDirectory = async (
      prefix = "mockd-platform-server-",
    ): Promise<string> => {
      directory = await mkdtemp(join(tmpdir(), prefix));
      return directory;
    };

    const storePath = async (): Promise<string> => {
      const storeDirectory = await temporaryDirectory();
      return join(storeDirectory, "platform-store.json");
    };

    const createListeningServer = async (
      options: Partial<Parameters<typeof createPlatformServer>[0]> = {},
    ): Promise<{ platformServer: PlatformServer; baseUrl: string }> => {
      const platformServer = await createPlatformServer({
        simulationRunner: mockRunner,
        now: () => now,
        allowPublicSignup: true,
        provisioningToken: "test-provisioning-token",
        ...options,
      });
      servers.push(platformServer);

      return {
        platformServer,
        baseUrl: await listen(platformServer),
      };
    };

    registerTests({ servers, temporaryDirectory, storePath, createListeningServer });
  });
};
