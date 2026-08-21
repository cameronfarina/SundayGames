import type { AuctionPlayer } from "../../api/auctionBoardSchemas.js";
import type { ManagerDraftProfile as Profile } from "../../api/mockDraftSchemas.js";
import "./ManagerDraftProfile.css";

interface ManagerDraftProfileProps {
  readonly players: readonly AuctionPlayer[];
  readonly profile: Profile;
  readonly teamName: string;
}

const titleCase = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const formatPremium = (premium: number | null) => {
  if (premium === null) return "Not enough comparisons";
  return `${premium > 0 ? "+" : ""}${String(premium)}%`;
};

const formatDraftCount = (count: number) => `${String(count)} imported draft${count === 1 ? "" : "s"}`;

const findPlayersToWatch = (
  profile: Profile,
  players: readonly AuctionPlayer[],
) => {
  if (profile.targetPosition === null) return [];
  return [...players]
    .filter(player => player.available
      && player.status === "available"
      && player.position === profile.targetPosition)
    .sort((left, right) => right.expectedPrice - left.expectedPrice)
    .slice(0, 2);
};

export const ManagerDraftProfile = ({
  players,
  profile,
  teamName,
}: ManagerDraftProfileProps) => {
  const draftCount = formatDraftCount(profile.sample.seasonCount);
  const playersToWatch = findPlayersToWatch(profile, players);
  const starBidding = profile.starBidding === null
    ? "Not enough history"
    : titleCase(profile.starBidding);
  const confidence = profile.confidence === null ? "Limited" : titleCase(profile.confidence);

  return <aside
    aria-label={`${teamName} draft tendencies`}
    className="manager-draft-profile"
  >
    <p className="manager-draft-profile__team">{teamName}</p>
    <h2>Draft tendencies</h2>
    {profile.status === "insufficient-history"
      ? <div className="manager-draft-profile__empty">
          <strong>Not enough history yet</strong>
          <p>Import more past auction drafts to unlock this manager’s tendencies.</p>
          <span>{draftCount}</span>
        </div>
      : <>
          <dl className="manager-draft-profile__rows">
            <div>
              <dt>Historical target</dt>
              <dd>{profile.targetLabel ?? "No clear target"}</dd>
            </div>
            <div>
              <dt>Premium vs league baseline</dt>
              <dd>{formatPremium(profile.premiumVsLeagueBaselinePercent)}</dd>
            </div>
            <div>
              <dt>Star bidding</dt>
              <dd>{starBidding}</dd>
            </div>
            <div>
              <dt>Players to watch</dt>
              <dd>{playersToWatch.length === 0
                ? "No matching players left"
                : playersToWatch.map(player => player.name).join(", ")}</dd>
            </div>
          </dl>
          <p className="manager-draft-profile__source">
            {confidence} confidence · {draftCount}
          </p>
        </>}
  </aside>;
};
