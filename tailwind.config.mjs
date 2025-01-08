import { theme } from "./src/lib/theme";
import typography from "@tailwindcss/typography";
import forms from "@tailwindcss/forms";
import flowbite from "flowbite/plugin";

let font_base = Number(theme.fonts.font_size.base.replace("px", ""));
let font_scale = Number(theme.fonts.font_size.scale);
let h6 = font_base / font_base;
let h5 = h6 * font_scale;
let h4 = h5 * font_scale;
let h3 = h4 * font_scale;
let h2 = h3 * font_scale;
let h1 = h2 * font_scale;

/** @type {import('tailwindcss').Config} */
export const content = [
  "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  "./node_modules/flowbite/**/*.js",
];
export const darkMode = "class";
export const mode = "jit";
export const theme = {
  screens: {
    sm: "540px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
  container: {
    center: true,
    padding: "2rem",
  },
  extend: {
    colors: {
      text: theme.colors.default.text_color.default,
      light: theme.colors.default.text_color.light,
      dark: theme.colors.default.text_color.dark,
      primary: theme.colors.default.theme_color.primary,
      secondary: theme.colors.default.theme_color.secondary,
      body: theme.colors.default.theme_color.body,
      border: theme.colors.default.theme_color.border,
      "theme-light": theme.colors.default.theme_color.theme_light,
      "theme-dark": theme.colors.default.theme_color.theme_dark,
      creamy: theme.colors.default.theme_color.creamy,
    },
    fontSize: {
      base: font_base + "px",
      h1: h1 + "rem",
      "h1-sm": h1 * 0.8 + "rem",
      h2: h2 + "rem",
      "h2-sm": h2 * 0.8 + "rem",
      h3: h3 + "rem",
      "h3-sm": h3 * 0.8 + "rem",
      h4: h4 + "rem",
      h5: h5 + "rem",
      h6: h6 + "rem",
    },
    fontFamily: {
      primary: ["var(--font-primary)", theme.fonts.font_family.primary_type],
      secondary: [
        "var(--font-secondary)",
        theme.fonts.font_family.secondary_type,
      ],
    },
  },
};
export const plugins = [typography, forms, flowbite];
