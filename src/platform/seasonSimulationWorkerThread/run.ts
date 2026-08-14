import {
  runSeasonSimulations,
  SeasonSimulationError,
} from "../seasonSimulationEngine.js";
import { decodeSeasonSimulationWorkerMessage } from "./decodeMessage.js";

type PostMessage = (message: unknown) => void;

const failureMessage = (error: unknown) => ({
  ok: false,
  error: {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : "Season simulation failed.",
    ...(error instanceof SeasonSimulationError ? { code: error.code } : {}),
  },
});

export const runSeasonSimulationWorker = (
  message: unknown,
  postMessage: PostMessage,
): void => {
  try {
    const input = decodeSeasonSimulationWorkerMessage(message);
    postMessage({
      ok: true,
      result: runSeasonSimulations(input, {
        onProgress: progress => postMessage({ type: "progress", progress }),
      }),
    });
  } catch (error) {
    postMessage(failureMessage(error));
  }
};
