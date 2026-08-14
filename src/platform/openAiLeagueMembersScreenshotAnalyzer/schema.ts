export const outputSchema = {
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
};

export const extractionPrompt = [
  "Extract the league and team identities from this fantasy-football League Members screenshot.",
  "Return only text that is visibly present. Never infer hidden or truncated text.",
  "For each numbered team row, capture its number, abbreviation, visible team name, and every manager name attached to that team.",
  "Continuation rows without a number belong to the previous numbered team.",
  "Preserve ellipses in truncated team names and explain the truncation in issues.",
  "Use medium or low confidence whenever any visible field is unclear.",
  "Extract the league name and numeric external league ID when they are plainly visible; otherwise use null.",
  "Do not extract email addresses or membership status. Do not include invitation URLs or invitation tokens.",
].join(" ");
