import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshInvitationClaimOnboarding } from "../../../shared/api/queries/seasonQueryInvalidation";
import {
  claimInvitationTeam,
  loadInvitationDetails,
  loadInvitationOnboarding,
  loadInvitationSession,
  type ClaimInvitationTeamInput,
} from "../api/invitationApi";

const invitationOptions = (token: string, enabled: boolean) => queryOptions({
  queryKey: ["invitation", token],
  queryFn: () => loadInvitationDetails(token),
  enabled,
});
const sessionOptions = (token: string | null) => queryOptions({
  queryKey: ["invitation-session"],
  queryFn: () => loadInvitationSession(),
  enabled: token !== null,
});
const onboardingOptions = (enabled: boolean) => queryOptions({
  queryKey: ["invitation-onboarding"],
  queryFn: () => loadInvitationOnboarding(),
  enabled,
});

export const useInvitationPageData = (token: string | null) => {
  const hasToken = token !== null;
  const normalizedToken = token ?? "";
  const invitation = useQuery(invitationOptions(normalizedToken, hasToken));
  const session = useQuery(sessionOptions(token));
  const onboarding = useQuery(onboardingOptions(session.data?.status === "signed-in"));

  return { invitation, session, onboarding };
};

export const useClaimInvitationTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClaimInvitationTeamInput) => claimInvitationTeam(input),
    onSuccess: async () => {
      await refreshInvitationClaimOnboarding(queryClient);
    },
  });
};
