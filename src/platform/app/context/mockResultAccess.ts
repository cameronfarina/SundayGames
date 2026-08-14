import type { AccountRecord } from "../../auth.js";
import type { MockDraftResultReference } from "../../mockSessions.js";
import type { SimulationRepository } from "../../simulations.js";
import { PlatformAppError } from "../errors.js";
import type { PrivateTeamAccess } from "./privateTeamAccess.js";

export interface MockResultAccess {
  requireReadableMockDraftResultReference(
    account: AccountRecord,
    resultRef: MockDraftResultReference | undefined,
  ): Promise<MockDraftResultReference | undefined>;
}

export const createMockResultAccess = (
  simulations: SimulationRepository,
  privateTeamAccess: PrivateTeamAccess,
): MockResultAccess => ({
  requireReadableMockDraftResultReference: async (account, resultRef) => {
    if (resultRef === undefined || resultRef.kind !== "simulation-result") return resultRef;
    const run = await simulations.fetchForUser(resultRef.id, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await privateTeamAccess.requirePrivateTeamContext(account, run.request);
    return resultRef;
  },
});
