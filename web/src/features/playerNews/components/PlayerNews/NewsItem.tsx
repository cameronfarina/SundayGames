import { Star } from "lucide-react";
import { IconButton } from "../../../../shared/ui";
import type { PlayerNewsItem as PlayerNewsItemData } from "../../api/playerNewsSchema";
import { formatNewsTimestamp } from "../../lib/formatNewsTimestamp";
import "./NewsItem.css";

interface NewsItemProps {
  readonly followed: boolean;
  readonly item: PlayerNewsItemData;
  readonly onToggleFollow: (player: string) => void;
}

const playerLine = (item: PlayerNewsItemData): string => {
  if (item.position === undefined) return item.player;
  const team = item.teamAbbreviation === undefined ? "" : ` · ${item.teamAbbreviation}`;
  return `${item.player} · ${item.position}${team}`;
};

// The feed already resolved the most actionable label into `category`, so it
// leads; anything else the provider applied follows it.
const labelsFor = (item: PlayerNewsItemData): readonly string[] =>
  [...new Set([item.category, ...item.categories ?? []])];

const labelClassName = (label: string): string =>
  label === "Injury"
    ? "player-news-item__label player-news-item__label--injury"
    : "player-news-item__label";

export const NewsItem = ({ followed, item, onToggleFollow }: NewsItemProps) => {
  const timestamp = formatNewsTimestamp(item.sourceDate ?? item.fetchedAt);
  const followLabel = followed
    ? `Remove ${item.player} from my players`
    : `Add ${item.player} to my players`;
  return <article className="player-news-item">
    <header>
      <div>
        <div className="player-news-item__player">
          <IconButton
            aria-pressed={followed}
            className="player-news-item__follow"
            label={followLabel}
            onClick={() => { onToggleFollow(item.player); }}
          ><Star aria-hidden="true" fill={followed ? "currentColor" : "none"} size={18} /></IconButton>
          <p>{playerLine(item)}</p>
        </div>
        <h3>{item.headline}</h3>
      </div>
      {timestamp === undefined
        ? null
        : <span className="player-news-item__timestamp">{timestamp}</span>}
    </header>
    <ul aria-label={`Categories for ${item.player}`} className="player-news-item__labels">
      {labelsFor(item).map(label => <li className={labelClassName(label)} key={label}>{label}</li>)}
    </ul>
    <p>{item.fantasyImpact}</p>
    {item.analystImpact === undefined
      ? null
      : <p className="player-news-item__analysis">
        <span>Analyst take</span>
        {item.analystImpact}
      </p>}
    <p className="player-news-item__source">{item.source.provider}</p>
  </article>;
};
