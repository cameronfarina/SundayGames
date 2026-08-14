import type {
  HistoricalImportRepository,
  MaybePromise,
} from "./repositoryContracts.js";

export const runHistoricalImportTransaction = async <T>(
  repository: HistoricalImportRepository,
  operation: (repository: HistoricalImportRepository) => MaybePromise<T>,
): Promise<T> => {
  if (repository.withTransaction === undefined) return await operation(repository);
  return await repository.withTransaction(operation);
};
