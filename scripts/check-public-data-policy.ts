import { auditPublicData } from "./publicDataPolicy.js";

const violations = await auditPublicData(process.cwd());

if (violations.length > 0) {
  console.error(violations.map(violation => `- ${violation}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Public data policy passed.");
}
