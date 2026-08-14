import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  invitationClaimResponseSchema,
  invitationDetailsSchema,
  invitationOnboardingSchema,
  invitationSessionSchema,
  type InvitationSession,
} from "./invitationSchemas";

export const loadInvitationDetails = (token: string, fetcher: typeof fetch = fetch) => {
  const query = new URLSearchParams({ token });
  return requestPlatformJson({
    path: `/invitations/details?${query.toString()}`,
    responseSchema: invitationDetailsSchema,
    fetcher,
  });
};

export const loadInvitationSession = async (
  fetcher: typeof fetch = fetch,
): Promise<InvitationSession> => {
  try {
    const response = await requestPlatformJson({
      path: "/session",
      responseSchema: invitationSessionSchema,
      fetcher,
    });
    return { status: "signed-in", account: response.account };
  } catch (error) {
    if (error instanceof PlatformApiError && error.status === 401) return { status: "signed-out" };
    throw error;
  }
};

export const loadInvitationOnboarding = (fetcher: typeof fetch = fetch) => requestPlatformJson({
  path: "/onboarding",
  responseSchema: invitationOnboardingSchema,
  fetcher,
});

export interface ClaimInvitationTeamInput {
  readonly token: string;
  readonly teamId: string;
}

export const claimInvitationTeam = (input: ClaimInvitationTeamInput, fetcher: typeof fetch = fetch) =>
  requestPlatformJson({
    path: "/invitations/claim",
    responseSchema: invitationClaimResponseSchema,
    fetcher,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  });
