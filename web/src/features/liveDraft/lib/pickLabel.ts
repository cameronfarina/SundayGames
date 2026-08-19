import type { LiveDraftPick } from "../api/liveDraftSchemas";

/** "2.03" reads the way managers say it out loud, unlike a bare overall number. */
export const pickLabel = (pick: LiveDraftPick): string =>
  `${String(pick.round)}.${String(pick.pickInRound).padStart(2, "0")}`;
