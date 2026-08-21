import type { SimulationRepository } from "../simulations.js";

const reconciliationIntervalMs = 5 * 60 * 1_000;

export const startSimulationReconciliation = (
  repository: SimulationRepository,
  now: () => Date = () => new Date(),
): (() => void) => {
  const reconcile = (): void => {
    void Promise.resolve(repository.reconcileAbandoned(now())).catch(() => undefined);
  };
  reconcile();
  const timer = setInterval(reconcile, reconciliationIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
};
