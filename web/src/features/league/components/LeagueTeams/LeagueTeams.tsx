import { Link } from "react-router-dom";
import type { FantasyTeam, SeasonKeeper } from "../../api/leagueSchemas";

interface LeagueTeamsProps {
  readonly keepers: readonly SeasonKeeper[];
  readonly manageKeepersPath: string | undefined;
  readonly teams: readonly FantasyTeam[];
}

const keeperPrice = (keeper: SeasonKeeper): string => keeper.keeperRound === undefined
  ? `$${String(keeper.price)} keeper`
  : `Round ${String(keeper.keeperRound)} keeper`;

export function LeagueTeams({ keepers, manageKeepersPath, teams }: LeagueTeamsProps) {
  return (
    <section className="league-section" aria-labelledby="league-teams-title">
      <div className="league-section__heading">
        <h2 id="league-teams-title">Teams and keepers</h2>
        <div className="league-section__actions">
          <span>{teams.length} teams</span>
          {manageKeepersPath === undefined ? null : (
            <Link className="league-button" to={manageKeepersPath}>Manage keepers</Link>
          )}
        </div>
      </div>
      {manageKeepersPath === undefined ? null : (
        <p className="league-section__description">
          League Home shows the shared keeper list. Add or remove keepers in Commissioner.
        </p>
      )}
      <div className="league-team-list">
        {teams.map((team) => {
          const teamKeepers = keepers.filter((keeper) => keeper.teamId === team.id);
          return (
            <article className="league-team" key={team.id}>
              <div>
                <span className="league-team__order">{team.draftOrderPosition}</span>
                <h3>{team.displayName}</h3>
                <p>{team.managerDisplayNames?.join(", ") ?? team.ownerDisplayName}</p>
              </div>
              {teamKeepers.length === 0 ? <p>No keepers</p> : (
                <ul>
                  {teamKeepers.map((keeper) => (
                    <li key={`${team.id}-${keeper.playerName}`}>
                      <strong>{keeper.playerName}</strong><span>{keeperPrice(keeper)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
