import { Link } from "react-router-dom";
import "./MyTeamTabs.css";

export type MyTeamView = "team" | "prep";

interface MyTeamTabsProps {
  readonly seasonId: string | undefined;
  readonly view: MyTeamView;
}

const tabSearch = (seasonId: string | undefined, view: MyTeamView): string => {
  const search = new URLSearchParams({ view });
  if (seasonId !== undefined) search.set("seasonId", seasonId);
  return `?${search.toString()}`;
};

const tabs: readonly { label: string; view: MyTeamView }[] = [
  { label: "Team", view: "team" },
  { label: "Draft prep", view: "prep" },
];

export const MyTeamTabs = ({ seasonId, view }: MyTeamTabsProps) => (
  <nav aria-label="My team views" className="my-team-tabs">
    {tabs.map(tab => (
      <Link
        aria-current={view === tab.view ? "page" : undefined}
        key={tab.view}
        to={{ pathname: "/my-team", search: tabSearch(seasonId, tab.view) }}
      >{tab.label}</Link>
    ))}
  </nav>
);
