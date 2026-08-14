import type { ZodType } from "zod";
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

const invalidResponse = (): PlatformApiError => new PlatformApiError({
  code: "invalid_response",
  message: "Mockd returned an unreadable simulation stream.",
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
  const parsed = schema.safeParse(parsePayload(value));
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
};

const errorFor = (value: string): PlatformApiError => {
  const parsed = platformErrorSchema.safeParse(parsePayload(value));
  if (!parsed.success) return invalidResponse();
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
