import { Star } from "lucide-react";
import { IconButton } from "../../../../shared/ui";
import type { PlayerNewsItem as PlayerNewsItemData } from "../../api/playerNewsSchema";
import { formatNewsTimestamp } from "../../lib/formatNewsTimestamp";

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
    <p>{item.fantasyImpact}</p>
  </article>;
};
