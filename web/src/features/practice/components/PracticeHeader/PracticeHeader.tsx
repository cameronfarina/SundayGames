import type { PracticeLeague } from "../../api/practiceContextSchema";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import "./PracticeHeader.css";

interface PracticeHeaderProps {
  readonly activeLeague: PracticeLeague | undefined;
  readonly leagues: readonly PracticeLeague[];
  readonly onLeagueChange: (seasonId: string) => void;
  readonly onStrategyChange: (strategy: string) => void;
  readonly strategy: string;
}

const strategyOptions = [
  { label: "Balanced", value: "balanced" },
  { label: "Hero RB", value: "hero-rb" },
  { label: "Three RB", value: "three-rb" },
  { label: "WR heavy", value: "wr-heavy" },
];

export function PracticeHeader(props: PracticeHeaderProps) {
  const leagueOptions = [
    { label: "Baseline board", value: "baseline" },
    ...props.leagues.map(league => ({
      label: `${league.leagueName} · ${String(league.seasonYear)}`,
      value: league.seasonId,
    })),
  ];

  return (
    <header className="practice-header">
      <div>
        <p className="practice-eyebrow">Practice</p>
        <h1 id="practice-title">Draft lab</h1>
        <p>Build a plan, test complete league drafts, and compare every outcome.</p>
      </div>
      <div className="practice-header__controls">
        <div className="practice-header__field"><span>League</span><PracticeSelect
          label="Active league"
          onValueChange={props.onLeagueChange}
          options={leagueOptions}
          value={props.activeLeague?.seasonId ?? "baseline"}
        /></div>
        <div className="practice-header__field"><span>My value strategy</span><PracticeSelect
          label="My value strategy"
          onValueChange={props.onStrategyChange}
          options={strategyOptions}
          value={props.strategy}
        /></div>
      </div>
    </header>
  );
}
