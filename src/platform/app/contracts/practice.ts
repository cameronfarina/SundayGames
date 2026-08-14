export interface ListPracticeShortlistInput {
  actorSessionToken: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface SavePracticeShortlistInput extends ListPracticeShortlistInput {
  playerName: string;
  position: string;
  maxBid?: number | undefined;
}

export interface RemovePracticeShortlistInput extends ListPracticeShortlistInput {
  playerName: string;
}
