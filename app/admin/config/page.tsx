"use client";
import { db } from "@/app/firebaseconfig";
import withAuth from "@/app/components/WithAuth";
import ApiErrorState, { type ErrorKind } from "@/app/components/ApiErrorState";
import {
  CHECKOUT_SUCCESS_FIELDS,
  mergeCheckoutConfig,
  type CheckoutSuccessConfig,
} from "@/app/config/checkoutSuccessConfig";
import {
  STOREFRONT_FORM_FIELDS,
  mergeStorefrontConfig,
  parsePhones,
  toStorefrontForm,
  type StorefrontForm,
} from "@/app/config/storefrontConfig";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";

/**
 * Runtime editor for storefront copy + contact/payment details.
 *
 * Writes two documents the public pages subscribe to live, so a save changes
 * what buyers see without a rebuild or redeploy:
 *   - appConfig/checkoutSuccess  -> thank-you copy after a transfer purchase
 *   - appConfig/storefront       -> contact email/phones, bank account details
 *
 * Editing rules enforced here:
 *  - Load must succeed before the form is usable. Editing blind would let a
 *    save overwrite fields the operator never saw.
 *  - Required fields (contact email, at least one phone, bank account) are
 *    dropped from the write when empty, so the page falls back to its built-in
 *    default rather than showing a blank phone number or account to a customer.
 *  - Optional fields (bank name/holder/note) save an explicit empty string,
 *    which means "hide this line".
 */
const ConfigPage = () => {
  const [copyForm, setCopyForm] = useState<CheckoutSuccessConfig | null>(null);
  const [storeForm, setStoreForm] = useState<StorefrontForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const copyRef = doc(db, "appConfig", "checkoutSuccess");
  const storeRef = doc(db, "appConfig", "storefront");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [copySnap, storeSnap] = await Promise.all([
        getDoc(copyRef),
        getDoc(storeRef),
      ]);
      setCopyForm(mergeCheckoutConfig(copySnap.exists() ? copySnap.data() : null));
      setStoreForm(
        toStorefrontForm(mergeStorefrontConfig(storeSnap.exists() ? storeSnap.data() : null))
      );
    } catch (err) {
      console.error("Could not load config:", err);
      setCopyForm(null);
      setStoreForm(null);
      setError({
        kind: "forbidden",
        message: err instanceof Error ? err.message : "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateCopy = (key: keyof CheckoutSuccessConfig, value: string) => {
    setCopyForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
    setSaveError(null);
  };

  const updateStore = (key: keyof StorefrontForm, value: string) => {
    setStoreForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
    setSaveError(null);
  };

  const save = async () => {
    if (!copyForm || !storeForm) return;
    setSaving(true);
    setSaveError(null);
    setWarnings([]);
    try {
      const notices: string[] = [];

      // ---- checkout copy: only persist non-empty values ----
      const copyPayload: Record<string, unknown> = {};
      for (const { key, label } of CHECKOUT_SUCCESS_FIELDS) {
        const raw = copyForm[key];
        if (typeof raw === "string" && raw.trim() !== "") {
          copyPayload[key] = raw;
        } else {
          notices.push(`"${label}" quedó vacío: se usará el texto predeterminado.`);
        }
      }
      copyPayload.updatedAt = serverTimestamp();
      copyPayload.updatedBy = "admin";

      // ---- storefront: required fields fall back, optional ones may be blank ----
      const phones = parsePhones(storeForm.contactPhonesText);
      const storePayload: Record<string, unknown> = {
        contactEmail: storeForm.contactEmail.trim(),
        contactPhones: phones,
        contactIntro: storeForm.contactIntro.trim(),
        bankAccount: storeForm.bankAccount.trim(),
        // Explicitly stored (possibly ""): empty means hide the line.
        bankName: storeForm.bankName.trim(),
        bankHolder: storeForm.bankHolder.trim(),
        bankNote: storeForm.bankNote.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      };
      if (phones.length === 0) {
        notices.push(
          `"Teléfonos de contacto" quedó vacío: se usará el teléfono predeterminado.`
        );
      }
      if (storeForm.contactEmail.trim() === "") {
        notices.push(`"Correo de contacto" quedó vacío: se usará el correo predeterminado.`);
      }
      if (storeForm.bankAccount.trim() === "") {
        notices.push(
          `"Cuenta bancaria" quedó vacía: se usará la cuenta predeterminada. El cliente necesita este dato para pagar.`
        );
      }

      await Promise.all([
        setDoc(copyRef, copyPayload, { merge: true }),
        setDoc(storeRef, storePayload, { merge: true }),
      ]);

      if (notices.length > 0) setWarnings(notices);
      setSavedAt(new Date().toLocaleTimeString("es-MX"));
    } catch (err) {
      console.error("Could not save config:", err);
      setSaveError(
        err instanceof Error ? err.message : "No se pudo guardar la configuración."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex flex-col w-full items-center px-4 mt-6'>
      <h1 className='my-1 text-xl font-bold'>Textos y datos de la tienda</h1>
      <p className='text-sm text-gray-600 text-center mb-4 max-w-xl'>
        Estos textos y datos aparecen en la página de agradecimiento, en la de
        contacto y en el pago por transferencia. Los cambios se publican al
        guardar, sin necesidad de recompilar ni volver a desplegar.
      </p>

      {loading ? (
        <div className='flex justify-center items-center w-full h-64'>
          <FadeLoader color='var(--color-brand-700)' />
        </div>
      ) : error ? (
        <ApiErrorState
          kind={error.kind}
          message={error.message}
          onRetry={load}
          entityLabel='textos y datos'
        />
      ) : copyForm && storeForm ? (
        <div className='w-full max-w-2xl flex flex-col gap-6'>
          {/* -------- contact + payment details -------- */}
          <section className='flex flex-col gap-4'>
            <h2 className='text-lg font-semibold border-b border-gray-300 pb-1'>
              Contacto y pago
            </h2>
            {STOREFRONT_FORM_FIELDS.map(({ key, label, multiline, hint }) => (
              <label key={key} className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-gray-800'>{label}</span>
                {hint && <span className='text-xs text-gray-500'>{hint}</span>}
                {multiline ? (
                  <textarea
                    value={storeForm[key]}
                    onChange={(e) => updateStore(key, e.target.value)}
                    rows={key === "contactPhonesText" ? 2 : 3}
                    className='w-full p-2 border border-gray-300 rounded-card text-sm text-black'
                  />
                ) : (
                  <input
                    value={storeForm[key]}
                    onChange={(e) => updateStore(key, e.target.value)}
                    className='w-full p-2 border border-gray-300 rounded-card text-sm text-black'
                  />
                )}
              </label>
            ))}
          </section>

          {/* -------- checkout thank-you copy -------- */}
          <section className='flex flex-col gap-4'>
            <h2 className='text-lg font-semibold border-b border-gray-300 pb-1'>
              Textos de confirmación de compra
            </h2>
            {CHECKOUT_SUCCESS_FIELDS.map(({ key, label, multiline }) => (
              <label key={key} className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-gray-800'>{label}</span>
                {multiline ? (
                  <textarea
                    value={copyForm[key]}
                    onChange={(e) => updateCopy(key, e.target.value)}
                    rows={3}
                    className='w-full p-2 border border-gray-300 rounded-card text-sm text-black'
                  />
                ) : (
                  <input
                    value={copyForm[key]}
                    onChange={(e) => updateCopy(key, e.target.value)}
                    className='w-full p-2 border border-gray-300 rounded-card text-sm text-black'
                  />
                )}
              </label>
            ))}
          </section>

          {warnings.length > 0 && (
            <ul className='text-sm text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-card p-3 list-disc pl-6'>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {saveError && (
            <p className='text-sm text-red-700 bg-red-50 border border-red-300 rounded-card p-3'>
              Error al guardar: {saveError}
            </p>
          )}

          {savedAt && !saveError && (
            <p className='text-sm text-green-800 bg-green-50 border border-green-300 rounded-card p-3'>
              Guardado a las {savedAt}. Ya está visible para los compradores.
            </p>
          )}

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={save}
              disabled={saving}
              className={`p-2 rounded-card text-white ${
                saving ? "bg-gray-400 cursor-not-allowed" : ""
              }`}
              style={saving ? undefined : { backgroundColor: "var(--color-brand-700)" }}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type='button'
              onClick={load}
              disabled={saving}
              className='p-2 rounded-card bg-gray-200 text-gray-800'
            >
              Descartar y recargar
            </button>
          </div>
        </div>
      ) : null}

      <Link href='../' className='p-2 bg-blue-500 text-white border-white border-2 mt-6 mb-1'>
        Volver al inicio
      </Link>
    </div>
  );
};

export default withAuth(ConfigPage);
