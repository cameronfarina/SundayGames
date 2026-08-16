import { useState } from "react";
import { Select, TextField, type SelectOption } from "../../../../shared/ui";
import type { PlayerNewsSource } from "../../api/playerNewsSchema";
import { useDraftPlanQuery } from "../../hooks/useDraftPrepQueries";
import { usePlayerNewsQuery } from "../../hooks/usePlayerNewsQuery";
import { NewsItem } from "./NewsItem";
import "./PlayerNews.css";

type NewsScope = "roster" | "plan" | "all";

interface PlayerNewsProps {
  readonly rosterNames: readonly string[];
  readonly seasonId: string;
}

const sourceOptions: readonly SelectOption[] = [
  { label: "All sources", value: "all" },
  { label: "RotoWire", value: "rotowire-rss" },
  { label: "Mockd evidence", value: "local" },
];

const scopeOptions: readonly SelectOption[] = [
  { label: "My roster", value: "roster" },
  { label: "Draft plan", value: "plan" },
  { label: "All players", value: "all" },
];

const sourceFrom = (value: string): PlayerNewsSource =>
  value === "local" || value === "rotowire-rss" ? value : "all";

const scopeFrom = (value: string): NewsScope =>
  value === "roster" || value === "plan" ? value : "all";

const newsKey = (value: string): string => value.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");

const namesForScope = (
  scope: NewsScope,
  rosterNames: readonly string[],
  planNames: readonly string[],
): readonly string[] => {
  if (scope === "roster") return rosterNames;
  if (scope === "plan") return planNames;
  return [];
};

export const PlayerNews = ({ rosterNames, seasonId }: PlayerNewsProps) => {
  const [source, setSource] = useState<PlayerNewsSource>("all");
  const [scope, setScope] = useState<NewsScope>(rosterNames.length === 0 ? "plan" : "roster");
  const [search, setSearch] = useState("");
  const plan = useDraftPlanQuery(seasonId);
  const news = usePlayerNewsQuery(seasonId, source);
  const planNames = (plan.data ?? []).map(item => item.playerName);
  const scopedNames = namesForScope(scope, rosterNames, planNames);
  const scopedKeys = new Set(scopedNames.map(newsKey));
  const query = search.trim().toLowerCase();
  const items = (news.data?.items ?? []).filter(item => {
    const inScope = scope === "all" || scopedKeys.has(newsKey(item.player));
    const searchable = `${item.player} ${item.headline} ${item.fantasyImpact}`.toLowerCase();
    return inScope && (query.length === 0 || searchable.includes(query));
  });

  return <section aria-labelledby="player-news-title" className="my-team-section player-news">
    <div className="player-news__heading">
      <div><p className="my-team-eyebrow">Live context</p><h2 id="player-news-title">Player news</h2></div>
      {news.data === undefined ? null : <span>Updated {new Date(news.data.generatedAt).toLocaleTimeString()}</span>}
    </div>
    <p>RotoWire headlines and Mockd evidence, filtered to the players that matter to your draft.</p>
    <div className="player-news__filters">
      <Select id="news-scope" label="Players" onValueChange={value => { setScope(scopeFrom(value)); }} options={scopeOptions} value={scope} />
      <Select id="news-source" label="Source" onValueChange={value => { setSource(sourceFrom(value)); }} options={sourceOptions} value={source} />
      <TextField id="news-search" label="Search updates" onChange={event => { setSearch(event.currentTarget.value); }} placeholder="Player or headline" value={search} />
    </div>
    {plan.isPending || news.isPending ? <p role="status">Loading player news...</p> : null}
    {plan.isError ? <p className="my-team-error" role="alert">{plan.error.message}</p> : null}
    {news.isError ? <div className="player-news__error" role="alert"><p>{news.error.message}</p><button onClick={() => { void news.refetch(); }} type="button">Try again</button></div> : null}
    {!plan.isPending && !news.isPending && !plan.isError && !news.isError && items.length === 0
      ? <p className="player-news__empty">No updates match this player view yet.</p>
      : <div className="player-news__list">{items.map(item => <NewsItem item={item} key={item.id} />)}</div>}
  </section>;
};
