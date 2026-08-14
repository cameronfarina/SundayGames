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
const configFiles = ["web/*.config.ts"];
const restrictedTypeSyntax = [
  "error",
  { selector: "TSAsExpression", message: "Type assertions are not allowed." },
  { selector: "TSTypeAssertion", message: "Type assertions are not allowed." },
  { selector: "TSNonNullExpression", message: "Non-null assertions are not allowed." },
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
      "no-restricted-syntax": restrictedTypeSyntax,
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
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
);
