import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        requestAnimationFrame: "readonly",
        MutationObserver: "readonly",
        CustomEvent: "readonly",
        Element: "readonly",
        CSSStyleDeclaration: "readonly",
        HTMLElement: "readonly",
        Promise: "readonly",
        Set: "readonly",
        Number: "readonly",
        String: "readonly",
        Array: "readonly",
        Object: "readonly",
        Boolean: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.name='useEffect']",
          "message": "Do not use useEffect. Prefer useSyncExternalStore or stable component prop-binding logic."
        },
        {
          "selector": "CallExpression[callee.name='useRef']",
          "message": "Direct dom manipulation via useRef is forbidden. Use pure React callbacks/props."
        }
      ],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  }
);
