import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

const printer = ts.createPrinter({ removeComments: true });

const printNode = (node: ts.Node, sourceFile: ts.SourceFile): string =>
  printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);

const collectTestSignature = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
): { signature: string; runtimeCount: number } | undefined => {
  const name = call.arguments[0];
  if (name === undefined || !ts.isStringLiteral(name)) return undefined;

  if (ts.isIdentifier(call.expression) && call.expression.text === "it") {
    return { signature: name.text, runtimeCount: 1 };
  }

  const eachCall = call.expression;
  if (
    !ts.isCallExpression(eachCall) ||
    !ts.isPropertyAccessExpression(eachCall.expression) ||
    !ts.isIdentifier(eachCall.expression.expression) ||
    eachCall.expression.expression.text !== "it" ||
    eachCall.expression.name.text !== "each"
  ) return undefined;

  const rows = eachCall.arguments[0];
  if (rows === undefined || !ts.isArrayLiteralExpression(rows)) {
    throw new Error("Live draft room parameterized tests must use literal row arrays.");
  }

  return {
    signature: `${name.text}\n${printNode(rows, sourceFile)}`,
    runtimeCount: rows.elements.length,
  };
};

const collectAssertion = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
): string | undefined => {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "expect") return undefined;

  let assertion: ts.Expression = call;
  while (assertion.parent !== undefined) {
    const parent = assertion.parent;
    if (
      (ts.isPropertyAccessExpression(parent) || ts.isCallExpression(parent)) &&
      parent.expression === assertion
    ) {
      assertion = parent;
      continue;
    }
    break;
  }

  return printNode(assertion, sourceFile);
};

export const collectSourceParity = (suiteUrl: URL, suiteFiles: readonly string[]) => {
  const behaviors: string[] = [];
  const assertions: string[] = [];
  let runtimeBehaviorCount = 0;

  for (const suiteFile of suiteFiles) {
    const source = readFileSync(new URL(suiteFile, suiteUrl), "utf8");
    const sourceFile = ts.createSourceFile(suiteFile, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const test = collectTestSignature(node, sourceFile);
        if (test !== undefined) {
          behaviors.push(test.signature);
          runtimeBehaviorCount += test.runtimeCount;
        }
        const assertion = collectAssertion(node, sourceFile);
        if (assertion !== undefined) assertions.push(assertion);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const digest = (values: readonly string[]): string =>
    createHash("sha256").update(JSON.stringify(values)).digest("hex");

  return {
    registrationCount: behaviors.length,
    runtimeBehaviorCount,
    assertionCount: assertions.length,
    behaviorDigest: digest(behaviors),
    assertionDigest: digest(assertions),
  };
};

export const collectEntrySuiteFiles = (entryUrl: URL): string[] => {
  const source = readFileSync(entryUrl, "utf8");
  const sourceFile = ts.createSourceFile(entryUrl.pathname, source, ts.ScriptTarget.Latest, true);

  return sourceFile.statements.flatMap(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    const match = /\/([^/]+\.suite)\.js$/.exec(statement.moduleSpecifier.text);
    return match?.[1] === undefined ? [] : [`${match[1]}.ts`];
  });
};
