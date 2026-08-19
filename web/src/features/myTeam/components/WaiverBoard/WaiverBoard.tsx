import { useState } from "react";
import type { InSeasonPlayer, InSeasonTeam } from "../../api/inSeasonSchema";
import {
  byeLabel,
  ownedLabel,
  pointsLabel,
  rankLabel,
  tierLabel,
  waiverSourceLabel,
} from "../../lib/inSeasonFormat";
import { FantasyProsCredit } from "../FantasyProsCredit/FantasyProsCredit";
import { PlayerNewsBlurb } from "../PlayerNewsBlurb/PlayerNewsBlurb";
import "../TeamTable/TeamTable.css";
import "./WaiverBoard.css";

type PositionFilter = InSeasonPlayer["position"] | "ALL";

interface WaiverBoardProps {
  readonly team: InSeasonTeam;
}

const positionOrder: readonly InSeasonPlayer["position"][] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const WaiverBoard = ({ team }: WaiverBoardProps) => {
  const [filter, setFilter] = useState<PositionFilter>("ALL");
  const waivers = team.waivers;
  const byWaiverRank = waivers.source === "waiver_rankings";
  const available = positionOrder.filter(position =>
    waivers.players.some(player => player.position === position));
  const shown = filter === "ALL"
    ? waivers.players
    : waivers.players.filter(player => player.position === filter);

  return (
    <section className="my-team-section" aria-labelledby="waivers-heading">
      <p className="my-team-eyebrow">{waiverSourceLabel(waivers.source)}</p>
      <h2 id="waivers-heading">Free agents worth a claim</h2>
      <p>{byWaiverRank
        ? "Ranked by the FantasyPros waiver list, limited to players nobody in your league rosters."
        : `FantasyPros publishes waiver rankings once the season starts. Until then these are unrostered players owned in under ${String(waivers.ownershipThreshold ?? 0)}% of ESPN leagues, ordered by rest-of-season rank.`}</p>
      {waivers.players.length === 0 ? (
        <p>{team.configured
          ? "No unrostered player has a FantasyPros ranking yet."
          : "FantasyPros is not connected, so there are no suggestions to show."}</p>
      ) : (
        <>
          <div className="waiver-board__filters" role="group" aria-label="Filter by position">
            <button
              aria-pressed={filter === "ALL"}
              onClick={() => { setFilter("ALL"); }}
              type="button"
            >All</button>
            {available.map(position => (
              <button
                aria-pressed={filter === position}
                key={position}
                onClick={() => { setFilter(position); }}
                type="button"
              >{position}</button>
            ))}
          </div>
          <div className="my-team-table-scroll">
            <table>
              <caption>Unrostered players ranked by FantasyPros</caption>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>{byWaiverRank ? "Waiver rank" : "Rest-of-season rank"}</th>
                  <th>Tier</th>
                  <th>Rostered (ESPN)</th>
                  <th>Week points</th>
                  <th>Bye</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(player => (
                  <tr key={player.playerId}>
                    <th scope="row">
                      {player.playerName}{" "}
                      <span className={`position position-${player.position.toLowerCase()}`}>
                        {player.position}
                      </span>
                      <PlayerNewsBlurb news={player.news} />
                    </th>
                    <td>{byWaiverRank
                      ? rankLabel(player.waiverRank === undefined
                        ? undefined
                        : { rankEcr: player.waiverRank })
                      : rankLabel(player.restOfSeason)}</td>
                    <td>{tierLabel(player.restOfSeason)}</td>
                    <td>{ownedLabel(player.ownedEspn)}</td>
                    <td>{pointsLabel(player.weeklyProjectedPoints)}</td>
                    <td>{byeLabel(player.byeWeek)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <FantasyProsCredit updatedAt={team.updatedAt} />
    </section>
  );
};
