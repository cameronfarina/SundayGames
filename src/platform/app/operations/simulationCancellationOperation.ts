import type { SimulationRun } from "../../simulations.js";
import type {
  CancelPlatformSimulationRunInput,
  FindPlatformSimulationLaunchInput,
} from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

export const cancelSimulationRun = async (
  context: PlatformAppContext,
  input: CancelPlatformSimulationRunInput,
): Promise<SimulationRun> => {
  const account = await context.requireAccount(input.actorSessionToken, input.now);
  const run = await context.simulations.fetchForUser(input.runId, account.id);
  if (run === null) {
    throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
  }
  await context.requirePrivateTeamContext(account, run.request);
  return cloneForRead(await context.simulations.markCanceled(run.id));
};

export const findSimulationLaunch = async (
  context: PlatformAppContext,
  input: FindPlatformSimulationLaunchInput,
): Promise<SimulationRun | null> => {
  const account = await context.requireAccount(input.actorSessionToken, input.now);
  const run = await context.simulations.findByRequestKeyForUser(
    account.id,
    input.seasonId,
    `season-simulation:${input.requestId}`,
  );
  if (run === null) return null;
  await context.requirePrivateTeamContext(account, run.request);
  return cloneForRead(run);
};

export const createSimulationCancellationOperations = (context: PlatformAppContext) => ({
  cancelSimulationRun: async (input: CancelPlatformSimulationRunInput) =>
    await cancelSimulationRun(context, input),
  findSimulationLaunch: async (input: FindPlatformSimulationLaunchInput) =>
    await findSimulationLaunch(context, input),
});
