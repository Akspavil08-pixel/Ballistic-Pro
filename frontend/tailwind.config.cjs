/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        sand: "#F5F1E8",
        mint: "#8FE3C8",
        ember: "#FF8A5B",
        ocean: "#1E4E5E",
        slate: "#334155"
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.15)",
        glow: "0 0 0 1px rgba(143, 227, 200, 0.4), 0 10px 30px rgba(143, 227, 200, 0.25)"
      }
    }
  },
  plugins: []
};
