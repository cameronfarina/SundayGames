import type { DraftFormat } from "../leagueSeason.js";
import type { LiveDraftRoomStatus } from "../liveDraftRooms.js";

export interface PlatformDraftOperationsRecord {
  roomId: string | null;
  roomStatus: LiveDraftRoomStatus | null;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  draftFormat: DraftFormat;
  teamCount: number;
  startsAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface PlatformDraftOperationsItem {
  roomId: string | null;
  roomStatus: LiveDraftRoomStatus | null;
  readiness: "room_ready" | "room_not_created";
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  draftFormat: DraftFormat;
  teamCount: number;
  startsAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface PlatformDraftOperationsRepository {
  listScheduledDrafts(input: {
    from: Date;
    to: Date;
  }): Promise<readonly PlatformDraftOperationsRecord[]>;
}

export interface PlatformDraftSchedule {
  generatedAt: string;
  timezone: string;
  today: readonly PlatformDraftOperationsItem[];
  upcoming: readonly PlatformDraftOperationsItem[];
  summary: {
    scheduledToday: number;
    scheduledUpcoming: number;
    roomsNotCreated: number;
    liveNow: number;
    peakConcurrentDrafts: number;
    estimatedDraftDurationMinutes: number;
    peakWindow: { startsAt: string; endsAt: string } | null;
  };
}
