import { SeasonSimulationError } from "./seasonSimulationEngine.js";

const defaultAccountCapacity = 4;

export const accountCapacityFor = (
  configuredCapacity: number | undefined,
  globalCapacity: number,
): number => {
  const capacity = configuredCapacity
    ?? Math.min(defaultAccountCapacity, globalCapacity - 1);
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity >= globalCapacity) {
    throw new Error("Season simulation account capacity must be below global capacity.");
  }
  return capacity;
};

export class SeasonSimulationAccountCapacity {
  readonly #counts = new Map<string, number>();

  constructor(readonly maximum: number) {}

  acquire(rawAccountId: string | undefined): () => void {
    const accountId = rawAccountId?.trim();
    if (accountId === undefined || accountId.length === 0) return () => undefined;
    if ((this.#counts.get(accountId) ?? 0) >= this.maximum) {
      throw new SeasonSimulationError(
        "simulation_account_queue_full",
        "Too many simulations are already running for this account. Try again shortly.",
      );
    }
    this.#counts.set(accountId, (this.#counts.get(accountId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = (this.#counts.get(accountId) ?? 1) - 1;
      if (next === 0) this.#counts.delete(accountId);
      else this.#counts.set(accountId, next);
    };
  }
}
