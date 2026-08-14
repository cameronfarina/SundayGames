import type { Buffer } from "node:buffer";
import { extractionPrompt, outputSchema } from "./schema.js";

export const requestBodyFor = (
  model: string,
  mimeType: string,
  bytes: Buffer,
) => ({
  model,
  store: false,
  reasoning: { effort: "low" },
  max_output_tokens: 4_000,
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: extractionPrompt },
      {
        type: "input_image",
        image_url: `data:${mimeType};base64,${bytes.toString("base64")}`,
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
});
