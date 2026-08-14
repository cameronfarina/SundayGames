import {
  importEspnLeagueSettings,
  type EspnLeagueSettingsImportInput,
  type EspnLeagueSettingsImportOutcome,
} from "../espnLeagueSettingsImport.js";

const parseResponseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const importEspnLeagueSettingsForRuntime = (
  input: EspnLeagueSettingsImportInput,
): Promise<EspnLeagueSettingsImportOutcome> =>
  importEspnLeagueSettings(input, async request => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    return {
      code: response.status,
      body: parseResponseBody(await response.text()),
    };
  });
