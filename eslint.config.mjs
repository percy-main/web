import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

/** @type {import("eslint").ESLint.Options[]} */
export default [
  ...tseslint.config(eslint.configs.recommended, tseslint.configs.recommended),
  // add more generic rule sets here, such as:
  // js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      "no-undef": "off",
    },
  },
];
