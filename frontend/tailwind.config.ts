import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F7F3E8",
        "nb-yellow": "#FFE45C",
        "nb-blue": "#4563EB",
        "nb-coral": "#FF7058",
        "nb-green": "#2DD4BF",
        "nb-purple": "#A78BFA",
        "nb-pink": "#F472B6",
        "nb-dark": "#171717",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        "nb-sm": "2px 2px 0px #171717",
        "nb": "3px 3px 0px #171717",
        "nb-lg": "5px 5px 0px #171717",
        "nb-xl": "8px 8px 0px #171717",
      },
      borderWidth: {
        "3": "3px",
      },
    },
  },
  plugins: [],
};

export default config;
