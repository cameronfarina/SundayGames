export interface SimulationCompletionRequestAdmissionInput {
  readonly accountId: string;
  readonly clientAddress: string;
}

export interface SimulationCompletionRequestPermit {
  release(): void;
}

export type SimulationCompletionRequestAdmissionDecision =
  | { readonly allowed: true; readonly permit: SimulationCompletionRequestPermit }
  | { readonly allowed: false; readonly retryAfterMs: number };

const assertPositiveSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
};

const decrement = (counts: Map<string, number>, key: string): void => {
  const next = (counts.get(key) ?? 1) - 1;
  if (next <= 0) counts.delete(key);
  else counts.set(key, next);
};

export const createSimulationCompletionRequestAdmission = (options: {
  readonly maxConcurrentPerAccount: number;
  readonly maxConcurrentPerClient: number;
}) => {
  assertPositiveSafeInteger(options.maxConcurrentPerAccount, "maxConcurrentPerAccount");
  assertPositiveSafeInteger(options.maxConcurrentPerClient, "maxConcurrentPerClient");
  const activeByAccount = new Map<string, number>();
  const activeByClient = new Map<string, number>();

  return {
    acquire: (
      input: SimulationCompletionRequestAdmissionInput,
    ): SimulationCompletionRequestAdmissionDecision => {
      if ((activeByAccount.get(input.accountId) ?? 0) >= options.maxConcurrentPerAccount ||
          (activeByClient.get(input.clientAddress) ?? 0) >= options.maxConcurrentPerClient) {
        return { allowed: false, retryAfterMs: 1_000 };
      }
      activeByAccount.set(input.accountId, (activeByAccount.get(input.accountId) ?? 0) + 1);
      activeByClient.set(input.clientAddress, (activeByClient.get(input.clientAddress) ?? 0) + 1);
      let released = false;
      return {
        allowed: true,
        permit: {
          release: () => {
            if (released) return;
            released = true;
            decrement(activeByAccount, input.accountId);
            decrement(activeByClient, input.clientAddress);
          },
        },
      };
    },
  };
};
