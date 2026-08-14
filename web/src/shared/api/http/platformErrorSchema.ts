import { z } from "zod";

export const platformErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
