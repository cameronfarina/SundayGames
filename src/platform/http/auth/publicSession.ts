import type { SessionRecord } from "../../auth.js";

type PublicSessionRecord = Omit<SessionRecord, "tokenHash">;

export const publicSessionFor = (session: SessionRecord): PublicSessionRecord => ({
  id: session.id,
  accountId: session.accountId,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
  revokedAt: session.revokedAt,
});
