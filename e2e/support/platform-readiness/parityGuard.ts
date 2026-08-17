import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const maximumLines = 250;
const expectedAssertionCount = 217;
const expectedAssertionHash = "d44e665737a864f559c5a39ae6cda3b1c3743ef8db2853ec6901808ea37011d7";
const expectedBehaviorNames: readonly string[] = [
  "local platform supports fixture signup, setup, invitation, realtime draft, and final-export gating",
  "Draft Lab supports baseline browsing and league-aware planning",
  "Draft Lab saves simulation runs and resumes an auction mock",
  "primary navigation stays in the current document and the account menu dismisses accessibly",
  "a stale failed mock request cannot overwrite a newer mock session",
  "completed auction mock shows every team's priced Week 1 roster",
  "auction mock only enables legal nominations for the final open slot",
  "commissioner history and keepers persist into an unopened live room",
  "commissioner league switching discards stale setup fetch responses",
  "deployed platform supports authenticated workspaces without mutating the real draft",
];

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

const filesBelow = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });

const sourceFiles = (): string[] => [
  join(repoRoot, "e2e/platform-readiness.spec.ts"),
  ...filesBelow(join(repoRoot, "e2e/platform-readiness")),
  ...filesBelow(join(repoRoot, "e2e/support/platform-readiness")),
];

const rootedAtExpect = (expression: ts.Expression): boolean => {
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;
    if (ts.isIdentifier(callee) && callee.text === "expect") return true;
    if (
      ts.isPropertyAccessExpression(callee)
      && ts.isIdentifier(callee.expression)
      && callee.expression.text === "expect"
    ) return true;
    return rootedAtExpect(callee);
  }
  if (ts.isPropertyAccessExpression(expression)) return rootedAtExpect(expression.expression);
  return false;
};

export const assertPlatformReadinessParity = (): void => {
  const behaviorNames: string[] = [];
  const assertions: string[] = [];
  const violations: string[] = [];
  const printer = ts.createPrinter({ removeComments: true });

  for (const path of sourceFiles()) {
    const sourceText = readFileSync(path, "utf8");
    const lineCount = sourceText.length === 0
      ? 0
      : sourceText.split(/\r?\n/u).length - (sourceText.endsWith("\n") ? 1 : 0);
    if (lineCount > maximumLines) violations.push(`${path}: ${lineCount} lines`);
    if (/@ts-(?:expect-error|ignore|nocheck)/u.test(sourceText)) {
      violations.push(`${path}: TypeScript suppression`);
    }

    const sourceFile = ts.createSourceFile(
      path,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isAsExpression(node)
        || ts.isTypeAssertionExpression(node)
        || ts.isNonNullExpression(node)
        || node.kind === ts.SyntaxKind.AnyKeyword
      ) {
        violations.push(`${path}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }

      if (ts.isCallExpression(node)) {
        const firstArgument = node.arguments[0];
        if (
          ts.isIdentifier(node.expression)
          && node.expression.text === "test"
          && firstArgument !== undefined
          && ts.isStringLiteral(firstArgument)
        ) behaviorNames.push(firstArgument.text);

        if (rootedAtExpect(node)) {
          const parent = node.parent;
          if (!(ts.isPropertyAccessExpression(parent) && parent.expression === node)) {
            assertions.push(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const sortedBehaviors = [...behaviorNames].sort();
  const expectedBehaviors = [...expectedBehaviorNames].sort();
  if (JSON.stringify(sortedBehaviors) !== JSON.stringify(expectedBehaviors)) {
    violations.push(`behavior names: ${JSON.stringify(behaviorNames)}`);
  }

  assertions.sort();
  const assertionHash = createHash("sha256").update(JSON.stringify(assertions)).digest("hex");
  if (assertions.length !== expectedAssertionCount || assertionHash !== expectedAssertionHash) {
    violations.push(`assertions: ${assertions.length} / ${assertionHash}`);
  }

  if (violations.length > 0) {
    throw new Error(`Platform readiness architecture/parity guard failed:\n${violations.join("\n")}`);
  }
};
