import eslint from "@eslint/js";
import query from "@tanstack/eslint-plugin-query";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import accessibility from "eslint-plugin-jsx-a11y";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import testingLibrary from "eslint-plugin-testing-library";
import typescript from "typescript-eslint";

const sourceFiles = ["web/src/**/*.{ts,tsx}"];
const testFiles = ["web/src/**/*.test.{ts,tsx}"];
const browserSimulationBundleFiles = [
  "web/src/features/practice/api/browserSimulationExecution.test.ts",
  "web/src/features/practice/api/browserSimulationExecution.ts",
  "web/src/features/practice/api/browserSimulationRunner.test.ts",
  "web/src/features/practice/workers/seasonSimulation.worker.test.ts",
  "web/src/features/practice/workers/seasonSimulation.worker.ts",
];
const configFiles = ["web/*.config.ts"];
const architectureToolFiles = [
  "scripts/frontend-architecture-guard*.ts",
  "web/scripts/**/*.ts",
];
const restrictedTypeSyntax = [
  "error",
  { selector: "TSAsExpression", message: "Type assertions are not allowed." },
  { selector: "TSTypeAssertion", message: "Type assertions are not allowed." },
  { selector: "TSNonNullExpression", message: "Non-null assertions are not allowed." },
];
const nativeSelectSyntax = [
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: "Use the shared Select primitive instead of a native select.",
  },
  {
    selector: "JSXSelfClosingElement[name.name='select']",
    message: "Use the shared Select primitive instead of a native select.",
  },
];
const featureMainSyntax = [
  {
    selector: "JSXOpeningElement[name.name='main']",
    message: "Application layouts own the main landmark.",
  },
];
const directFetchSyntax = [
  {
    selector: "CallExpression[callee.name='fetch']",
    message: "Call fetch only from a typed API module.",
  },
  {
    selector: "CallExpression[callee.object.name=/^(globalThis|window)$/][callee.property.name='fetch']",
    message: "Call fetch only from a typed API module.",
  },
];
const bannedTypeScriptComments = ["error", {
  "ts-check": true,
  "ts-expect-error": true,
  "ts-ignore": true,
  "ts-nocheck": true,
}];

export default typescript.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
  },
  {
    files: sourceFiles,
    extends: [
      eslint.configs.recommended,
      ...typescript.configs.strictTypeChecked,
      ...typescript.configs.stylisticTypeChecked,
      accessibility.flatConfigs.strict,
      hooks.configs.flat.recommended,
      query.configs["flat/recommended-strict"],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-refresh": refresh },
    rules: {
      "@typescript-eslint/ban-ts-comment": bannedTypeScriptComments,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "no-restricted-syntax": [
        ...restrictedTypeSyntax,
        ...nativeSelectSyntax,
        ...directFetchSyntax,
      ],
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
  {
    files: browserSimulationBundleFiles,
    extends: [typescript.configs.disableTypeChecked],
  },
  {
    files: ["web/src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        ...restrictedTypeSyntax,
        ...nativeSelectSyntax,
        ...featureMainSyntax,
        ...directFetchSyntax,
      ],
    },
  },
  {
    files: ["web/src/features/*/api/**/*.{ts,tsx}", "web/src/shared/api/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": [...restrictedTypeSyntax, ...nativeSelectSyntax] },
  },
  {
    files: ["web/src/shared/ui/Select/Select.tsx"],
    rules: { "no-restricted-syntax": [...restrictedTypeSyntax, ...directFetchSyntax] },
  },
  {
    files: testFiles,
    extends: [testingLibrary.configs["flat/react"], vitest.configs.recommended],
  },
  {
    files: configFiles,
    extends: [eslint.configs.recommended, ...typescript.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": bannedTypeScriptComments,
      "no-restricted-syntax": restrictedTypeSyntax,
    },
  },
  {
    files: architectureToolFiles,
    extends: [eslint.configs.recommended, ...typescript.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": bannedTypeScriptComments,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "no-restricted-syntax": restrictedTypeSyntax,
    },
  },
);
