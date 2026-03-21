/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        "network-ink": "#0f172a",
        "network-muted": "#64748b",
        "network-border": "#d7dfeb",
        "network-panel": "#ffffff",
        "network-bg": "#f7f9fc",
      },
      boxShadow: {
        "network-panel": "0 10px 24px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: {
        "4xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
