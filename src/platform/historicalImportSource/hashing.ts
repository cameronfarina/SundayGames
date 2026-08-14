import { createHash } from "node:crypto";

export const normalizeSourceText = (sourceText: string): string => {
  const lines = sourceText
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n/gu, "\n")
    .replace(/\r/gu, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+$/u, ""));

  while (lines.length > 0 && (lines.at(-1) ?? "").trim().length === 0) {
    lines.pop();
  }

  return lines.join("\n");
};

export const fileHashFor = (normalizedSourceText: string): string =>
  `sha256:${createHash("sha256").update(normalizedSourceText).digest("hex")}`;

export const wideAuctionSourceHashFor = (
  normalizedSourceText: string,
  inferFirstRosterRowAsKeeper: boolean,
): string => inferFirstRosterRowAsKeeper
  ? fileHashFor(`${normalizedSourceText}\nmockd:infer-first-roster-row-as-keeper=true`)
  : fileHashFor(normalizedSourceText);
