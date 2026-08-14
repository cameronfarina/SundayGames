import { createHash } from "node:crypto";

export const sha256For = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");
