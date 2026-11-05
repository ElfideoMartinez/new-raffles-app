import type { Config } from "tailwindcss";

// Brand tokens added 2026-10-20 (UI rework). Dark mode added 2026-11-05.
//
// Before: stock Tailwind, colours chosen ad hoc per file. The raffle pages used
// blue-500/teal-400 gradients in globals.css and raw hex elsewhere, with no
// type scale or spacing rhythm, so no two screens matched.
//
// These tokens are derived from what the app already uses most, so existing
// screens do not visually lurch: the blue→teal pair is the primary action
// colour, and the neutral ramp matches the existing grey text/borders.
//
// DARK MODE (2026-11-05, Daniel-approved "story palette"): every token is
// CSS-variable driven (`rgb(var(--x) / <alpha-value>)`), so a single `.dark`
// class on <html> — set by the theme toggle and the boot script in
// app/layout.tsx — re-derives the whole palette. Light keeps the original
// blue/teal; dark adopts the Instagram story colours ratified in
// HANDOFF-2026-11-04: brand→gold (#ffb347), accent→red (#ff4d3d), page
// surface = #12100e→#1c1512 (set on body in globals.css). The variable
// definitions live in app/globals.css — keep them in sync.
//
// `surface` replaces raw `bg-white` cards/panels (flips to #241f19 in dark;
// translucent `bg-white/N` overlays on the gradient header intentionally stay
// raw white). `on-brand` is THE text colour for surfaces filled with brand
// (gradient CTA or solid brand steps): light mode = ink-900 per ratified A1a
// (2026-10-21, white fails AA at the accent end); dark mode = #12100e on gold.

const config: Config = {
  darkMode: "class",
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
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
        },
        accent: {
          400: "rgb(var(--accent-400) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)",
        },
        ink: {
          900: "rgb(var(--ink-900) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
        },
        // Card/panel surface. Light: white; dark: warm near-black (#241f19).
        surface: "rgb(var(--surface) / <alpha-value>)",
        // Text colour on brand-filled surfaces (see A1a note above).
        "on-brand": "rgb(var(--on-brand) / <alpha-value>)",
        // Semantic states used by the sale/ticket flows.
        // danger-800 added 2026-10-25: the destructive Liquidar button hover
        // (`hover:bg-danger-800`) already referenced it in admin/bets and the
        // settlement review, but the ramp stopped at 700, so the hover was a
        // silent no-op. One step darker than danger-700 (#b91c1c).
        success: {
          50: "rgb(var(--success-50) / <alpha-value>)",
          500: "rgb(var(--success-500) / <alpha-value>)",
          700: "rgb(var(--success-700) / <alpha-value>)",
        },
        warning: {
          50: "rgb(var(--warning-50) / <alpha-value>)",
          500: "rgb(var(--warning-500) / <alpha-value>)",
          700: "rgb(var(--warning-700) / <alpha-value>)",
        },
        danger: {
          50: "rgb(var(--danger-50) / <alpha-value>)",
          500: "rgb(var(--danger-500) / <alpha-value>)",
          700: "rgb(var(--danger-700) / <alpha-value>)",
          800: "rgb(var(--danger-800) / <alpha-value>)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Single source for the CTA gradient; replaces the duplicated
        // linear-gradient in globals.css. Var-driven so dark mode re-derives
        // it (blue→teal light, gold→red dark) without a second token.
        //
        // TEXT ON THESE GRADIENTS MUST BE `text-on-brand`, NOT white.
        // Ratified 2026-10-21 (A1a): the gradient runs to accent-400, where
        // white is 1.86:1 (fails AA at any size). on-brand is 9.59:1 at the teal
        // end and 8.0+:1 at the blue end. This applies only to text on a
        // gradient surface; white stays correct on solid brand/danger/success
        // fills (e.g. `bg-danger-700 text-white` passes at 5.48:1).
        "brand-cta":
          "linear-gradient(135deg, rgb(var(--brand-500)), rgb(var(--accent-400)))",
        "brand-cta-hover":
          "linear-gradient(135deg, rgb(var(--brand-600)), rgb(var(--accent-500)))",
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
