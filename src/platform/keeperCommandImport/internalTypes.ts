export interface ParsedKeeperCommand {
  sourceCommand: string;
  teamMention: string;
  playerMention: string;
  rawTrailingValue: string;
  trailingValue: number;
}

export interface ResolutionCandidate<T> {
  id: string;
  label: string;
  entry: T;
  aliases: ReadonlySet<string>;
}
