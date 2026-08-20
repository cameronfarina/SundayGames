import type { SimulationRun } from "../../simulations.js";
import type { ExecutePlatformSimulationRunForWorkerInput } from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";

export const requireSimulationRunForWorker = async (
  context: PlatformAppContext,
  input: ExecutePlatformSimulationRunForWorkerInput,
): Promise<SimulationRun> => {
  const run = await context.simulations.find(input.runId);
  if (
    run.privacyOwnerUserId !== input.userId
    || run.request.leagueId !== input.leagueId
    || run.request.seasonId !== input.seasonId
  ) {
    throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
  }
  const account = await context.authRepository.findAccountById(input.userId);
  if (account === null) {
    throw new PlatformAppError("private_resource", "This prep artifact belongs to a missing account.");
  }
  await context.requirePrivateTeamContext(account, run.request);
  return run;
};
