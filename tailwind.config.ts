import type { Config } from "tailwindcss";

// Brand tokens added 2026-10-20 (UI rework).
//
// Before: stock Tailwind, colours chosen ad hoc per file. The raffle pages used
// blue-500/teal-400 gradients in globals.css and raw hex elsewhere, with no
// type scale or spacing rhythm, so no two screens matched.
//
// These tokens are derived from what the app already uses most, so existing
// screens do not visually lurch: the blue→teal pair is the primary action
// colour, and the neutral ramp matches the existing grey text/borders.

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary: the existing CTA gradient, as flat steps.
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          300: "#93c5fd",
          500: "#3b82f6", // blue-500, current button start
          600: "#2563eb", // current hover start
          700: "#1d4ed8",
        },
        accent: {
          400: "#2dd4bf", // teal-400, current button end
          500: "#14b8a6", // current hover end
          600: "#0d9488",
        },
        ink: {
          900: "#0f172a",
          700: "#334155",
          500: "#64748b",
          300: "#cbd5e1",
          100: "#f1f5f9",
        },
        // Semantic states used by the sale/ticket flows.
        success: { 50: "#ecfdf5", 500: "#10b981", 700: "#047857" },
        warning: { 50: "#fffbeb", 500: "#f59e0b", 700: "#b45309" },
        danger: { 50: "#fef2f2", 500: "#ef4444", 700: "#b91c1c" },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Single source for the CTA gradient; replaces the duplicated
        // linear-gradient in globals.css.
        //
        // TEXT ON THESE GRADIENTS MUST BE `text-ink-900` (#0f172a), NOT white.
        // Ratified 2026-10-21 (A1a): the gradient runs to accent-400, where
        // white is 1.86:1 (fails AA at any size). ink-900 is 9.59:1 at the teal
        // end and 8.0+:1 at the blue end. This applies only to text on a
        // gradient surface; white stays correct on solid brand/danger/success
        // fills (e.g. `bg-danger-700 text-white` passes at 5.48:1).
        "brand-cta": "linear-gradient(135deg, #3b82f6, #2dd4bf)",
        "brand-cta-hover": "linear-gradient(135deg, #2563eb, #14b8a6)",
      },
      // Radius ladder (ratified 2026-10-21, A3b). Four semantic steps, not
      // seven near-identical ones:
      //   rounded-sm  0.5rem  — inputs, buttons, badges, chips, small controls
      //   rounded-card 1rem   — cards, panels, modals, dropdowns
      //   rounded-md  1.5rem  — feature containers / hero blocks (one step up)
      //   rounded-pill 9999px — primary CTAs only (main buy/participate buttons)
      // `.random-ticket-button` keeps its literal 1.5rem (= rounded-md) shape;
      // the storefront pill CTAs keep rounded-pill. Do not add ad-hoc radii.
      borderRadius: {
        sm: "0.5rem",
        card: "1rem",
        md: "1.5rem",
        pill: "9999px",
      },
      boxShadow: {
        // One elevation scale instead of per-file shadows.
        card: "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.06)",
        "card-hover":
          "0 2px 4px rgba(15,23,42,0.08), 0 12px 24px rgba(15,23,42,0.10)",
        cta: "0 6px 12px rgba(0,0,0,0.15)",
      },
      fontFamily: {
        // F14: font-sans must match the loaded font. Inter is passed as the
        // CSS variable in app/layout.tsx; the system stack stays as fallback.
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
