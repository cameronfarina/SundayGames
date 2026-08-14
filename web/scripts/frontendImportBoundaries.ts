import { dirname, extname, resolve } from "node:path";
import ts from "typescript";
import type { FrontendQualityViolation } from "./frontendQualityTypes.js";

interface ModuleLocation {
  feature: string | undefined;
  layer: string | undefined;
}

const moduleLocation = (file: string): ModuleLocation => {
  const parts = file.replaceAll("\\", "/").split("/");
  const webIndex = parts.lastIndexOf("web");
  if (webIndex < 0 || parts[webIndex + 1] !== "src") {
    return { feature: undefined, layer: undefined };
  }
  const layer = parts[webIndex + 2];
  return {
    layer,
    feature: layer === "features" ? parts[webIndex + 3] : undefined,
  };
};

const importPath = (node: ts.Node): string | undefined => {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }
  if (ts.isExportDeclaration(node)
    && node.moduleSpecifier !== undefined
    && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text;
  }
  if (!ts.isCallExpression(node)
    || node.expression.kind !== ts.SyntaxKind.ImportKeyword
    || node.arguments.length !== 1) return undefined;
  const argument = node.arguments[0];
  return argument !== undefined && ts.isStringLiteral(argument) ? argument.text : undefined;
};

const importViolation = (
  source: ModuleLocation,
  target: ModuleLocation,
): string | undefined => {
  if (source.layer === "shared" && ["app", "features"].includes(target.layer ?? "")) {
    return "Shared modules cannot import application or feature modules.";
  }
  if (source.layer !== "features") return undefined;
  if (target.layer === "app") return "Feature modules cannot import application modules.";
  return undefined;
};

export const importBoundaryViolations = (
  file: string,
  relativeFile: string,
  content: string,
): FrontendQualityViolation[] => {
  const source = moduleLocation(file);
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: FrontendQualityViolation[] = [];
  const visit = (node: ts.Node): void => {
    const dependency = importPath(node);
    if (dependency?.startsWith(".") === true) {
      const target = moduleLocation(resolve(dirname(file), dependency));
      const detail = importViolation(source, target);
      if (detail !== undefined) {
        const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push({ file: relativeFile, line: location.line + 1, rule: "layer-import", detail });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};
