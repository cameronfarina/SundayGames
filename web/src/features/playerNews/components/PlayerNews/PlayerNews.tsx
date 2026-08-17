import { useState } from "react";
import { Select, TextField, type SelectOption } from "../../../../shared/ui";
import type { PlayerNewsSource } from "../../api/playerNewsSchema";
import { usePlayerNewsQuery } from "../../hooks/usePlayerNewsQuery";
import { usePlayerNewsWatchlist } from "../../hooks/usePlayerNewsWatchlist";
import { formatNewsTimestamp } from "../../lib/formatNewsTimestamp";
import { NewsItem } from "./NewsItem";
import "./PlayerNews.css";

type NewsScope = "all" | "followed";

interface PlayerNewsProps {
  readonly accountId: string;
  readonly seasonId: string | undefined;
}

const sourceOptions: readonly SelectOption[] = [
  { label: "All sources", value: "all" },
  { label: "RotoWire", value: "rotowire-rss" },
  { label: "Our evidence", value: "local" },
];

const sourceFrom = (value: string): PlayerNewsSource =>
  value === "local" || value === "rotowire-rss" ? value : "all";

export const PlayerNews = ({ accountId, seasonId }: PlayerNewsProps) => {
  const [source, setSource] = useState<PlayerNewsSource>("all");
  const [scope, setScope] = useState<NewsScope>("all");
  const [search, setSearch] = useState("");
  const news = usePlayerNewsQuery(seasonId, source);
  const watchlist = usePlayerNewsWatchlist(accountId);
  const query = search.trim().toLowerCase();
  const items = (news.data?.items ?? []).filter(item => {
    const inScope = scope === "all" || watchlist.isFollowed(item.player);
    const searchable = [
      item.player,
      item.teamAbbreviation ?? "",
      item.position ?? "",
      item.headline,
      item.fantasyImpact,
    ].join(" ").toLowerCase();
    return inScope && (query.length === 0 || searchable.includes(query));
  });

  return <section aria-label="Player news feed" className="player-news">
    <div className="player-news__heading">
      <h2>Latest updates</h2>
      {news.data === undefined ? null : <span>Updated {formatNewsTimestamp(news.data.generatedAt)}</span>}
    </div>
    <div className="player-news__toolbar">
      <div aria-label="News views" className="player-news__tabs" role="tablist">
        <button aria-selected={scope === "all"} onClick={() => { setScope("all"); }} role="tab" type="button">All</button>
        <button aria-selected={scope === "followed"} onClick={() => { setScope("followed"); }} role="tab" type="button">My players ({watchlist.players.length})</button>
      </div>
      <Select id="news-source" label="Source" onValueChange={value => { setSource(sourceFrom(value)); }} options={sourceOptions} value={source} />
      <TextField id="news-search" label="Search news" onChange={event => { setSearch(event.currentTarget.value); }} placeholder="Player, team, or headline" value={search} />
    </div>
    {news.isPending ? <p role="status">Loading player news...</p> : null}
    {news.isError ? <div className="player-news__error" role="alert"><p>{news.error.message}</p><button onClick={() => { void news.refetch(); }} type="button">Try again</button></div> : null}
    {!news.isPending && !news.isError && items.length === 0
      ? <p className="player-news__empty">No updates match this player view yet.</p>
      : <div className="player-news__list">{items.map(item => <NewsItem
        followed={watchlist.isFollowed(item.player)}
        item={item}
        key={item.id}
        onToggleFollow={watchlist.toggle}
      />)}</div>}
  </section>;
};
