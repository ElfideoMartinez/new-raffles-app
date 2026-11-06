"use client";
import { FadeLoader } from "react-spinners";

/**
 * The app's single loader (2026-11-06).
 *
 * Daniel's feedback: every screen showed a different spinner. This is the one
 * loader every surface uses — a FadeLoader tinted with the brand token by
 * default (pass `color` only for deliberate variants, e.g. ink on a light
 * form). Consistent everywhere; all layout wrappers stay in the caller.
 */
const Spinner = ({ color = "var(--color-brand-700)" }: { color?: string }) => {
  return <FadeLoader color={color} />;
};

export default Spinner;
