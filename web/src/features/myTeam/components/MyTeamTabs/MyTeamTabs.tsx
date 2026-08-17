import { Link } from "react-router-dom";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { leaguePath } from "../../../league/lib/leaguePaths";
import "./MyTeamTabs.css";

export type MyTeamView = "team" | "prep";

interface MyTeamTabsProps {
  readonly league: OnboardingLeague;
  readonly view: MyTeamView;
}

const tabSearch = (view: MyTeamView): string => `?${new URLSearchParams({ view }).toString()}`;

const tabs: readonly { label: string; view: MyTeamView }[] = [
  { label: "Team", view: "team" },
  { label: "Draft prep", view: "prep" },
];

export const MyTeamTabs = ({ league, view }: MyTeamTabsProps) => (
  <nav aria-label="My team views" className="my-team-tabs">
    {tabs.map(tab => (
      <Link
        aria-current={view === tab.view ? "page" : undefined}
        key={tab.view}
        to={{ pathname: leaguePath(league, "my-team"), search: tabSearch(tab.view) }}
      >{tab.label}</Link>
    ))}
  </nav>
);
