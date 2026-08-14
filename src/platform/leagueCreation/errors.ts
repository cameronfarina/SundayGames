export class LeagueCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeagueCreationError";
  }
}
