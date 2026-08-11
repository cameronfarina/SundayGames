import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  generateProductionProvisioningDocument,
  parseProductionOwnerAccountMappingDocument,
} from "../src/platform/generateProductionProvisioning.js";

const [inputArgument, outputArgument, ...extraArguments] = process.argv.slice(2);
if (inputArgument === undefined || extraArguments.length > 0) {
  throw new Error(
    "Usage: tsx scripts/generate-production-provisioning.ts <owner-accounts.json> [production.json]",
  );
}

const inputPath = resolve(inputArgument);
const input = parseProductionOwnerAccountMappingDocument(await readFile(inputPath, "utf8"));
const output = await generateProductionProvisioningDocument(input);

if (outputArgument === undefined) {
  process.stdout.write(output);
} else {
  await writeFile(resolve(outputArgument), output, { encoding: "utf8", flag: "wx" });
}
