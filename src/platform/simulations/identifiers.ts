import { randomBytes } from "node:crypto";

const simulationIdBytes = 16;

const randomSimulationId = (prefix: string): string =>
  `${prefix}_${randomBytes(simulationIdBytes).toString("base64url")}`;

export const createSimulationId = (): string => randomSimulationId("sim");

export const createSimulationRequestId = (): string => randomSimulationId("simreq");

export const createSimulationResultId = (): string => randomSimulationId("simres");
