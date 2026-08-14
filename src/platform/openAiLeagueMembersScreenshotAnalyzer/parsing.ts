import type {
  LeagueMembersScreenshotImportInput,
  LeagueMembersScreenshotTeamInput,
} from "../leagueMembersScreenshotImport.js";
import { LeagueMembersScreenshotAnalyzerError } from "./errors.js";

type JsonRecord = Record<string, unknown>;

const recordValue = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const stringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) return null;
  return value.flatMap(item => typeof item === "string" ? [item] : []);
};

const parsedTeam = (value: unknown): LeagueMembersScreenshotTeamInput | null => {
  const record = recordValue(value);
  if (record === null || !Number.isSafeInteger(record.draftOrderPosition)) return null;
  if (typeof record.abbreviation !== "string" || typeof record.teamDisplayName !== "string") return null;
  const managers = stringArray(record.managerDisplayNames);
  const issues = stringArray(record.issues);
  if (managers === null || issues === null) return null;
  if (record.confidence !== "high" && record.confidence !== "medium" && record.confidence !== "low") return null;
  return {
    draftOrderPosition: Number(record.draftOrderPosition),
    abbreviation: record.abbreviation,
    teamDisplayName: record.teamDisplayName,
    managerDisplayNames: managers,
    confidence: record.confidence,
    issues,
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

const invalidResponse = (): LeagueMembersScreenshotAnalyzerError =>
  new LeagueMembersScreenshotAnalyzerError(
    "provider_response_invalid",
    "The screenshot could not be read. Try a clearer image.",
  );

export const parsedExtraction = (responseBody: unknown): LeagueMembersScreenshotImportInput => {
  const outputText = outputTextFrom(responseBody);
  if (outputText === null) throw invalidResponse();
  try {
    const parsed = recordValue(JSON.parse(outputText));
    if (parsed === null || !Array.isArray(parsed.teams)) throw invalidResponse();
    const teams = parsed.teams.flatMap(value => {
      const team = parsedTeam(value);
      return team === null ? [] : [team];
    });
    if (teams.length !== parsed.teams.length) throw invalidResponse();
    return {
      leagueName: typeof parsed.leagueName === "string" ? parsed.leagueName : null,
      externalLeagueId: typeof parsed.externalLeagueId === "string" ? parsed.externalLeagueId : null,
      teams,
    };
  } catch (error) {
    if (error instanceof LeagueMembersScreenshotAnalyzerError) throw error;
    throw invalidResponse();
  }
};
