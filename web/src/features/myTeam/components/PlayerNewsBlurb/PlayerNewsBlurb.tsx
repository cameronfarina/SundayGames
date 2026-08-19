import { formatNewsTimestamp } from "../../../playerNews/lib/formatNewsTimestamp";
import type { InSeasonPlayerNews } from "../../api/inSeasonSchema";
import "./PlayerNewsBlurb.css";

interface PlayerNewsBlurbProps {
  readonly news?: InSeasonPlayerNews | undefined;
}

export const PlayerNewsBlurb = ({ news }: PlayerNewsBlurbProps) => {
  if (news === undefined) return null;
  const reported = formatNewsTimestamp(news.publishedAt);

  return (
    <span className="player-news-blurb">
      {news.injury && <span className="player-news-blurb__injury">Injury</span>}
      <span className="player-news-blurb__headline">{news.headline}</span>
      {reported !== undefined && (
        <span className="player-news-blurb__reported">{reported}</span>
      )}
    </span>
  );
};
