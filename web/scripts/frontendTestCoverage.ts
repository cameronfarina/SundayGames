import { extname } from "node:path";
import type { FrontendQualityViolation } from "./frontendQualityTypes.js";
import { frontendTestExemptions } from "./frontendTestExemptions.js";

const normalized = (file: string): string => file.replaceAll("\\", "/");

const isProductionModule = (file: string): boolean => {
  const path = normalized(file);
  if (![".ts", ".tsx"].includes(extname(path))) return false;
  return !path.includes("/test/")
    && !/\.(?:test|spec)\.(?:ts|tsx)$/u.test(path)
    && !/\.(?:fixture|testServer|testSupport|testUtils)\.(?:ts|tsx)$/u.test(path);
};

const testCandidates = (file: string): string[] => {
  const extension = extname(file);
  const base = file.slice(0, -extension.length);
  return [`${base}.test.ts`, `${base}.test.tsx`];
};

export const missingColocatedTestViolations = (
  relativeFiles: string[],
): FrontendQualityViolation[] => {
  const files = relativeFiles.map(normalized);
  const fileSet = new Set(files);
  return files.filter(isProductionModule).flatMap(file => {
    const hasTest = testCandidates(file).some(candidate => fileSet.has(candidate));
    const isExempt = frontendTestExemptions.some(exemption => exemption.file === file);
    if (hasTest || isExempt) return [];
    return [{
      file,
      line: 1,
      rule: "missing-test",
      detail: "Add a colocated test or a documented architecture exemption.",
    }];
  });
};
