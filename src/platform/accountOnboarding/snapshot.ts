import type {
  AccountOnboardingIntent,
  AccountOnboardingRepository,
  AccountOnboardingSnapshot,
  AccountOnboardingStage,
} from "./contracts.js";

type StoredAccountOnboardingIntent = Exclude<AccountOnboardingIntent, "both">;

export interface CompatibleAccountOnboardingSnapshot
  extends Omit<AccountOnboardingSnapshot, "intent"> {
  readonly intent: StoredAccountOnboardingIntent | null;
  readonly intentBoth?: true;
}

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

export const compatibleAccountOnboardingSnapshot = (
  snapshot: AccountOnboardingSnapshot,
): CompatibleAccountOnboardingSnapshot => snapshot.intent === "both"
  ? { ...snapshot, intent: "live_draft", intentBoth: true }
  : {
    intent: snapshot.intent,
    providers: snapshot.providers,
    stage: snapshot.stage,
  };
