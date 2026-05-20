import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sakura: {
          bg: "#0d0d1a",
          "bg-light": "#13132b",
          "bg-card": "rgba(255,255,255,0.05)",
          pink: "#ff6eb4",
          purple: "#c084fc",
          text: "#e2e2f0",
          muted: "#8888aa",
          border: "rgba(255,110,180,0.15)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(255,110,180,0.4)",
        "glow-sm": "0 0 10px rgba(255,110,180,0.2)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "sakura-gradient": "linear-gradient(135deg, #ff6eb4, #c084fc)",
        "sakura-radial":
          "radial-gradient(ellipse at 60% 0%, rgba(255,110,180,0.12) 0%, transparent 60%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease",
        "slide-up": "slideUp 0.3s ease",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
