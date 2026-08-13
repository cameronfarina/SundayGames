import { pathToFileURL } from "node:url";
import { startPlatformWebFromEnv } from "../src/platform/startPlatformWeb.js";

const openAiResponsesEndpoint = "https://api.openai.com/v1/responses";
const originalFetch = globalThis.fetch;

const deterministicOpenAiResponse = (): Response => new Response(JSON.stringify({
  status: "completed",
  output: [{
    type: "message",
    content: [{
      type: "output_text",
      text: JSON.stringify({
        leagueName: "Deterministic screenshot league",
        externalLeagueId: "e2e-screenshot",
        teams: Array.from({ length: 4 }, (_, index) => ({
          draftOrderPosition: index + 1,
          abbreviation: `T${index + 1}`,
          teamDisplayName: `Deterministic Team ${index + 1}`,
          managerDisplayNames: [`Manager ${index + 1}`],
          confidence: "high",
          issues: [],
        })),
      }),
    }],
  }],
}), {
  status: 200,
  headers: { "content-type": "application/json" },
});

export const installDeterministicScreenshotAnalyzerTransport = (): void => {
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === openAiResponsesEndpoint) return deterministicOpenAiResponse();

    return await originalFetch(input, init);
  };
};

const run = async (): Promise<void> => {
  installDeterministicScreenshotAnalyzerTransport();
  const processRuntime = await startPlatformWebFromEnv();
  const shutdown = async (): Promise<void> => await processRuntime.close();

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
