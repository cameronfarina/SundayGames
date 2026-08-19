import { z, type ZodError, type ZodType } from "zod";
import { contractIssues } from "../../../shared/api/http/contractIssues";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { platformErrorSchema } from "../../../shared/api/http/platformErrorSchema";
import {
  simulationProgressSchema,
  simulationResponseSchema,
  type SimulationProgress,
} from "./simulationSchema";

interface StreamCallbacks {
  readonly onProgress: (progress: SimulationProgress) => void;
}

const simulationQueueErrorSchema = z.object({
  error: z.object({
    code: z.enum(["simulation_account_queue_full", "simulation_busy"]),
    message: z.string(),
  }),
});

type SimulationQueueErrorCode = z.infer<
  typeof simulationQueueErrorSchema
>["error"]["code"];

interface SimulationQueueApiErrorInput {
  readonly code: SimulationQueueErrorCode;
  readonly message: string;
  readonly retryAfterSeconds: number;
}

export class SimulationQueueApiError extends PlatformApiError {
  readonly queueCode: SimulationQueueErrorCode;
  readonly retryAfterSeconds: number;

  constructor(input: SimulationQueueApiErrorInput) {
    super({ code: input.code, message: input.message, status: 429 });
    this.name = "SimulationQueueApiError";
    this.queueCode = input.code;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

interface UnreadablePayload {
  readonly body: unknown;
  readonly error: ZodError;
}

// A stream event that fails its schema knows exactly which field was wrong, and
// that is the one thing worth keeping when the read is abandoned. The sites
// with no schema behind them — no body, no result, unreadable JSON — pass
// nothing and carry no issues.
const invalidResponse = (payload?: UnreadablePayload): PlatformApiError => new PlatformApiError({
  body: payload?.body,
  code: "invalid_response",
  issues: payload === undefined ? undefined : contractIssues(payload.error),
  message: "The server returned an unreadable simulation stream.",
  status: 200,
});

const parsePayload = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw invalidResponse();
  }
};

const parseWith = <Schema extends ZodType>(schema: Schema, value: string) => {
  const body = parsePayload(value);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw invalidResponse({ body, error: parsed.error });
  return parsed.data;
};

const errorFor = (value: string): PlatformApiError => {
  const payload = parsePayload(value);
  const queueError = simulationQueueErrorSchema.safeParse(payload);
  if (queueError.success) return new SimulationQueueApiError({
    code: queueError.data.error.code,
    message: queueError.data.error.message,
    retryAfterSeconds: 5,
  });
  const parsed = platformErrorSchema.safeParse(payload);
  if (!parsed.success) return invalidResponse({ body: payload, error: parsed.error });
  return new PlatformApiError({
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    status: 500,
  });
};

interface ParsedEvent {
  readonly data: string;
  readonly name: string;
}

const parseEvent = (block: string): ParsedEvent | undefined => {
  const lines = block.split(/\r?\n/u);
  const name = lines.find(line => line.startsWith("event: "))?.slice(7);
  const data = lines
    .filter(line => line.startsWith("data: "))
    .map(line => line.slice(6))
    .join("\n");
  return name === undefined || data.length === 0 ? undefined : { data, name };
};

export const consumeSimulationStream = async (
  response: Response,
  callbacks: StreamCallbacks,
) => {
  if (response.body === null) throw invalidResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ReturnType<typeof simulationResponseSchema.parse> | undefined;

  for (;;) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value, { stream: !chunk.done });
    const blocks = buffer.split(/\r?\n\r?\n/u);
    buffer = blocks.splice(-1, 1).join("");
    for (const block of blocks) {
      const event = parseEvent(block);
      if (event?.name === "progress") {
        callbacks.onProgress(parseWith(simulationProgressSchema, event.data));
      } else if (event?.name === "result") {
        result = parseWith(simulationResponseSchema, event.data);
      } else if (event?.name === "error") {
        throw errorFor(event.data);
      }
    }
    if (chunk.done) break;
  }

  if (result === undefined) throw invalidResponse();
  return result;
};
