export interface DraftSseEvent {
  readonly event: string;
  readonly roomId: string;
  readonly revision: number;
}

export class SseContractError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const eventFromBlock = (block: string): DraftSseEvent | undefined => {
  const lines = block.replaceAll("\r\n", "\n").split("\n");
  if (lines.every(line => line === "" || line.startsWith(":"))) return undefined;
  const eventLine = lines.find(line => line.startsWith("event:"));
  const dataLines = lines.filter(line => line.startsWith("data:"));
  if (eventLine === undefined || dataLines.length === 0) throw new SseContractError("Invalid SSE event fields.");
  let data: unknown;
  try {
    data = JSON.parse(dataLines.map(line => line.slice(5).trimStart()).join("\n"));
  } catch {
    throw new SseContractError("Invalid SSE JSON data.");
  }
  if (
    !isRecord(data) || typeof data.roomId !== "string" ||
    !Number.isSafeInteger(data.revision) || Number(data.revision) < 0
  ) {
    throw new SseContractError("Invalid SSE room revision data.");
  }
  return {
    event: eventLine.slice(6).trimStart(),
    roomId: data.roomId,
    revision: Number(data.revision),
  };
};

export class DraftSseParser {
  readonly #decoder = new TextDecoder();
  #buffer = "";

  push(chunk: Uint8Array): readonly DraftSseEvent[] {
    this.#buffer += this.#decoder.decode(chunk, { stream: true });
    const events: DraftSseEvent[] = [];
    while (true) {
      const separator = /\r?\n\r?\n/.exec(this.#buffer);
      if (separator === null) return events;
      const block = this.#buffer.slice(0, separator.index);
      this.#buffer = this.#buffer.slice(separator.index + separator[0].length);
      const event = eventFromBlock(block);
      if (event !== undefined) events.push(event);
    }
  }

  bufferedCharacterCount(): number {
    return this.#buffer.length;
  }
}
