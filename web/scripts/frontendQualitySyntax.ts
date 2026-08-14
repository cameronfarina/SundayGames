import { extname } from "node:path";
import ts from "typescript";
import type {
  FrontendQualityRule,
  FrontendQualityViolation,
} from "./frontendQualityTypes.js";

export type { FrontendQualityViolation } from "./frontendQualityTypes.js";

const createSourceFile = (file: string, content: string): ts.SourceFile => ts.createSourceFile(
  file,
  content,
  ts.ScriptTarget.Latest,
  true,
  extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

const typeEscapeDetail = (node: ts.Node): string | undefined => {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return "Type assertions and casts are not allowed.";
  }
  if (ts.isNonNullExpression(node)) return "Non-null assertions are not allowed.";
  if (node.kind === ts.SyntaxKind.AnyKeyword) return "The any type is not allowed.";
  return undefined;
};

const isDirectFetchCall = (node: ts.Node): boolean => {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === "fetch";
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const owner = node.expression.expression;
  return node.expression.name.text === "fetch"
    && ts.isIdentifier(owner)
    && ["globalThis", "window"].includes(owner.text);
};

const isJsxTag = (node: ts.Node, sourceFile: ts.SourceFile, tag: string): boolean => (
  (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
  && node.tagName.getText(sourceFile) === tag
);

const suppressionViolations = (
  file: string,
  content: string,
  sourceFile: ts.SourceFile,
): FrontendQualityViolation[] => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    sourceFile.languageVariant,
    content,
  );
  const violations: FrontendQualityViolation[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const isComment = token === ts.SyntaxKind.SingleLineCommentTrivia
      || token === ts.SyntaxKind.MultiLineCommentTrivia;
    if (!isComment) continue;
    const comment = scanner.getTokenText();
    const suppressesTypeScript = /@ts-(?:check|expect-error|ignore|nocheck)\b/u.test(comment);
    const suppressesEslint = /eslint-disable(?:-next-line|-line)?\b/u.test(comment);
    if (!suppressesTypeScript && !suppressesEslint) continue;
    const location = sourceFile.getLineAndCharacterOfPosition(scanner.getTokenStart());
    violations.push({
      file,
      line: location.line + 1,
      rule: "suppression",
      detail: "Compiler and linter suppression comments are not allowed.",
    });
  }
  return violations;
};

export const syntaxQualityViolations = (
  file: string,
  relativeFile: string,
  content: string,
): FrontendQualityViolation[] => {
  const sourceFile = createSourceFile(file, content);
  const violations = suppressionViolations(relativeFile, content, sourceFile);
  const pathParts = relativeFile.split(/[\\/]/u);
  const normalizedPath = relativeFile.replaceAll("\\", "/");
  const isApiModule = /^web\/src\/(?:features\/[^/]+|shared)\/api\//u.test(normalizedPath);
  const isFeatureModule = pathParts.includes("features");
  const isSharedSelect = normalizedPath === "web/src/shared/ui/Select/Select.tsx";
  const report = (node: ts.Node, rule: FrontendQualityRule, detail: string): void => {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({ file: relativeFile, line: location.line + 1, rule, detail });
  };
  const visit = (node: ts.Node): void => {
    const typeDetail = typeEscapeDetail(node);
    if (typeDetail !== undefined) report(node, "type-escape", typeDetail);
    if (!isApiModule && isDirectFetchCall(node)) {
      report(node, "direct-fetch", "Call fetch only from a typed API module.");
    }
    if (!isSharedSelect && isJsxTag(node, sourceFile, "select")) {
      report(node, "native-select", "Use the shared Select primitive instead of a native select.");
    }
    if (isFeatureModule && isJsxTag(node, sourceFile, "main")) {
      report(node, "feature-main", "Application layouts own the main landmark.");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations.sort((left, right) => left.line - right.line);
};
