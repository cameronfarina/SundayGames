import {
  LiveDraftRoomError,
  type CorrectLiveDraftRoomSaleInput,
  type CreateLiveDraftRoomInput,
  type EndLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomActor,
  type LiveDraftRoomAuthorizer,
  type LiveDraftRoomRepository,
  type LogLiveDraftRoomSaleInput,
  type MutateLiveDraftRoomInput,
  type SynchronizeLiveDraftRoomInitialRostersInput,
} from "../liveDraftRooms.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { cancelRoom } from "./cancelRoom.js";
import { assertCreateRoomFormat, createRoom } from "./createRoom.js";
import { repositoryForRoom } from "./memoryRepository.js";
import { mutateRoom } from "./mutateRoom.js";
import { allRooms, hasRoomForSeason, hasStartedRoomForSeason } from "./queries.js";
import { cloneRoom } from "./snapshotCodec.js";
import { latestRoomSnapshot } from "./snapshotRead.js";
import { synchronizeInitialRostersForSeason } from "./synchronizeRosters.js";

export class PostgresLiveDraftRoomRepository implements LiveDraftRoomRepository {
  constructor(
    readonly client: PostgresTransactionalQueryClient,
    readonly authorizer?: LiveDraftRoomAuthorizer | undefined,
  ) {}

  async createRoom(input: CreateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    assertCreateRoomFormat(input);
    return await this.client.transaction(async client =>
      await createRoom(client, this.authorizer, input)
    );
  }

  async getRoom(roomId: string): Promise<LiveDraftRoom> {
    const room = await latestRoomSnapshot(this.client, roomId);
    if (room === undefined) {
      throw new LiveDraftRoomError(
        "room_not_found",
        `Live draft room "${roomId}" was not found.`,
      );
    }
    return cloneRoom(room);
  }

  async getRoomForActor(input: {
    roomId: string;
    actor: LiveDraftRoomActor;
  }): Promise<LiveDraftRoom> {
    const room = await this.getRoom(input.roomId);
    return cloneRoom(repositoryForRoom(room, this.authorizer).getRoomForActor(input));
  }

  async hasStartedRoomForSeason(seasonId: string): Promise<boolean> {
    return await hasStartedRoomForSeason(this.client, seasonId);
  }

  async hasRoomForSeason(seasonId: string): Promise<boolean> {
    return await hasRoomForSeason(this.client, seasonId);
  }

  async synchronizeInitialRostersForSeason(
    input: SynchronizeLiveDraftRoomInitialRostersInput,
  ): Promise<LiveDraftRoom | null> {
    return await this.client.transaction(async client =>
      await synchronizeInitialRostersForSeason(client, this.authorizer, input)
    );
  }

  async cancelRoom(input: MutateLiveDraftRoomInput): Promise<void> {
    await this.client.transaction(async client =>
      await cancelRoom(client, this.authorizer, input)
    );
  }

  async startRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.startRoom(input));
  }

  async pauseRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.pauseRoom(input));
  }

  async resumeRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.resumeRoom(input));
  }

  async reopenRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.reopenRoom(input));
  }

  async logSaleCommand(input: LogLiveDraftRoomSaleInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.logSaleCommand(input));
  }

  async correctSale(input: CorrectLiveDraftRoomSaleInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.correctSale(input));
  }

  async undoLastSale(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.undoLastSale(input));
  }

  async endRoom(input: EndLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.runMutation(input, repository => repository.endRoom(input));
  }

  async rooms(): Promise<readonly LiveDraftRoom[]> {
    return await allRooms(this.client);
  }

  private async runMutation(
    input: MutateLiveDraftRoomInput,
    mutation: Parameters<typeof mutateRoom>[3],
  ): Promise<LiveDraftRoom> {
    return await this.client.transaction(async client =>
      await mutateRoom(client, this.authorizer, input, mutation)
    );
  }
}
