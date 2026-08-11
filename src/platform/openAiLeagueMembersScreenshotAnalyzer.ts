import { Buffer } from "node:buffer";
import type {
  LeagueMembersScreenshotImportInput,
  LeagueMembersScreenshotTeamInput,
} from "./leagueMembersScreenshotImport.js";

export type LeagueMembersScreenshotAnalyzerErrorCode =
  | "invalid_image"
  | "provider_unavailable"
  | "provider_response_invalid";

export class LeagueMembersScreenshotAnalyzerError extends Error {
  constructor(
    readonly code: LeagueMembersScreenshotAnalyzerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueMembersScreenshotAnalyzerError";
  }
}

export interface LeagueMembersScreenshotImageInput {
  mimeType: string;
  base64: string;
}

export interface LeagueMembersScreenshotAnalyzer {
  analyze(input: LeagueMembersScreenshotImageInput): Promise<LeagueMembersScreenshotImportInput>;
}

export interface CreateOpenAiLeagueMembersScreenshotAnalyzerOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
  maxImageBytes?: number;
  maxConcurrentRequests?: number;
  fetchImpl?: typeof fetch;
}

export interface ValidateLeagueMembersScreenshotImageOptions {
  maxImageBytes: number;
}

const supportedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const defaultModel = "gpt-5.6-terra";
const defaultEndpoint = "https://api.openai.com/v1/responses";
const defaultTimeoutMs = 30_000;
const defaultMaxImageBytes = 5 * 1024 * 1024;

const imageMatchesMimeType = (bytes: Buffer, mimeType: string): boolean => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
};

const formattedByteLimit = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`;

  return `${Math.floor(bytes / 1024)} KB`;
};

export const validateLeagueMembersScreenshotImage = (
  input: LeagueMembersScreenshotImageInput,
  options: ValidateLeagueMembersScreenshotImageOptions,
): { mimeType: string; bytes: Buffer } => {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!supportedMimeTypes.has(mimeType)) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      "Choose a PNG, JPEG, or WebP screenshot.",
    );
  }
  const base64 = input.base64.trim();
  if (base64.length === 0 || !/^[a-z0-9+/]+={0,2}$/iu.test(base64)) {
    throw new LeagueMembersScreenshotAnalyzerError("invalid_image", "The screenshot file is invalid.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > options.maxImageBytes) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      `Screenshots must be ${formattedByteLimit(options.maxImageBytes)} or smaller.`,
    );
  }
  if (!imageMatchesMimeType(bytes, mimeType)) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      "The file contents do not match the selected image type.",
    );
  }

  return { mimeType, bytes };
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["leagueName", "externalLeagueId", "teams"],
  properties: {
    leagueName: { type: ["string", "null"] },
    externalLeagueId: { type: ["string", "null"] },
    teams: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "draftOrderPosition",
          "abbreviation",
          "teamDisplayName",
          "managerDisplayNames",
          "confidence",
          "issues",
        ],
        properties: {
          draftOrderPosition: { type: "integer" },
          abbreviation: { type: "string" },
          teamDisplayName: { type: "string" },
          managerDisplayNames: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          issues: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const extractionPrompt = [
  "Extract the league and team identities from this fantasy-football League Members screenshot.",
  "Return only text that is visibly present. Never infer hidden or truncated text.",
  "For each numbered team row, capture its number, abbreviation, visible team name, and every manager name attached to that team.",
  "Continuation rows without a number belong to the previous numbered team.",
  "Preserve ellipses in truncated team names and explain the truncation in issues.",
  "Use medium or low confidence whenever any visible field is unclear.",
  "Extract the league name and numeric external league ID when they are plainly visible; otherwise use null.",
  "Do not extract email addresses or membership status. Do not include invitation URLs or invitation tokens.",
].join(" ");

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nullableString = (value: unknown): string | null => typeof value === "string" ? value : null;

const parsedTeam = (value: unknown): LeagueMembersScreenshotTeamInput | null => {
  const record = recordValue(value);
  if (record === null) return null;
  if (!Number.isSafeInteger(record.draftOrderPosition)) return null;
  if (typeof record.abbreviation !== "string" || typeof record.teamDisplayName !== "string") return null;
  if (!Array.isArray(record.managerDisplayNames) || !record.managerDisplayNames.every(name => typeof name === "string")) return null;
  if (record.confidence !== "high" && record.confidence !== "medium" && record.confidence !== "low") return null;
  if (!Array.isArray(record.issues) || !record.issues.every(issue => typeof issue === "string")) return null;

  return {
    draftOrderPosition: Number(record.draftOrderPosition),
    abbreviation: record.abbreviation,
    teamDisplayName: record.teamDisplayName,
    managerDisplayNames: record.managerDisplayNames as string[],
    confidence: record.confidence,
    issues: record.issues as string[],
    confirmed: false,
  };
};

const outputTextFrom = (responseBody: unknown): string | null => {
  const body = recordValue(responseBody);
  if (body === null || body.status !== "completed" || !Array.isArray(body.output)) return null;

  for (const output of body.output) {
    const message = recordValue(output);
    if (message?.type !== "message" || !Array.isArray(message.content)) continue;
    for (const content of message.content) {
      const part = recordValue(content);
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }

  return null;
};

const parsedExtraction = (responseBody: unknown): LeagueMembersScreenshotImportInput => {
  const outputText = outputTextFrom(responseBody);
  if (outputText === null) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "provider_response_invalid",
      "The screenshot could not be read. Try a clearer image.",
    );
  }

  try {
    const parsed = recordValue(JSON.parse(outputText));
    const teams = Array.isArray(parsed?.teams) ? parsed.teams.map(parsedTeam) : [];
    if (parsed === null || teams.some(team => team === null)) throw new Error("invalid extraction");

    return {
      leagueName: nullableString(parsed.leagueName),
      externalLeagueId: nullableString(parsed.externalLeagueId),
      teams: teams as LeagueMembersScreenshotTeamInput[],
    };
  } catch (error) {
    if (error instanceof LeagueMembersScreenshotAnalyzerError) throw error;
    throw new LeagueMembersScreenshotAnalyzerError(
      "provider_response_invalid",
      "The screenshot could not be read. Try a clearer image.",
    );
  }
};

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
        throw new LeagueMembersScreenshotAnalyzerError(
          "provider_unavailable",
          "Screenshot analysis is busy. Try again in a moment.",
        );
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
          body: JSON.stringify({
            model: options.model ?? defaultModel,
            store: false,
            reasoning: { effort: "low" },
            max_output_tokens: 4_000,
            input: [{
              role: "user",
              content: [
                { type: "input_text", text: extractionPrompt },
                {
                  type: "input_image",
                  image_url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`,
                  detail: "original",
                },
              ],
            }],
            text: {
              format: {
                type: "json_schema",
                name: "league_members_screenshot",
                strict: true,
                schema: outputSchema,
              },
            },
          }),
        });
        if (!response.ok) {
          throw new LeagueMembersScreenshotAnalyzerError(
            "provider_unavailable",
            "Screenshot analysis is temporarily unavailable. Try again in a moment.",
          );
        }

        return parsedExtraction(await response.json());
      } catch (error) {
        if (error instanceof LeagueMembersScreenshotAnalyzerError) throw error;
        throw new LeagueMembersScreenshotAnalyzerError(
          "provider_unavailable",
          "Screenshot analysis is temporarily unavailable. Try again in a moment.",
        );
      } finally {
        clearTimeout(timeout);
        inFlightRequests -= 1;
      }
    },
  };
};
