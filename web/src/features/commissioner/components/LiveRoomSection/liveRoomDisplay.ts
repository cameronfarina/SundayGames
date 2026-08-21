import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";

type ScheduledLeague = OnboardingLeague & { readonly nextDraftAt: string };

export const formatDraftTime = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(instant));

export const scheduledLeagues = (
  leagues: readonly OnboardingLeague[],
): readonly ScheduledLeague[] =>
  [...leagues]
    .filter((candidate): candidate is ScheduledLeague =>
      candidate.canManageLeague
      && candidate.nextDraftAt !== undefined
      && Date.parse(candidate.nextDraftAt) > Date.now()
    )
    .sort((left, right) => {
      const timeDifference = Date.parse(left.nextDraftAt) - Date.parse(right.nextDraftAt);
      return timeDifference === 0
        ? left.leagueName.localeCompare(right.leagueName)
        : timeDifference;
    });

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
