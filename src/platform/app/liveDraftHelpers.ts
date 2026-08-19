import type { AccountRecord } from "../auth.js";
import type { DraftExportTeamState } from "../draftExport.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type { LiveDraftRoomStreamActor } from "../liveDraftRoomStream.js";
import { isExportSlotKey } from "./shared.js";

export const liveActorFor = (
  account: AccountRecord,
  leagueId: string,
  membership: Pick<PlatformLeagueMembership, "ownerId" | "role" | "teamId">,
): LiveDraftRoomStreamActor => ({
  userId: account.id,
  leagueId,
  role: membership.role,
  ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
  ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
});

export const exportTeamStateFor = (room: LiveDraftRoom): DraftExportTeamState[] =>
  room.projection.teams.map(team => ({
    teamId: team.teamId,
    teamName: team.teamDisplayName,
    ownerName: team.ownerDisplayName,
    draftOrderPosition: team.draftOrderPosition,
    slots: team.slots.flatMap(slot => {
      if (!isExportSlotKey(slot.slot)) return [];
      return [{
        slot: slot.slot,
        ...(slot.player === undefined
          ? {}
          : {
            player: {
              name: slot.player.name,
              price: slot.player.price,
              source: slot.player.source === "sale"
                ? "auction"
                : slot.player.source === "pick"
                  ? "snake"
                  : "keeper",
            },
          }),
      }];
    }),
  }));
