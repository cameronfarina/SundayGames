import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlatformHttpResponse } from "../platformHttp.js";
import { firstHeaderValue } from "./headers.js";
import { writeSerializedJsonResponse } from "./jsonResponse.js";
import {
  isAsyncTextStream,
  writeAsyncTextStreamResponse,
  writeEventStreamTextResponse,
} from "./streamResponse.js";

export const writePlatformResponse = async (
  request: IncomingMessage,
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
): Promise<void> => {
  const contentTypeHeader = Object.entries(platformResponse.headers ?? {})
    .find(([name]) => name.toLowerCase() === "content-type")?.[1];
  const contentType = firstHeaderValue(contentTypeHeader);
  if (isAsyncTextStream(platformResponse.body)) {
    await writeAsyncTextStreamResponse(response, platformResponse, platformResponse.body);
    return;
  }
  if (typeof platformResponse.body === "string"
    && contentType?.toLowerCase().startsWith("text/event-stream") === true) {
    writeEventStreamTextResponse(response, platformResponse, platformResponse.body);
    return;
  }
  await writeSerializedJsonResponse(request, response, platformResponse);
};
