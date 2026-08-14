import type { FantasyTeam, SeasonKeeper } from "../../api/leagueSchemas";

interface LeagueTeamsProps {
  readonly teams: readonly FantasyTeam[];
  readonly keepers: readonly SeasonKeeper[];
}

const keeperPrice = (keeper: SeasonKeeper): string => keeper.keeperRound === undefined
  ? `$${String(keeper.price)} keeper`
  : `Round ${String(keeper.keeperRound)} keeper`;

export function LeagueTeams({ teams, keepers }: LeagueTeamsProps) {
  return (
    <section className="league-section" aria-labelledby="league-teams-title">
      <div className="league-section__heading">
        <h2 id="league-teams-title">Teams and keepers</h2>
        <span>{teams.length} teams</span>
      </div>
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
