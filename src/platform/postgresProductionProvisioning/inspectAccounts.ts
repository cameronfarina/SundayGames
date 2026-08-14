import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";
import { provisioningChange } from "./change.js";
import type { InspectionPart, ProductionProvisioningDependencies } from "./contracts.js";

export const inspectAccounts = async (
  document: ResolvedProductionProvisioningDocument,
  dependencies: ProductionProvisioningDependencies,
): Promise<InspectionPart> => {
  const changes = [];
  const conflicts: string[] = [];

  for (const account of document.accounts) {
    const accountById = await dependencies.authRepository.findAccountById(account.id);
    const credentialByEmail = await dependencies.authRepository
      .findAccountCredentialByEmail(account.email);
    if (accountById === null && credentialByEmail === null) {
      changes.push(provisioningChange("account", account.id, "create"));
    } else if (
      accountById?.email === account.email
      && credentialByEmail?.account.id === account.id
      && credentialByEmail.passwordHash === account.passwordHash
    ) {
      changes.push(provisioningChange("account", account.id, "unchanged"));
    } else {
      conflicts.push(
        `Account ${account.id} or email ${account.email} already belongs to different production data.`,
      );
      changes.push(provisioningChange("account", account.id, "unchanged"));
    }
  }

  return { changes, conflicts };
};
