"use client";
import { db } from "@/app/firebaseconfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

/**
 * Storefront contact + payment details, editable from /admin/config.
 *
 * WHY THIS EXISTS
 * The phone, email and bank account were hardcoded in three separate files:
 *   - app/contact/page.tsx
 *   - app/checkout/success/page.tsx
 *   - app/checkout/transfer/page.tsx  (account 4152314135006792)
 * Changing a phone number meant editing three files and rebuilding. Because the
 * same value lived in three places, it could also drift: fix one, forget the
 * others. One document, one source of truth.
 *
 * Document: `appConfig` / `storefront`
 *
 * DEFAULTS ARE THE CURRENT LIVE STRINGS. A missing document, a denied read or
 * an unreachable Firestore must never blank a contact line or a bank account:
 * customers need that number to pay.
 */

export interface StorefrontConfig {
  /** Primary contact email. Empty string = hide the line. */
  contactEmail: string;
  /** Primary contact phone numbers. Empty array = hide the line. */
  contactPhones: string[];
  /** Intro line shown on /contact and after checkout. */
  contactIntro: string;
  /** Bank account number / CLABE shown on the transfer page. */
  bankAccount: string;
  /** Bank name, shown as a label next to the account when set. */
  bankName: string;
  /** Account holder, shown when set. */
  bankHolder: string;
  /** Extra transfer instructions; empty = hide the block. */
  bankNote: string;
}

export const STOREFRONT_DEFAULTS: StorefrontConfig = {
  contactEmail: "ealejandramtzq04@gmail.com",
  contactPhones: ["6391316226"],
  contactIntro:
    "Si tienes cualquier duda o necesitas más información, no dudes en ponerte en contacto con nosotros",
  bankAccount: "4152314135006792",
  bankName: "",
  bankHolder: "",
  bankNote: "",
};

/** Shape of the admin editor form. Phones/lists are edited as text. */
export interface StorefrontForm {
  contactEmail: string;
  contactPhonesText: string;
  contactIntro: string;
  bankAccount: string;
  bankName: string;
  bankHolder: string;
  bankNote: string;
}

export const STOREFRONT_FORM_FIELDS: {
  key: keyof StorefrontForm;
  label: string;
  multiline: boolean;
  hint?: string;
}[] = [
  { key: "contactEmail", label: "Correo de contacto", multiline: false },
  {
    key: "contactPhonesText",
    label: "Teléfonos de contacto",
    multiline: true,
    hint: "Un número por línea. Se muestran en /contact y en la confirmación de compra.",
  },
  { key: "contactIntro", label: "Texto de contacto", multiline: true },
  {
    key: "bankAccount",
    label: "Cuenta bancaria (CLABE / número de cuenta)",
    multiline: false,
    hint: "Este número aparece en la página de pago por transferencia con botón de copiar.",
  },
  { key: "bankName", label: "Banco (opcional)", multiline: false },
  { key: "bankHolder", label: "Titular de la cuenta (opcional)", multiline: false },
  { key: "bankNote", label: "Nota adicional de transferencia (opcional)", multiline: true },
];

/** Split a textarea into phone entries: one per line, commas allowed too. */
export function parsePhones(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Non-empty stored values win; empty falls back to the live default. */
export function mergeStorefrontConfig(
  stored: Partial<Record<keyof StorefrontConfig, unknown>> | null
): StorefrontConfig {
  const out: StorefrontConfig = {
    ...STOREFRONT_DEFAULTS,
    contactPhones: [...STOREFRONT_DEFAULTS.contactPhones],
  };
  if (!stored) return out;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;

  const email = str(stored.contactEmail);
  if (email) out.contactEmail = email;

  const intro = str(stored.contactIntro);
  if (intro) out.contactIntro = intro;

  const acct = str(stored.bankAccount);
  if (acct) out.bankAccount = acct;

  // Optional fields: an explicitly empty string means "hide", so we keep "".
  if (typeof stored.bankName === "string") out.bankName = stored.bankName.trim();
  if (typeof stored.bankHolder === "string") out.bankHolder = stored.bankHolder.trim();
  if (typeof stored.bankNote === "string") out.bankNote = stored.bankNote.trim();

  const phones = stored.contactPhones;
  if (Array.isArray(phones)) {
    const cleaned = phones
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (cleaned.length > 0) out.contactPhones = cleaned;
  }

  return out;
}

export function toStorefrontForm(config: StorefrontConfig): StorefrontForm {
  return {
    contactEmail: config.contactEmail,
    contactPhonesText: config.contactPhones.join("\n"),
    contactIntro: config.contactIntro,
    bankAccount: config.bankAccount,
    bankName: config.bankName,
    bankHolder: config.bankHolder,
    bankNote: config.bankNote,
  };
}

/** Live storefront details. Starts on defaults so first paint is always right. */
export function useStorefrontConfig(): StorefrontConfig {
  const [config, setConfig] = useState<StorefrontConfig>(() => ({
    ...STOREFRONT_DEFAULTS,
    contactPhones: [...STOREFRONT_DEFAULTS.contactPhones],
  }));

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const ref = doc(db, "appConfig", "storefront");
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          setConfig(
            snap.exists() ? mergeStorefrontConfig(snap.data()) : mergeStorefrontConfig(null)
          );
        },
        (err) => {
          console.error("storefront config unavailable, using defaults:", err);
        }
      );
    } catch (err) {
      console.error("Could not subscribe to storefront config:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return config;
}
