import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8E8",
        "cream-2": "#FFFCF4",
        "butter": "#FDE3A7",
        "butter-2": "#EED8AA",
        ink: "#3B2A1E",
        muted: "#907764",
        primary: "#D98841",
        "primary-dark": "#B25E1E",
      },
      boxShadow: {
        card: "0 8px 30px rgba(120, 80, 30, 0.08)",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
