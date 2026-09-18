module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "off",
    "react-refresh/only-export-components": "off",
  },
  overrides: [
    {
      files: ["src/pages/requests/RequestDetails.tsx"],
      rules: { "react-hooks/exhaustive-deps": "warn" },
    },
  ],
  ignorePatterns: ["dist", "dev-dist", "node_modules"],
};
