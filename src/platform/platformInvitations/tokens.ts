import { createHash, createHmac } from "node:crypto";

export const hashPlatformInvitationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const derivePlatformLeagueInvitationToken = (
  invitationId: string,
  secret: string,
): string => {
  if (secret.length < 32) {
    throw new Error("League invitation token secret must be at least 32 characters.");
  }
  const signature = createHmac("sha256", secret)
    .update(invitationId)
    .digest("base64url");
  return `${invitationId}.${signature}`;
};
