import type { PlatformInvitationRecord } from "./contracts.js";

export const cloneRecord = (
  record: PlatformInvitationRecord,
): PlatformInvitationRecord => ({
  ...record,
  createdAt: new Date(record.createdAt),
  expiresAt: new Date(record.expiresAt),
  ...(record.acceptedAt === undefined
    ? {}
    : { acceptedAt: new Date(record.acceptedAt) }),
  ...(record.revokedAt === undefined
    ? {}
    : { revokedAt: new Date(record.revokedAt) }),
});

export const normalizedInvitationEmail = (email: string): string =>
  email.trim().toLowerCase();
