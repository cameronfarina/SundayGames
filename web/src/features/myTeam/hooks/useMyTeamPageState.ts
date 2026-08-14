import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  keepersQueryOptions,
  onboardingQueryOptions,
  postDraftTeamQueryOptions,
  seasonTeamQueryOptions,
} from "../api/myTeamQueryOptions";
import type { OnboardingLeague } from "../api/onboardingSchema";
import type { PostDraftTeam } from "../api/postDraftSchema";
import type { Keeper, SeasonTeam } from "../api/seasonTeamSchema";

type MyTeamPageState =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "no-league" }
  | { kind: "unassigned"; league: OnboardingLeague }
  | {
      kind: "pre-draft";
      league: OnboardingLeague;
      teamId: string;
      season: SeasonTeam;
      keepers: readonly Keeper[];
    }
  | { kind: "post-draft"; league: OnboardingLeague; team: PostDraftTeam };

const activeLeague = (
  leagues: readonly OnboardingLeague[],
  requestedSeasonId: string | null,
): OnboardingLeague | undefined =>
  leagues.find(league => league.seasonId === requestedSeasonId) ?? leagues[0];

export const useMyTeamPageState = (): MyTeamPageState => {
  const [searchParams] = useSearchParams();
  const requestedSeasonId = searchParams.get("seasonId");
  const onboarding = useQuery(onboardingQueryOptions());
  const league = activeLeague(onboarding.data?.leagues ?? [], requestedSeasonId);
  const teamId = league?.membership.teamId;
  const assigned = teamId !== undefined;
  const draftEnded = league?.liveDraft?.status === "ended";
  const seasonId = league?.seasonId ?? "";
  const roomId = league?.liveDraft?.roomId ?? "";
  const season = useQuery(seasonTeamQueryOptions(seasonId, assigned && !draftEnded));
  const keepers = useQuery(keepersQueryOptions(seasonId, assigned && !draftEnded));
  const postDraft = useQuery(postDraftTeamQueryOptions(roomId, assigned && draftEnded));

  if (onboarding.isPending) return { kind: "loading" };
  if (onboarding.error !== null) return { kind: "error", error: onboarding.error };
  if (league === undefined) return { kind: "no-league" };
  if (teamId === undefined) return { kind: "unassigned", league };
  if (draftEnded) {
    if (postDraft.isPending) return { kind: "loading" };
    if (postDraft.error !== null) return { kind: "error", error: postDraft.error };
    return { kind: "post-draft", league, team: postDraft.data };
  }
  if (season.isPending || keepers.isPending) return { kind: "loading" };
  if (season.error !== null) return { kind: "error", error: season.error };
  if (keepers.error !== null) return { kind: "error", error: keepers.error };

  return { kind: "pre-draft", league, teamId, season: season.data, keepers: keepers.data.keepers };
};
