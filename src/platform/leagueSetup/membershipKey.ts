export const membershipKeyFor = (userId: string, leagueId: string): string =>
  `${userId}\0${leagueId}`;
