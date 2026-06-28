import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1116", panel: "#161A22", panel2: "#1E232D", line: "#2A313D",
        gold: "#D9A441", goldl: "#EAC877", teal: "#0E7C66", muted: "#8A93A2",
      },
    },
  },
  plugins: [],
};
export default config;
