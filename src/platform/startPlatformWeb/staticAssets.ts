import { resolve } from "node:path";
import {
  loadPlatformStaticWebAssets,
  type PlatformStaticWebAssets,
} from "../platformStaticWebAssets.js";
import type { StartPlatformWebDependencies } from "./contracts.js";

export const staticWebAssetsFor = async (
  env: NodeJS.ProcessEnv,
  dependencies: StartPlatformWebDependencies,
): Promise<PlatformStaticWebAssets | undefined> => {
  if (dependencies.staticWebAssets !== undefined) return dependencies.staticWebAssets;
  if (env.NODE_ENV === "test") return undefined;

  const directory = resolve(env.MOCKD_WEB_ASSETS_DIRECTORY ?? "dist/web");
  return await loadPlatformStaticWebAssets(directory);
};
