import type { PlatformDraftSchedule } from "./contracts.js";

export interface DiscordDraftDigestPayload {
  content: string;
}

interface DiscordWebhookPayload extends DiscordDraftDigestPayload {
  allowed_mentions: { parse: readonly string[] };
}

const draftCount = (count: number): string => `${count} draft${count === 1 ? "" : "s"}`;
const maximumListedDrafts = 20;

const localTime = (isoDate: string, timezone: string): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(isoDate));

const discordText = (value: string): string => value
  .replace(/\s+/gu, " ")
  .replace(/([\\`*_~|>])/gu, "\\$1")
  .replace(/@/gu, "＠")
  .trim();

export const discordDraftDigestPayload = (
  schedule: PlatformDraftSchedule,
): DiscordDraftDigestPayload => {
  const lines = [
    `**Sunday Games draft operations — today**`,
    `${draftCount(schedule.summary.scheduledToday)} scheduled today; `
      + `peak estimated concurrency is ${schedule.summary.peakConcurrentDrafts}.`,
  ];
  const activeCarryovers = schedule.today.length - schedule.summary.scheduledToday;
  if (activeCarryovers > 0) {
    lines.push(`${draftCount(activeCarryovers)} still active from an earlier schedule.`);
  }
  const listedDrafts = schedule.today.slice(0, maximumListedDrafts);
  for (const draft of listedDrafts) {
    const room = draft.roomId === null ? "room not created" : draft.roomStatus;
    lines.push(
      `• ${localTime(draft.startsAt, schedule.timezone)} — ${discordText(draft.leagueName)} `
        + `(${draft.draftFormat}, ${draft.teamCount} teams, ${room})`,
    );
  }
  if (schedule.today.length === 0) lines.push("• No drafts scheduled.");
  if (listedDrafts.length < schedule.today.length) {
    lines.push(`• ${schedule.today.length - listedDrafts.length} more — open Draft operations.`);
  }
  if (schedule.summary.roomsNotCreated > 0) {
    lines.push(`${schedule.summary.roomsNotCreated} scheduled draft(s) still need a room.`);
  }
  return { content: lines.join("\n").slice(0, 2_000) };
};

export type DiscordDraftDigestPoster = (
  payload: DiscordDraftDigestPayload,
) => Promise<void>;

export const assertDiscordWebhookUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL must be a Discord webhook URL.");
  }
  const path = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:"
    || url.hostname !== "discord.com"
    || url.port !== ""
    || url.username.length > 0
    || url.password.length > 0
    || url.search.length > 0
    || url.hash.length > 0
    || path.length !== 4
    || path[0] !== "api"
    || path[1] !== "webhooks"
    || !/^\d+$/u.test(path[2] ?? "")
    || (path[3]?.length ?? 0) < 1
  ) {
    throw new Error("MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL must be a Discord webhook URL.");
  }
  return url;
};

export const createDiscordDraftDigestPoster = (input: {
  webhookUrl: string;
  fetcher?: typeof fetch | undefined;
}): DiscordDraftDigestPoster => {
  const url = assertDiscordWebhookUrl(input.webhookUrl);
  const fetcher = input.fetcher ?? fetch;
  return async payload => {
    const webhookPayload: DiscordWebhookPayload = {
      allowed_mentions: { parse: [] },
      content: payload.content,
    };
    const response = await fetcher(url, {
      body: JSON.stringify(webhookPayload),
      headers: { "content-type": "application/json" },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Discord draft digest failed with HTTP ${response.status}.`);
    }
  };
};
