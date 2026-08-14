import type {
  ProductionProvisioningContext,
  ProductionProvisioningInspection,
  ProductionProvisioningRepository,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import { applyProvisioning } from "./apply.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";
import { inspectProvisioning } from "./inspect.js";
import { verifyProvisioning } from "./verify.js";

export class PostgresProductionProvisioningRepository implements ProductionProvisioningRepository {
  readonly #dependencies: ProductionProvisioningDependencies;

  constructor(dependencies: ProductionProvisioningDependencies) {
    this.#dependencies = dependencies;
  }

  async inspect(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<ProductionProvisioningInspection> {
    return await inspectProvisioning(document, context, this.#dependencies);
  }

  async apply(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<void> {
    await applyProvisioning(document, context, this.#dependencies);
  }

  async verify(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<readonly string[]> {
    return await verifyProvisioning(document, context, this.#dependencies);
  }
}
