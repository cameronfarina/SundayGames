import { dirname, resolve } from "node:path";
import ts from "typescript";
import type {
  FrontendQualityViolation,
  FrontendSourceModule,
} from "./frontendQualityTypes.js";

interface FeatureImportEdge {
  file: string;
  line: number;
  source: string;
  target: string;
}

const featureName = (file: string): string | undefined => {
  const parts = file.replaceAll("\\", "/").split("/");
  const featuresIndex = parts.lastIndexOf("features");
  return featuresIndex < 0 ? undefined : parts[featuresIndex + 1];
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

const featureImportEdges = (module: FrontendSourceModule): FeatureImportEdge[] => {
  const source = featureName(module.file);
  if (source === undefined) return [];
  const sourceFile = ts.createSourceFile(module.file, module.content, ts.ScriptTarget.Latest, true);
  const edges: FeatureImportEdge[] = [];
  const visit = (node: ts.Node): void => {
    const dependency = importPath(node);
    if (dependency?.startsWith(".") === true) {
      const target = featureName(resolve(dirname(module.file), dependency));
      if (target !== undefined && target !== source) {
        const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        edges.push({ file: module.relativeFile, line: location.line + 1, source, target });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return edges;
};

const canReach = (
  dependencies: Map<string, Set<string>>,
  current: string,
  target: string,
  visited: Set<string>,
): boolean => {
  if (current === target) return true;
  if (visited.has(current)) return false;
  visited.add(current);
  const next = dependencies.get(current);
  return next !== undefined
    && [...next].some(feature => canReach(dependencies, feature, target, visited));
};

export const featureCycleViolations = (
  modules: FrontendSourceModule[],
): FrontendQualityViolation[] => {
  const edges = modules.flatMap(featureImportEdges);
  const dependencies = new Map<string, Set<string>>();
  for (const edge of edges) {
    const targets = dependencies.get(edge.source);
    if (targets === undefined) dependencies.set(edge.source, new Set([edge.target]));
    else targets.add(edge.target);
  }
  return edges.filter(edge => canReach(
    dependencies,
    edge.target,
    edge.source,
    new Set<string>(),
  )).map(edge => ({
    file: edge.file,
    line: edge.line,
    rule: "layer-import",
    detail: "Cross-feature imports cannot create dependency cycles.",
  }));
};
