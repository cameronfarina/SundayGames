import type {
  LiveDraftRoomActor,
  LiveDraftRoomMutationAction,
} from "./core.js";
import type {
  CorrectLiveDraftRoomSaleInput,
  CreateLiveDraftRoomInput,
  EndLiveDraftRoomInput,
  LogLiveDraftRoomSaleInput,
  MutateLiveDraftRoomInput,
  SynchronizeLiveDraftRoomInitialRostersInput,
} from "./inputs.js";
import type { LiveDraftRoom } from "./room.js";

export type LiveDraftRoomAuthorizer = (input: {
  actor: LiveDraftRoomActor;
  action: LiveDraftRoomMutationAction;
  room: LiveDraftRoom;
}) => boolean;

export type LiveDraftRoomRepositoryResult<T> = T | Promise<T>;

export interface LiveDraftRoomRepository {
  createRoom(input: CreateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  getRoom(roomId: string): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  getRoomForActor(input: { roomId: string; actor: LiveDraftRoomActor }): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  hasRoomForSeason(seasonId: string): LiveDraftRoomRepositoryResult<boolean>;
  hasStartedRoomForSeason(seasonId: string): LiveDraftRoomRepositoryResult<boolean>;
  synchronizeInitialRostersForSeason(
    input: SynchronizeLiveDraftRoomInitialRostersInput,
  ): LiveDraftRoomRepositoryResult<LiveDraftRoom | null>;
  cancelRoom(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<void>;
  startRoom(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  pauseRoom(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  resumeRoom(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  reopenRoom(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  logSaleCommand(input: LogLiveDraftRoomSaleInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  correctSale(input: CorrectLiveDraftRoomSaleInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  undoLastSale(input: MutateLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
  endRoom(input: EndLiveDraftRoomInput): LiveDraftRoomRepositoryResult<LiveDraftRoom>;
}
