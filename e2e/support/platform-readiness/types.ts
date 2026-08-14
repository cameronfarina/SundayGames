import type { Page } from "@playwright/test";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomReadModel } from "../../../src/platform/liveDraftRoomStream.js";
import type { PlatformOnboardingLeague } from "../../../src/platform/platformOnboarding.js";
import type { PricingSnapshot } from "../../../src/platform/pricingSnapshots.js";

export interface DeployedSmokeEnvironment {
  commissionerEmail: string;
  commissionerPassword: string;
  memberEmail: string;
  memberPassword: string;
  seasonId: string;
}

export interface JsonResponse<TBody> {
  status: number;
  body: TBody;
}

export interface SeasonBody {
  season: LeagueSeason;
}

export interface LiveDraftRoomBody {
  room: LiveDraftRoomReadModel;
}

export interface PricingSnapshotsBody {
  pricingSnapshots: readonly PricingSnapshot[];
}

export interface EventsBody {
  events: {
    currentRevision: number;
    events: Array<{
      event: string;
      revision: number;
      data: unknown;
    }>;
  };
}

export interface OnboardingBody {
  leagues: readonly PlatformOnboardingLeague[];
}

export interface ReadySmokeWorkspace {
  commissionerPage: Page;
  memberPage: Page;
  season: LeagueSeason;
  room: LiveDraftRoomReadModel;
  commissionerOwnerName: string;
  memberOwnerName: string;
  commissionerTeamName: string;
  memberTeamName: string;
  salePlayerName: string;
  salePrice: number;
}

export interface BrowserSseEvent {
  type: string;
  lastEventId: string;
  data: unknown;
}
