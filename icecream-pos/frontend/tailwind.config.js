/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3faf8",
          100: "#d7f2e9",
          500: "#1ca57d",
          600: "#17876a",
          700: "#146c56",
        },
        accent: {
          500: "#f97316",
          600: "#ea580c",
        },
        slate: {
          950: "#09121b",
        },
      },
      boxShadow: {
        card: "0 14px 40px rgba(14, 26, 39, 0.10)",
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
    },
  },
  plugins: [],
};
