import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

let font_base = 16;
let font_scale = 1.24571;
let h6 = font_base / font_base;
let h5 = h6 * font_scale;
let h4 = h5 * font_scale;
let h3 = h4 * font_scale;
let h2 = h3 * font_scale;
let h1 = h2 * font_scale;

/** @type {import('tailwindcss').Config} */
export const content = [
  "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
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
      text: "#444",
      light: "#ceced0",
      dark: "#222",
      primary: "#1B3D2F",
      "primary-light": "#2D4A3E",
      cta: "#FE6019",
      "cta-dark": "#E5540F",
      secondary: "#FEE140",
      body: "#FAF8F3",
      border: "#EBEBEB",
      "theme-light": "#E5E5E5",
      "theme-dark": "#1a202c",
      creamy: "#FAF8F3",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      destructive: {
        DEFAULT: "hsl(var(--destructive))",
        foreground: "hsl(var(--destructive-foreground))",
      },
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      },
      accent: {
        DEFAULT: "hsl(var(--accent))",
        foreground: "hsl(var(--accent-foreground))",
      },
      popover: {
        DEFAULT: "hsl(var(--popover))",
        foreground: "hsl(var(--popover-foreground))",
      },
      card: {
        DEFAULT: "hsl(var(--card))",
        foreground: "hsl(var(--card-foreground))",
      },
    },
    fontSize: {
      base: String(font_base) + "px",
      h1: String(h1) + "rem",
      "h1-sm": String(h1 * 0.8) + "rem",
      h2: String(h2) + "rem",
      "h2-sm": String(h2 * 0.8) + "rem",
      h3: String(h3) + "rem",
      "h3-sm": String(h3 * 0.8) + "rem",
      h4: String(h4) + "rem",
      h5: String(h5) + "rem",
      h6: String(h6) + "rem",
    },
    fontFamily: {
      primary: ["var(--font-primary)", "sans-serif"],
      secondary: ["var(--font-secondary)", "serif"],
    },

    keyframes: {
      "caret-blink": {
        "0%,70%,100%": { opacity: "1" },
        "20%,50%": { opacity: "0" },
      },
    },
    animation: {
      "caret-blink": "caret-blink 1.25s ease-out infinite",
    },
  },
};
export const plugins = [typography, forms];
