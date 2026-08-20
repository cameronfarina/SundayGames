import type { LeagueConnectionRepository } from "../leagueConnections.js";

const queuesByRepository = new WeakMap<
  LeagueConnectionRepository,
  Map<string, Promise<void>>
>();

const queueFor = (repository: LeagueConnectionRepository): Map<string, Promise<void>> => {
  const existing = queuesByRepository.get(repository);
  if (existing !== undefined) return existing;
  const created = new Map<string, Promise<void>>();
  queuesByRepository.set(repository, created);
  return created;
};

/** Serializes provider work for one connection without coupling unrelated leagues. */
export const admitLeagueConnectionSync = async <T>(
  repository: LeagueConnectionRepository,
  connectionId: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const queue = queueFor(repository);
  const predecessor = queue.get(connectionId) ?? Promise.resolve();
  let release = (): void => undefined;
  const admitted = new Promise<void>(resolve => {
    release = resolve;
  });
  queue.set(connectionId, admitted);

  await predecessor;
  try {
    return await operation();
  } finally {
    release();
    if (queue.get(connectionId) === admitted) queue.delete(connectionId);
  }
};
