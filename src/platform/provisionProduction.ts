import { pathToFileURL } from "node:url";
export type {
  ProductionProvisioningCliDependencies,
  ProductionProvisioningRuntime,
  RunProductionProvisioningCliOptions,
} from "./provisionProduction/contracts.js";
export { createTransactionalProductionProvisioningRepository } from "./provisionProduction/repository.js";
export { runProductionProvisioningCli } from "./provisionProduction/runCli.js";
import { runProductionProvisioningCli } from "./provisionProduction/runCli.js";

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runProductionProvisioningCli().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
