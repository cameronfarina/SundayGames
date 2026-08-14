import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const applyAccounts = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  for (const account of document.accounts) {
    const existing = await dependencies.authRepository.findAccountById(account.id);
    if (existing === null) {
      await dependencies.authRepository.createAccount({
        id: account.id,
        email: account.email,
        passwordHash: account.passwordHash,
        now: context.now,
      });
    }
  }
};
