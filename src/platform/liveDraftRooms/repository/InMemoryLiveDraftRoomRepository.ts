import type { LiveDraftRoomActor } from "../contracts/core.js";
import type {
  CorrectLiveDraftRoomSaleInput,
  CreateLiveDraftRoomInput,
  EndLiveDraftRoomInput,
  LogLiveDraftRoomSaleInput,
  MutateLiveDraftRoomInput,
  SynchronizeLiveDraftRoomInitialRostersInput,
} from "../contracts/inputs.js";
import type {
  LiveDraftRoomAuthorizer,
  LiveDraftRoomRepository,
} from "../contracts/repository.js";
import type { LiveDraftRoom, LiveDraftRoomSummary } from "../contracts/room.js";
import { cancelRoom } from "./cancelRoom.js";
import { correctSale } from "./correctSale.js";
import { createRoom } from "./createRoom.js";
import type { LiveDraftRoomRepositoryContext } from "./context.js";
import { endRoom } from "./endRoom.js";
import { pauseRoom, resumeRoom, startRoom } from "./liveLifecycle.js";
import { logSaleCommand } from "./logSale.js";
import {
  getRoom,
  getRoomForActor,
  hasRoomForSeason,
  hasStartedRoomForSeason,
} from "./queries.js";
import { reopenRoom } from "./reopenRoom.js";
import { replaceRooms, rooms, roomSummaries } from "./snapshots.js";
import { synchronizeInitialRostersForSeason } from "./synchronizeInitialRosters.js";
import { undoLastSale } from "./undoSale.js";

export class InMemoryLiveDraftRoomRepository implements LiveDraftRoomRepository {
  readonly #context: LiveDraftRoomRepositoryContext;

  constructor(readonly authorizer?: LiveDraftRoomAuthorizer | undefined) {
    this.#context = { roomsById: new Map(), authorizer };
  }

  createRoom(input: CreateLiveDraftRoomInput): LiveDraftRoom {
    return createRoom(this.#context, input);
  }

  getRoom(roomId: string): LiveDraftRoom {
    return getRoom(this.#context, roomId);
  }

  getRoomForActor(input: { roomId: string; actor: LiveDraftRoomActor }): LiveDraftRoom {
    return getRoomForActor(this.#context, input);
  }

  hasStartedRoomForSeason(seasonId: string): boolean {
    return hasStartedRoomForSeason(this.#context, seasonId);
  }

  hasRoomForSeason(seasonId: string): boolean {
    return hasRoomForSeason(this.#context, seasonId);
  }

  synchronizeInitialRostersForSeason(
    input: SynchronizeLiveDraftRoomInitialRostersInput,
  ): LiveDraftRoom | null {
    return synchronizeInitialRostersForSeason(this.#context, input);
  }

  cancelRoom(input: MutateLiveDraftRoomInput): void {
    cancelRoom(this.#context, input);
  }

  startRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    return startRoom(this.#context, input);
  }

  pauseRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    return pauseRoom(this.#context, input);
  }

  resumeRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    return resumeRoom(this.#context, input);
  }

  reopenRoom(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    return reopenRoom(this.#context, input);
  }

  logSaleCommand(input: LogLiveDraftRoomSaleInput): LiveDraftRoom {
    return logSaleCommand(this.#context, input);
  }

  correctSale(input: CorrectLiveDraftRoomSaleInput): LiveDraftRoom {
    return correctSale(this.#context, input);
  }

  undoLastSale(input: MutateLiveDraftRoomInput): LiveDraftRoom {
    return undoLastSale(this.#context, input);
  }

  endRoom(input: EndLiveDraftRoomInput): LiveDraftRoom {
    return endRoom(this.#context, input);
  }

  rooms(): readonly LiveDraftRoom[] {
    return rooms(this.#context);
  }

  roomSummaries(): readonly LiveDraftRoomSummary[] {
    return roomSummaries(this.#context);
  }

  replaceRooms(replacementRooms: readonly LiveDraftRoom[]): void {
    replaceRooms(this.#context, replacementRooms);
  }
}
