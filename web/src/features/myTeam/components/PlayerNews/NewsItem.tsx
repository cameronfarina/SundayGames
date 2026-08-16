import type { PlayerNewsItem as PlayerNewsItemData } from "../../api/playerNewsSchema";

interface NewsItemProps {
  readonly item: PlayerNewsItemData;
}

const displayTime = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toLocaleString();
};

const playerLine = (item: PlayerNewsItemData): string => {
  if (item.position === undefined) return item.player;
  const team = item.teamAbbreviation === undefined ? "" : ` · ${item.teamAbbreviation}`;
  return `${item.player} · ${item.position}${team}`;
};

export const NewsItem = ({ item }: NewsItemProps) => {
  const timestamp = displayTime(item.sourceDate ?? item.fetchedAt);
  return <article className="player-news-item">
    <header>
      <div>
        <p>{playerLine(item)}</p>
        <h3>{item.headline}</h3>
      </div>
      <span className={`player-news-item__action player-news-item__action--${item.draftAction.toLowerCase().replaceAll(" ", "-")}`}>
        {item.draftAction}
      </span>
    </header>
    <p>{item.fantasyImpact}</p>
    <footer>
      <span>{item.category} · {item.availability.detail}</span>
      <span>{item.source.provider}{timestamp === undefined ? "" : ` · ${timestamp}`}</span>
      {item.source.url === undefined ? null : <a href={item.source.url} rel="noreferrer" target="_blank">Open source</a>}
    </footer>
  </article>;
};
