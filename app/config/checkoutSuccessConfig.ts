"use client";
import { db } from "@/app/firebaseconfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

/**
 * Storefront copy/config that Daniel changes from /admin/config.
 *
 * WHY THIS EXISTS
 * The thank-you copy and the contact details were hardcoded in
 * app/checkout/success/page.tsx. Changing "6391316226" or a sentence meant a
 * full rebuild + hosting redeploy, which on this project also redeploys the
 * SSR function. Runtime-editable copy belongs in Firestore.
 *
 * DEFAULTS ARE THE OLD HARDCODED STRINGS. If the doc is missing, Firestore is
 * unreachable, or a field is empty, the page renders exactly what it rendered
 * before this feature existed. Never degrade to blank text on a checkout page.
 *
 * Document: `appConfig` / `checkoutSuccess`
 */

export interface CheckoutSuccessConfig {
  thanksTitle: string;
  winnerWhere: string;
  winnerHow: string;
  /** Rendered when the cart had MORE THAN 5 tickets. */
  manyTicketsNote: string;
  /** Rendered when the cart had 5 or fewer tickets. */
  fewTicketsNote: string;
  homeButtonLabel: string;
}

export const CHECKOUT_SUCCESS_DEFAULTS: CheckoutSuccessConfig = {
  thanksTitle: "🎉 ¡Gracias por tu compra! 🎉",
  winnerWhere:
    "Para conocer al ganador, ingresa a la página de la rifa el día que finalice.",
  winnerHow:
    "Ahí mismo donde escogiste tus boletos se publicará el número ganador.\n¡Guarda ese enlace y mucha suerte! 🍀",
  manyTicketsNote:
    "Ojo 👀\nComo tu compra fue de mas de 5 boletos, tus boletos comprados seguiran apareciendo como disponibles,\nuna vez verificada tu transferencia te lo haremos saber por medio de whatsapp y tus boletos apareceran como vendidos.",
  fewTicketsNote:
    "✅ Hemos registrado tu compra por transferencia.\nUna vez que verifiquemos el pago, te avisaremos por WhatsApp.",
  homeButtonLabel: "Ir a inicio",
};

/** Which fields are part of the editable config (used by the admin editor). */
export const CHECKOUT_SUCCESS_FIELDS: {
  key: keyof CheckoutSuccessConfig;
  label: string;
  multiline: boolean;
}[] = [
  { key: "thanksTitle", label: "Título de agradecimiento", multiline: false },
  { key: "winnerWhere", label: "Dónde ver al ganador", multiline: true },
  { key: "winnerHow", label: "Cómo se publica el ganador", multiline: true },
  {
    key: "manyTicketsNote",
    label: "Nota: compra de más de 5 boletos",
    multiline: true,
  },
  {
    key: "fewTicketsNote",
    label: "Nota: compra de 5 boletos o menos",
    multiline: true,
  },
  { key: "homeButtonLabel", label: "Texto del botón de inicio", multiline: false },
];

/** Non-empty stored values win; empty/whitespace falls back to the default. */
export function mergeCheckoutConfig(
  stored: Partial<Record<keyof CheckoutSuccessConfig, unknown>> | null
): CheckoutSuccessConfig {
  const out = { ...CHECKOUT_SUCCESS_DEFAULTS };
  if (!stored) return out;
  for (const { key } of CHECKOUT_SUCCESS_FIELDS) {
    const raw = stored[key];
    if (typeof raw === "string" && raw.trim() !== "") {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Live checkout copy. Starts from defaults so the first paint is always
 * correct, then swaps in stored values once they arrive.
 */
export function useCheckoutSuccessConfig(): CheckoutSuccessConfig {
  const [config, setConfig] = useState<CheckoutSuccessConfig>(
    CHECKOUT_SUCCESS_DEFAULTS
  );

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const ref = doc(db, "appConfig", "checkoutSuccess");
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          setConfig(snap.exists() ? mergeCheckoutConfig(snap.data()) : { ...CHECKOUT_SUCCESS_DEFAULTS });
        },
        (err) => {
          // Keep defaults; a copy failure must never block or blank checkout.
          console.error("checkoutSuccess config unavailable, using defaults:", err);
        }
      );
    } catch (err) {
      console.error("Could not subscribe to checkoutSuccess config:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return config;
}
