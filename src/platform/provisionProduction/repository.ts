import { PostgresAuthRepository } from "../postgresAuth.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { PostgresLeagueSetupRepository } from "../postgresLeagueSetup.js";
import { PostgresLiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import { PostgresProductionProvisioningRepository } from "../postgresProductionProvisioning.js";
import type { ProductionProvisioningRepository } from "../productionProvisioning.js";

const repositoryFor = (
  client: PostgresTransactionalQueryClient,
): PostgresProductionProvisioningRepository => new PostgresProductionProvisioningRepository({
  client,
  authRepository: new PostgresAuthRepository(client),
  leagueSetupRepository: new PostgresLeagueSetupRepository(client),
  draftSetupRepository: new PostgresLiveDraftRoomSetupRepository(client),
});

export const createTransactionalProductionProvisioningRepository = (
  client: PostgresTransactionalQueryClient,
): ProductionProvisioningRepository => {
  const repository = repositoryFor(client);
  return {
    inspect: async (document, context) => await repository.inspect(document, context),
    verify: async (document, context) => await repository.verify(document, context),
    apply: async (document, context) => await client.transaction(async transactionClient => {
      const transactionScopedClient: PostgresTransactionalQueryClient = {
        query: async (text, values) => await transactionClient.query(text, values),
        transaction: async operation => await operation(transactionScopedClient),
      };
      const transactionRepository = repositoryFor(transactionScopedClient);
      const inspection = await transactionRepository.inspect(document, context);
      if (inspection.conflicts.length > 0) {
        throw new Error(`Production provisioning conflicts:\n- ${inspection.conflicts.join("\n- ")}`);
      }
      if (inspection.auditRecorded && inspection.changes.some(change => change.action !== "unchanged")) {
        throw new Error(
          `Production provisioning audit receipt exists, but state differs for ${document.provisioningId}.`,
        );
      }
      await transactionRepository.apply(document, context);
    }),
  };
};
