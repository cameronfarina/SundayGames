import {
  InMemoryLiveDraftRoomRepository,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoomRepository,
  type LogLiveDraftRoomSaleInput,
  type MutateLiveDraftRoomInput,
} from "../../../src/platform/liveDraftRooms.js";

export class AsyncLiveDraftRoomRepository implements LiveDraftRoomRepository {
  readonly inner = new InMemoryLiveDraftRoomRepository();
  readonly createInputs: CreateLiveDraftRoomInput[] = [];

  async createRoom(input: CreateLiveDraftRoomInput) {
    this.createInputs.push(structuredClone(input));
    return this.inner.createRoom(input);
  }

  async getRoom(roomId: string) {
    return this.inner.getRoom(roomId);
  }

  async getRoomRevision(roomId: string) {
    return this.inner.getRoomRevision(roomId);
  }

  async getCurrentRoomForActor(
    input: Parameters<LiveDraftRoomRepository["getCurrentRoomForActor"]>[0],
  ) {
    return this.inner.getCurrentRoomForActor(input);
  }

  async getRoomEventsAfterRevision(
    input: Parameters<LiveDraftRoomRepository["getRoomEventsAfterRevision"]>[0],
  ) {
    return this.inner.getRoomEventsAfterRevision(input);
  }

  async getRoomForActor(
    input: Parameters<LiveDraftRoomRepository["getRoomForActor"]>[0],
  ) {
    return this.inner.getRoomForActor(input);
  }

  async hasStartedRoomForSeason(seasonId: string) {
    return this.inner.hasStartedRoomForSeason(seasonId);
  }

  async hasRoomForSeason(seasonId: string) {
    return this.inner.hasRoomForSeason(seasonId);
  }

  async synchronizeInitialRostersForSeason(
    input: Parameters<LiveDraftRoomRepository["synchronizeInitialRostersForSeason"]>[0],
  ) {
    return this.inner.synchronizeInitialRostersForSeason(input);
  }

  async cancelRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.cancelRoom(input);
  }

  async startRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.startRoom(input);
  }

  async pauseRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.pauseRoom(input);
  }

  async resumeRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.resumeRoom(input);
  }

  async reopenRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.reopenRoom(input);
  }

  async logSaleCommand(input: LogLiveDraftRoomSaleInput) {
    return this.inner.logSaleCommand(input);
  }

  async correctSale(input: Parameters<LiveDraftRoomRepository["correctSale"]>[0]) {
    return this.inner.correctSale(input);
  }

  async undoLastSale(input: MutateLiveDraftRoomInput) {
    return this.inner.undoLastSale(input);
  }

  async endRoom(input: Parameters<LiveDraftRoomRepository["endRoom"]>[0]) {
    return this.inner.endRoom(input);
  }
}
