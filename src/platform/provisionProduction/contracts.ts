import type {
  ProductionProvisioningRepository,
  ProductionProvisioningResult,
} from "../productionProvisioning.js";
import type {
  PlatformRuntimeConfig,
  PlatformRuntimeEnv,
} from "../platformRuntimeConfig.js";

export interface ProductionProvisioningRuntime {
  repository: ProductionProvisioningRepository;
  close(): Promise<void>;
}

export interface ProductionProvisioningCliDependencies {
  readInputFile?: ((path: string) => Promise<string>) | undefined;
  createRuntime?: ((config: PlatformRuntimeConfig) => ProductionProvisioningRuntime) | undefined;
  writeOutput?: ((output: string) => void) | undefined;
}

export interface RunProductionProvisioningCliOptions {
  argv?: readonly string[] | undefined;
  env?: PlatformRuntimeEnv | undefined;
  now?: Date | undefined;
  dependencies?: ProductionProvisioningCliDependencies | undefined;
}

export type RunProductionProvisioningCli = (
  options?: RunProductionProvisioningCliOptions,
) => Promise<ProductionProvisioningResult>;
