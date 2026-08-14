import type {
  PlatformOnboardingAccount,
  PlatformOnboardingRepository,
  PlatformOnboardingSnapshot,
} from "./contracts.js";

export const loadPlatformOnboarding = async (
  repository: PlatformOnboardingRepository,
  input: { account: PlatformOnboardingAccount },
): Promise<PlatformOnboardingSnapshot> => ({
  account: input.account,
  leagues: await repository.listForUser(input.account.id),
});
