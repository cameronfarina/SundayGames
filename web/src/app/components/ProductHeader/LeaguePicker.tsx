import type { OnboardingLeague } from "../../../features/myTeam/api/onboardingSchema";
import { Select } from "../../../shared/ui/Select/Select";

interface LeaguePickerProps {
  readonly activeLeague: OnboardingLeague | undefined;
  readonly leagues: readonly OnboardingLeague[];
  readonly onLeagueChange: (seasonId: string) => void;
}

const leagueLabel = (league: OnboardingLeague): string => (
  `${league.leagueName} · ${String(league.seasonYear)}`
);

export const LeaguePicker = ({
  activeLeague,
  leagues,
  onLeagueChange,
}: LeaguePickerProps) => {
  if (activeLeague === undefined) {
    return <span className="product-header__league-empty">No active league</span>;
  }
  if (leagues.length === 1) {
    return <span className="product-header__league-name">{leagueLabel(activeLeague)}</span>;
  }

  return (
    <Select
      id="active-league"
      label="Active league"
      onValueChange={onLeagueChange}
      options={leagues.map(league => ({
        label: leagueLabel(league),
        value: league.seasonId,
      }))}
      value={activeLeague.seasonId}
    />
  );
};
