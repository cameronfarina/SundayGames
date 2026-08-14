import { createHash } from "node:crypto";
import { join } from "node:path";

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const scopedSessionDirectory = (
  baseDirectory: string,
  accountId: string,
  seasonId: string,
): string => join(
  baseDirectory,
  `account-${digest(accountId)}`,
  `season-${digest(seasonId)}`,
);

export const draftToolsScopeKey = (accountId: string, seasonId: string): string =>
  `${accountId}\0${seasonId}`;
