import { readdirSync } from "node:fs";
import { collectEntrySuiteFiles, collectSourceParity } from "./sourceParity.js";

const expectedSuiteFiles: readonly string[] = [
  "01-roomSetupCancellation.suite.ts",
  "02-roomCreation.suite.ts",
  "03-rosterSynchronization.suite.ts",
  "04-playerCatalogValidation.suite.ts",
  "05-mutationMetadata.suite.ts",
  "06-saleCommands.suite.ts",
  "07-saleIntegrity.suite.ts",
  "08-initialRosterValidation.suite.ts",
  "09-rosterCapacity.suite.ts",
  "10-slotAndBudgetValidation.suite.ts",
  "11-roomAccessAndPause.suite.ts",
  "12-saleCorrection.suite.ts",
  "13-roomCompletion.suite.ts",
  "14-saleAliases.suite.ts",
];

const expectedParity = {
  registrationCount: 40,
  runtimeBehaviorCount: 48,
  assertionCount: 120,
  behaviorDigest: "a3bec2aa273a57bcaf5b61f0e22b16a8658fb3a700173b8ec75b4eddfb7c3a09",
  assertionDigest: "7be4f1b17c329f8b53b072b22878acce0dab78d56955888b0ca03f9e41e6a2ea",
};

export const assertLiveDraftRoomSuiteParity = (entryUrl: string): void => {
  const entryFileUrl = new URL(entryUrl);
  const suiteUrl = new URL("./platformLiveDraftRooms/", entryFileUrl);
  const suiteFiles = readdirSync(suiteUrl)
    .filter(fileName => fileName.endsWith(".suite.ts"))
    .sort();
  const actual = collectSourceParity(suiteUrl, suiteFiles);
  const mismatches: string[] = [];
  const compare = (key: string, expected: string | number, received: string | number): void => {
    if (expected !== received) mismatches.push(`${key}: expected ${expected}, received ${received}`);
  };
  compare("registrationCount", expectedParity.registrationCount, actual.registrationCount);
  compare("runtimeBehaviorCount", expectedParity.runtimeBehaviorCount, actual.runtimeBehaviorCount);
  compare("assertionCount", expectedParity.assertionCount, actual.assertionCount);
  compare("behaviorDigest", expectedParity.behaviorDigest, actual.behaviorDigest);
  compare("assertionDigest", expectedParity.assertionDigest, actual.assertionDigest);

  if (JSON.stringify(suiteFiles) !== JSON.stringify(expectedSuiteFiles)) {
    mismatches.push("suite file list changed");
  }
  if (JSON.stringify(collectEntrySuiteFiles(entryFileUrl)) !== JSON.stringify(expectedSuiteFiles)) {
    mismatches.push("entry imports changed");
  }
  if (mismatches.length > 0) {
    throw new Error(`Live draft room test parity drifted:\n${mismatches.join("\n")}`);
  }
};
