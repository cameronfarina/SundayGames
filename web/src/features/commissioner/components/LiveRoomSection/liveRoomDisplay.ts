import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";

export const formatDraftTime = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(instant));

export const roomStatusLabel = (
  room: OnboardingLeague["liveDraft"],
  published: boolean,
): string => {
  if (room === null) return published ? "Ready to create room" : "Setup in progress";
  switch (room.status) {
    case "setup": return "Room ready";
    case "countdown": return "Scheduled";
    case "live": return "Live";
    case "paused": return "Paused";
    case "ended": return "Draft ended";
  }
};

export const draftDetailsLabel = (
  room: OnboardingLeague["liveDraft"],
  scheduledAt: string | undefined,
  now = Date.now(),
): "Draft status:" | "Upcoming draft:" | "Draft scheduled for:" => {
  if (
    scheduledAt === undefined
    || room?.status === "live"
    || room?.status === "paused"
    || room?.status === "ended"
  ) return "Draft status:";
  return Date.parse(scheduledAt) > now ? "Upcoming draft:" : "Draft scheduled for:";
};
