const invitationPath = (token: string): string => {
  const query = new URLSearchParams({ token });
  return `/invite?${query.toString()}`;
};

export const invitationAuthPaths = (token: string) => {
  const query = new URLSearchParams({ returnTo: invitationPath(token) });
  return {
    login: `/login?${query.toString()}`,
    signup: `/signup?${query.toString()}`,
  };
};

export const leaguePathForInvitation = (seasonId: string): string => {
  const query = new URLSearchParams({ seasonId });
  return `/league?${query.toString()}`;
};
