import type { ScoringSettings } from "../leagueSeason.js";

/**
 * ESPN keys scoring by stat id and Sleeper by name; the sync adapters already
 * agree on these seven names. A league that scores none of them is not broken,
 * it simply scores zero, so only touchdowns can raise an issue.
 */
export interface ImportedScoring {
  issues: readonly string[];
  scoring: ScoringSettings;
}

const defaultPassingTouchdown = 4;
const defaultRushingTouchdown = 6;
const defaultReceivingTouchdown = 6;

/**
 * A league that has never set a touchdown value gets the standard one. A league
 * that deliberately set it to zero or below is a different matter: Sunday Games
 * cannot score that, and quietly replacing the owner's setting would misprice
 * every player, so it stops the import instead.
 */
const touchdownPoints = (
  provided: number | undefined,
  standard: number,
  label: string,
  issues: string[],
): number => {
  if (provided === undefined) return standard;
  if (provided > 0) return provided;
  issues.push(
    `${label} scores ${provided} points in this league, and Sunday Games needs it above zero.`,
  );
  return standard;
};

export const importedScoring = (
  scoring: Readonly<Record<string, number>>,
): ImportedScoring => {
  const issues: string[] = [];
  const touchdowns = {
    passingTouchdown: touchdownPoints(
      scoring.pass_td,
      defaultPassingTouchdown,
      "A passing touchdown",
      issues,
    ),
    rushingTouchdown: touchdownPoints(
      scoring.rush_td,
      defaultRushingTouchdown,
      "A rushing touchdown",
      issues,
    ),
    receivingTouchdown: touchdownPoints(
      scoring.rec_td,
      defaultReceivingTouchdown,
      "A receiving touchdown",
      issues,
    ),
  };

  return {
    issues,
    scoring: {
      passingYards: scoring.pass_yd ?? 0,
      rushingYards: scoring.rush_yd ?? 0,
      receivingYards: scoring.rec_yd ?? 0,
      reception: scoring.rec ?? 0,
      ...touchdowns,
    },
  };
};
