import type { PostDraftTeam } from "../../api/postDraftSchema";
import { TeamFacts } from "../TeamFacts/TeamFacts";
import "../TeamTable/TeamTable.css";

interface PostDraftTeamProps {
  readonly team: PostDraftTeam;
}

const coachStatus = (team: PostDraftTeam): string => {
  const readiness = team.analysis.recommendationReadiness;
  if (readiness.startSit.status === "ready" && readiness.pickupDrop.status === "ready") return "Ready";
  if (readiness.startSit.status === "ready") return "Lineup ready";
  return "Needs current data";
};

export const PostDraftTeamView = ({ team }: PostDraftTeamProps) => {
  const ranking = team.analysis.ranking;
  const facts = [
    { label: "Draft rank", value: ranking.status === "available" ? `#${String(ranking.rank)}` : "Rank unavailable" },
    { label: "Teams ranked", value: String(ranking.teamCount) },
    { label: "Coach", value: coachStatus(team) },
  ];
  const findings = [
    ...team.analysis.strengths.map(finding => ({ ...finding, label: "Strength" })),
    ...team.analysis.risks.map(finding => ({ ...finding, label: "Risk" })),
  ];
  const readinessReasons = [
    ...team.analysis.recommendationReadiness.startSit.reasons,
    ...team.analysis.recommendationReadiness.pickupDrop.reasons,
  ];
  const recommendations = [
    ...team.analysis.recommendations.startSit.records,
    ...team.analysis.recommendations.pickupDrop.records,
  ];

  return (
    <>
      <TeamFacts facts={facts} />
      {ranking.status === "unavailable" && (
        <section className="my-team-notice" aria-labelledby="rank-status-heading">
          <strong id="rank-status-heading">Rank unavailable</strong>
          {ranking.reasons.map(reason => <span key={reason.code}>{reason.message}</span>)}
        </section>
      )}
      <div className="my-team-columns">
        <section className="my-team-section" aria-labelledby="roster-heading">
          <h2 id="roster-heading">Final roster</h2>
          {team.roster.players.length === 0 ? (
            <p>No players were recorded for this team.</p>
          ) : (
            <div className="my-team-table-scroll">
              <table>
                <caption>Your completed draft roster</caption>
                <thead><tr><th>Player</th><th>Position</th></tr></thead>
                <tbody>{team.roster.players.map(player => (
                  <tr key={player.playerId}>
                    <td>{player.playerName}</td>
                    <td><span className={`position position-${player.position.toLowerCase()}`}>{player.position}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="my-team-section" aria-labelledby="findings-heading">
          <h2 id="findings-heading">What stands out</h2>
          {findings.length === 0 ? (
            <p>No major roster findings were generated.</p>
          ) : (
            <ul className="my-team-list">{findings.map(finding => (
              <li key={`${finding.label}-${finding.code}`}>
                <strong>{finding.label}:</strong> {finding.summary} <span>{finding.evidence}</span>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
      <section className="my-team-section" aria-labelledby="coach-heading">
        <h2 id="coach-heading">Coach</h2>
        {recommendations.map(recommendation => (
          <p key={recommendation.recommendationId}>{recommendation.explanation}</p>
        ))}
        {readinessReasons.map(reason => <p key={`${reason.code}-${reason.input ?? "input"}`}>{reason.message}</p>)}
        {recommendations.length === 0 && readinessReasons.length === 0 && <p>No coach actions are available yet.</p>}
      </section>
    </>
  );
};
