export class SeasonSimulationWorkerMessageError extends Error {
  constructor() {
    super("Season simulation worker received an invalid message.");
    this.name = "SeasonSimulationWorkerMessageError";
  }
}

export const invalidWorkerMessage = (): never => {
  throw new SeasonSimulationWorkerMessageError();
};
