import type { JobRecord } from "./jobs.js";
import type { RunSeasonSimulationsInput } from "./seasonSimulationEngine.js";
import type { SimulationRun } from "./simulations.js";

export interface AdmitSeasonSimulationInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  count: number;
  seedPrefix: string;
  idempotencyKey: string;
  simulationInput: RunSeasonSimulationsInput;
  strategyText: string;
  note?: string | undefined;
  now?: Date | undefined;
}

export interface AdmittedSeasonSimulation {
  run: SimulationRun;
  job: JobRecord;
}

export interface SeasonSimulationAdmissionRepository {
  admit(input: AdmitSeasonSimulationInput): Promise<AdmittedSeasonSimulation>;
}
