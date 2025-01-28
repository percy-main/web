// @ts-check

/** @type {import("prettier").Config} */
export default {
  overrides: [{ files: ["*.astro"], options: { parser: "astro" } }],
  plugins: [
    "prettier-plugin-astro",
    "prettier-plugin-organize-imports",
    "prettier-plugin-tailwindcss",
  ],
};
