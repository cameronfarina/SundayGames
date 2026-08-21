import type {
  AccountOnboardingRepository,
  AccountOnboardingSnapshot,
  AccountOnboardingStage,
} from "./contracts.js";

const stageFor = (
  record: Awaited<ReturnType<AccountOnboardingRepository["findByAccountId"]>>,
): AccountOnboardingStage => {
  if (record?.completedAt !== null && record?.completedAt !== undefined) return "complete";
  if (record?.intent === null || record?.intent === undefined) return "intent";
  if (record.providers === null) return "providers";
  return "connections";
};

export const accountOnboardingSnapshot = async (
  repository: AccountOnboardingRepository,
  accountId: string,
): Promise<AccountOnboardingSnapshot> => {
  const record = await repository.findByAccountId(accountId);
  return {
    intent: record?.intent ?? null,
    providers: record?.providers ?? null,
    stage: stageFor(record),
  };
};
