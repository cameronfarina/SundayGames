export type LiveDraftLocation =
  | { readonly ok: true; readonly roomId: string; readonly seasonId: string }
  | { readonly ok: false; readonly message: string };

export const readLiveDraftLocation = (query: URLSearchParams): LiveDraftLocation => {
  const seasonId = query.get("seasonId")?.trim();
  if (seasonId === undefined || seasonId.length === 0) {
    return { ok: false, message: "This draft link is missing its league season." };
  }
  const roomId = query.get("roomId")?.trim();
  if (roomId === undefined || roomId.length === 0) {
    return { ok: false, message: "This draft link is missing its room." };
  }
  return { ok: true, roomId, seasonId };
};
