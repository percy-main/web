import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

/** @type {import("eslint").ESLint.Options[]} */
export default [
  ...tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
    {
      rules: {
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          { allowNumber: true },
        ],
      },
    },
    {
      files: ["**/*.astro"],
      extends: [tseslint.configs.disableTypeChecked],
    },
  ),
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      "no-undef": "off",
    },
  },
];
