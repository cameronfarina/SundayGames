export interface SeasonProjectionScoring {
  rushingYards: number;
  rushingTouchdown: number;
  receivingYards: number;
  receivingTouchdown: number;
  reception: number;
}

export interface RushingReceivingSeasonStatLine {
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
}

export interface SeasonLongProjectionInput {
  player: string;
  position: "RB";
  provider: string;
  sourceDate: string;
  sourceUrl: string;
  sourceUrls?: readonly string[] | undefined;
  sourceDescription: string;
  stats: RushingReceivingSeasonStatLine;
}

export interface SeasonProjectionScoringBreakdown {
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  total: number;
}

export interface SeasonLongProjectionCalibration {
  basis: "season-long stat line";
  provider: string;
  sourceDate: string;
  sourceUrl: string;
  sourceUrls: readonly string[];
  sourceDescription: string;
  baselineSeasonProjection: number;
  calibratedSeasonProjection: number;
  weeklyScaleFactor: number;
  scoring: SeasonProjectionScoring;
  statLine: RushingReceivingSeasonStatLine;
  scoringBreakdown: SeasonProjectionScoringBreakdown;
}
