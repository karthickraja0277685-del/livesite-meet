import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // Uses the Onest Google Font loaded in src/app/layout.tsx
        sans: ["var(--font-onest)", "system-ui", "sans-serif"]
      },
      colors: {
        obsidian: "#050508"
      }
    }
  },
  plugins: []
};

export default config;