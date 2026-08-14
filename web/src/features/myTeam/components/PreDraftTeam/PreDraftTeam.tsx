import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import type { Keeper, SeasonTeam } from "../../api/seasonTeamSchema";
import { TeamFacts } from "../TeamFacts/TeamFacts";
import "../TeamTable/TeamTable.css";

interface PreDraftTeamProps {
  readonly keepers: readonly Keeper[];
  readonly league: OnboardingLeague;
  readonly season: SeasonTeam;
  readonly teamId: string;
}

const dollars = (amount: number): string => `$${String(Math.round(amount))}`;

export const PreDraftTeam = ({ keepers, league, season, teamId }: PreDraftTeamProps) => {
  const teamKeepers = keepers.filter(keeper => keeper.teamId === teamId);
  const settings = season.season.settings;
  const spent = teamKeepers.reduce((total, keeper) => total + keeper.price, 0);
  const openSpots = Math.max(0, settings.roster.rosterSize - teamKeepers.length);
  const auction = settings.draftFormat !== "snake";
  const facts = auction
    ? [
        { label: "Keeper spend", value: dollars(spent) },
        { label: "Budget left", value: dollars(settings.auction.budgetDollars - spent) },
        { label: "Open roster spots", value: String(openSpots) },
      ]
    : [
        { label: "Keepers", value: String(teamKeepers.length) },
        { label: "Open roster spots", value: String(openSpots) },
      ];
  const roomActive = league.liveDraft?.status === "live" || league.liveDraft?.status === "paused";

  return (
    <>
      {roomActive && (
        <div className="my-team-notice" role="status">
          <strong>Draft in progress</strong>
          <span>Your final roster and rank will appear when the commissioner ends the draft.</span>
        </div>
      )}
      <TeamFacts facts={facts} />
      <section className="my-team-section" aria-labelledby="keepers-heading">
        <div className="my-team-section-heading">
          <h2 id="keepers-heading">Keepers</h2>
          <span>{teamKeepers.length} of {settings.roster.rosterSize} roster spots</span>
        </div>
        {teamKeepers.length === 0 ? (
          <p>No keepers are assigned to {league.membership.teamDisplayName}.</p>
        ) : (
          <div className="my-team-table-scroll">
            <table>
              <caption>Keepers assigned to your team</caption>
              <thead><tr><th>Player</th><th>Position</th><th>Cost</th></tr></thead>
              <tbody>{teamKeepers.map(keeper => (
                <tr key={`${keeper.teamId}-${keeper.playerName}`}>
                  <td>{keeper.playerName}</td>
                  <td><span className={`position position-${keeper.position.toLowerCase()}`}>{keeper.position}</span></td>
                  <td>{auction ? dollars(keeper.price) : `Round ${String(keeper.keeperRound ?? "-")}`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="my-team-section" aria-labelledby="coach-heading">
        <h2 id="coach-heading">Coach</h2>
        <p>Coach unlocks after the draft is final.</p>
      </section>
    </>
  );
};
