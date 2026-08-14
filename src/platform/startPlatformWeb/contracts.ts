import type { AuthMailSender } from "../auth.js";
import type {
  CreateNodePostgresClientOptions,
  NodePostgresClient,
} from "../postgresClient.js";
import type { StartedPlatformServer } from "../platformServer.js";
import type { PlatformStaticWebAssets } from "../platformStaticWebAssets.js";

export interface StartedPlatformWebProcess {
  server: StartedPlatformServer;
  postgresClient: NodePostgresClient | undefined;
  close: () => Promise<void>;
}

export interface StartPlatformWebDependencies {
  authMailSender?: AuthMailSender | undefined;
  postgresClientFactory?: ((
    options: CreateNodePostgresClientOptions,
  ) => NodePostgresClient) | undefined;
  staticWebAssets?: PlatformStaticWebAssets | undefined;
}
