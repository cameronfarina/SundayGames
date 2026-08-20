import type { LiveDraftRoomEventStreamSubscription } from "../liveDraftRoomEventStream.js";
import type { SubscribeToLiveDraftRoomRevisionsInput } from "./contracts.js";
import type { LiveDraftRoomRevisionNotifier } from "./notifier.js";
import type { PostgresLiveDraftRoomStreamAdmission } from "./postgresAdmission.js";

export const openSharedLiveDraftRoomRevisionSubscription = async (input: {
  notifier: LiveDraftRoomRevisionNotifier;
  admission?: PostgresLiveDraftRoomStreamAdmission | undefined;
  subscription: SubscribeToLiveDraftRoomRevisionsInput;
}): Promise<LiveDraftRoomEventStreamSubscription> => {
  const permit = await input.admission?.acquire(input.subscription);
  let localSubscription: ReturnType<LiveDraftRoomRevisionNotifier["subscribe"]>;
  try {
    localSubscription = input.notifier.subscribe(input.subscription);
  } catch (error) {
    await permit?.release();
    throw error;
  }

  let closed = false;
  return {
    waitForRevision: async waitInput => {
      await permit?.renew();
      return await localSubscription.waitForRevision(waitInput);
    },
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        localSubscription.close();
      } finally {
        await permit?.release();
      }
    },
  };
};
