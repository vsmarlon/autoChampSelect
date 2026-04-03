import js from "@eslint/js";

export default [
  js.configs.recommended,
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
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/"],
  },
];
