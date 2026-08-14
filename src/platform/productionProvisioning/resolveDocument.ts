import { canonicalJson, sha256 } from "./canonicalJson.js";
import type {
  ProductionProvisioningDocument,
  ResolvedProductionProvisioningDocument,
} from "./contracts.js";
import { isSupportedPasswordHash } from "./passwordHash.js";

export const resolveDocument = (
  document: ProductionProvisioningDocument,
  env: Readonly<Record<string, string | undefined>>,
): ResolvedProductionProvisioningDocument => ({
  ...document,
  accounts: document.accounts.map(account => {
    const passwordHash = env[account.passwordHashEnv]?.trim();
    if (passwordHash === undefined || passwordHash.length === 0) {
      throw new Error(`${account.passwordHashEnv} is required for production provisioning.`);
    }
    if (!isSupportedPasswordHash(passwordHash)) {
      throw new Error(`${account.passwordHashEnv} must contain a supported canonical Mockd scrypt password hash.`);
    }
    return { ...account, passwordHash };
  }),
});

export const digestFor = (document: ResolvedProductionProvisioningDocument): string => {
  const canonical = canonicalJson({
    document: {
      ...document,
      accounts: document.accounts.map(({ passwordHash: _passwordHash, ...account }) => account),
    },
    credentialDigests: document.accounts.map(account => ({
      accountId: account.id,
      passwordHashDigest: sha256(account.passwordHash),
    })),
  });
  if (canonical === undefined) throw new Error("Unable to canonicalize production provisioning input.");
  return sha256(canonical);
};
