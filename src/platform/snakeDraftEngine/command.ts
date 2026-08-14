export type SnakeDraftCommand =
  | {
    type: "start";
    expectedRevision: number;
  }
  | {
    type: "pick";
    expectedRevision: number;
    playerId: string;
  }
  | {
    type: "undo";
    expectedRevision: number;
  }
  | {
    type: "complete";
    expectedRevision: number;
  };
