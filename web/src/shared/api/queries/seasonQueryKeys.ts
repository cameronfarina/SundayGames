type OnboardingKey = readonly ["onboarding"];
type CommissionerSeasonKey = readonly ["commissioner", "season", string];
type CommissionerKeepersKey = readonly ["commissioner", "keepers", string];
type CommissionerInvitationsKey = readonly ["commissioner", "invitations", string];
type LeagueSeasonKey = readonly ["league-season", string];
type SeasonTeamKey = readonly ["season-team", string];
type SeasonKeepersKey = readonly ["season-keepers", string];
type PracticeCatalogKey = readonly ["practice", "catalog", string | undefined, string];
type PracticeCatalogPrefix = readonly ["practice", "catalog", string];

export const seasonQueryKeys = {
  onboarding: (): OnboardingKey => ["onboarding"],
  commissionerSeason: (seasonId: string): CommissionerSeasonKey =>
    ["commissioner", "season", seasonId],
  commissionerKeepers: (seasonId: string): CommissionerKeepersKey =>
    ["commissioner", "keepers", seasonId],
  commissionerInvitations: (seasonId: string): CommissionerInvitationsKey =>
    ["commissioner", "invitations", seasonId],
  leagueSeason: (seasonId: string): LeagueSeasonKey => ["league-season", seasonId],
  seasonTeam: (seasonId: string): SeasonTeamKey => ["season-team", seasonId],
  seasonKeepers: (seasonId: string): SeasonKeepersKey => ["season-keepers", seasonId],
  practiceCatalog: (seasonId: string | undefined, strategy: string): PracticeCatalogKey =>
    ["practice", "catalog", seasonId, strategy],
  practiceCatalogPrefix: (seasonId: string): PracticeCatalogPrefix =>
    ["practice", "catalog", seasonId],
};
