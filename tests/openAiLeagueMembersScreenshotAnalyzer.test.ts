import { describe, expect, it, vi } from "vitest";
import {
  LeagueMembersScreenshotAnalyzerError,
  createOpenAiLeagueMembersScreenshotAnalyzer,
  validateLeagueMembersScreenshotImage,
} from "../src/platform/openAiLeagueMembersScreenshotAnalyzer.js";

const tinyPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

describe("OpenAI league members screenshot analyzer", () => {
  it("accepts supported image bytes and rejects MIME mismatches and oversized uploads", () => {
    expect(validateLeagueMembersScreenshotImage({
      mimeType: "image/png",
      base64: tinyPng.toString("base64"),
    }, { maxImageBytes: 1024 })).toEqual({
      mimeType: "image/png",
      bytes: tinyPng,
    });

    expect(() => validateLeagueMembersScreenshotImage({
      mimeType: "image/jpeg",
      base64: tinyPng.toString("base64"),
    }, { maxImageBytes: 1024 })).toThrow(new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      "The file contents do not match the selected image type.",
    ));
    expect(() => validateLeagueMembersScreenshotImage({
      mimeType: "image/png",
      base64: Buffer.alloc(20).toString("base64"),
    }, { maxImageBytes: 10 })).toThrow("Screenshots must be 10 bytes or smaller.");
  });

  it("sends a non-stored original-detail image request with a strict schema", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

      expect(requestBody).toMatchObject({
        model: "gpt-5.6-terra",
        store: false,
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "league_members_screenshot",
            strict: true,
          },
        },
      });
      const serialized = JSON.stringify(requestBody);
      expect(serialized).toContain('"detail":"original"');
      expect(serialized).toContain("Do not extract email addresses or membership status");
      expect(serialized).not.toContain('"email"');
      expect(serialized).not.toContain('"status"');

      return new Response(JSON.stringify({
        status: "completed",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              leagueName: "The Sunday Games",
              externalLeagueId: "214674",
              teams: [{
                draftOrderPosition: 1,
                abbreviation: "SETH",
                teamDisplayName: "Washington Sentinels",
                managerDisplayNames: ["Seth Fortier"],
                confidence: "high",
                issues: [],
              }],
            }),
          }],
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const analyzer = createOpenAiLeagueMembersScreenshotAnalyzer({
      apiKey: "test-key",
      fetchImpl,
      timeoutMs: 5_000,
      maxImageBytes: 1024,
    });

    await expect(analyzer.analyze({
      mimeType: "image/png",
      base64: tinyPng.toString("base64"),
    })).resolves.toEqual({
      leagueName: "The Sunday Games",
      externalLeagueId: "214674",
      teams: [{
        draftOrderPosition: 1,
        abbreviation: "SETH",
        teamDisplayName: "Washington Sentinels",
        managerDisplayNames: ["Seth Fortier"],
        confidence: "high",
        issues: [],
        confirmed: false,
      }],
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer test-key" }),
    }));
  });

  it("maps provider failures to a safe application error without exposing response content", async () => {
    const analyzer = createOpenAiLeagueMembersScreenshotAnalyzer({
      apiKey: "test-key",
      fetchImpl: vi.fn(async () => new Response("sensitive provider body", { status: 503 })),
      maxImageBytes: 1024,
    });

    await expect(analyzer.analyze({
      mimeType: "image/png",
      base64: tinyPng.toString("base64"),
    })).rejects.toEqual(new LeagueMembersScreenshotAnalyzerError(
      "provider_unavailable",
      "Screenshot analysis is temporarily unavailable. Try again in a moment.",
    ));
  });

  it("caps concurrent provider work instead of queueing unbounded image requests", async () => {
    let release: (() => void) | undefined;
    const fetchImpl = vi.fn(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return new Response(JSON.stringify({
        status: "completed",
        output: [{ type: "message", content: [{
          type: "output_text",
          text: JSON.stringify({ leagueName: null, externalLeagueId: null, teams: [] }),
        }] }],
      }), { status: 200 });
    });
    const analyzer = createOpenAiLeagueMembersScreenshotAnalyzer({
      apiKey: "test-key",
      fetchImpl,
      maxImageBytes: 1024,
      maxConcurrentRequests: 1,
    });
    const first = analyzer.analyze({ mimeType: "image/png", base64: tinyPng.toString("base64") });

    await expect(analyzer.analyze({
      mimeType: "image/png",
      base64: tinyPng.toString("base64"),
    })).rejects.toEqual(new LeagueMembersScreenshotAnalyzerError(
      "provider_unavailable",
      "Screenshot analysis is busy. Try again in a moment.",
    ));
    release?.();
    await first;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
