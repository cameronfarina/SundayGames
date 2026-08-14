import type {
  CreateOpenAiLeagueMembersScreenshotAnalyzerOptions,
  LeagueMembersScreenshotAnalyzer,
} from "./contracts.js";
import { LeagueMembersScreenshotAnalyzerError } from "./errors.js";
import { validateLeagueMembersScreenshotImage } from "./image.js";
import { parsedExtraction } from "./parsing.js";
import { requestBodyFor } from "./request.js";

const defaultModel = "gpt-5.6-terra";
const defaultEndpoint = "https://api.openai.com/v1/responses";
const defaultTimeoutMs = 30_000;
const defaultMaxImageBytes = 5 * 1024 * 1024;

const unavailable = (message = "Screenshot analysis is temporarily unavailable. Try again in a moment.") =>
  new LeagueMembersScreenshotAnalyzerError("provider_unavailable", message);

export const createOpenAiLeagueMembersScreenshotAnalyzer = (
  options: CreateOpenAiLeagueMembersScreenshotAnalyzerOptions,
): LeagueMembersScreenshotAnalyzer => {
  const apiKey = options.apiKey.trim();
  if (apiKey.length === 0) throw new Error("OpenAI API key is required for screenshot analysis.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxImageBytes = options.maxImageBytes ?? defaultMaxImageBytes;
  const maxConcurrentRequests = options.maxConcurrentRequests ?? 2;
  if (!Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests <= 0) {
    throw new RangeError("maxConcurrentRequests must be a positive integer.");
  }
  let inFlightRequests = 0;

  return {
    analyze: async input => {
      const image = validateLeagueMembersScreenshotImage(input, { maxImageBytes });
      if (inFlightRequests >= maxConcurrentRequests) {
        throw unavailable("Screenshot analysis is busy. Try again in a moment.");
      }
      inFlightRequests += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
      try {
        const response = await fetchImpl(options.endpoint ?? defaultEndpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify(requestBodyFor(
            options.model ?? defaultModel,
            image.mimeType,
            image.bytes,
          )),
        });
        if (!response.ok) throw unavailable();
        return parsedExtraction(await response.json());
      } catch (error) {
        if (error instanceof LeagueMembersScreenshotAnalyzerError) throw error;
        throw unavailable();
      } finally {
        clearTimeout(timeout);
        inFlightRequests -= 1;
      }
    },
  };
};
