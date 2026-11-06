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
import {
  GENERAL_DEFAULTS,
  mergeGeneralConfig,
  type GeneralConfig,
} from "@/app/config/general";
import { navigationItems, type PageKey } from "@/app/config/navigation";
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
  const [general, setGeneral] = useState<GeneralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const copyRef = doc(db, "appConfig", "checkoutSuccess");
  const storeRef = doc(db, "appConfig", "storefront");
  const generalRef = doc(db, "appConfig", "general");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [copySnap, storeSnap, generalSnap] = await Promise.all([
        getDoc(copyRef),
        getDoc(storeRef),
        getDoc(generalRef),
      ]);
      setCopyForm(mergeCheckoutConfig(copySnap.exists() ? copySnap.data() : null));
      setStoreForm(
        toStorefrontForm(mergeStorefrontConfig(storeSnap.exists() ? storeSnap.data() : null))
      );
      setGeneral(
        mergeGeneralConfig(generalSnap.exists() ? generalSnap.data() : null)
      );
    } catch (err) {
      console.error("Could not load config:", err);
      setCopyForm(null);
      setStoreForm(null);
      setGeneral(null);
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

  const updateGeneralHome = (value: string) => {
    setGeneral((prev) => (prev ? { ...prev, defaultHome: value } : prev));
    setSavedAt(null);
    setSaveError(null);
  };

  const togglePage = (key: PageKey, visible: boolean) => {
    setGeneral((prev) =>
      prev
        ? { ...prev, visiblePages: { ...prev.visiblePages, [key]: visible } }
        : prev
    );
    setSavedAt(null);
    setSaveError(null);
  };

  const save = async () => {
    if (!copyForm || !storeForm || !general) return;
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
        instagram: storeForm.instagram.trim(),
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

      // ---- navigation: default home + page visibility ----
      let defaultHome = general.defaultHome;
      if (!/^\/[A-Za-z0-9/_-]*$/.test(defaultHome.trim()) || defaultHome.trim() === "/") {
        defaultHome = GENERAL_DEFAULTS.defaultHome;
        notices.push(
          `La página de inicio no era válida: se usará "${GENERAL_DEFAULTS.defaultHome}".`
        );
      }
      const generalPayload: Record<string, unknown> = {
        defaultHome,
        visiblePages: general.visiblePages,
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      };

      await Promise.all([
        setDoc(copyRef, copyPayload, { merge: true }),
        setDoc(storeRef, storePayload, { merge: true }),
        setDoc(generalRef, generalPayload, { merge: true }),
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
      <p className='text-sm text-ink-500 text-center mb-4 max-w-xl'>
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
      ) : copyForm && storeForm && general ? (
        <div className='w-full max-w-2xl flex flex-col gap-6'>
          {/* -------- contact + payment details -------- */}
          <section className='flex flex-col gap-4'>
            <h2 className='text-lg font-semibold border-b border-ink-300 pb-1'>
              Contacto y pago
            </h2>
            {STOREFRONT_FORM_FIELDS.map(({ key, label, multiline, hint }) => (
              <label key={key} className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-ink-700'>{label}</span>
                {hint && <span className='text-xs text-ink-500'>{hint}</span>}
                {multiline ? (
                  <textarea
                    value={storeForm[key]}
                    onChange={(e) => updateStore(key, e.target.value)}
                    rows={key === "contactPhonesText" ? 2 : 3}
                    className='w-full p-2 border border-ink-300 rounded-card text-sm text-ink-900'
                  />
                ) : (
                  <input
                    value={storeForm[key]}
                    onChange={(e) => updateStore(key, e.target.value)}
                    className='w-full p-2 border border-ink-300 rounded-card text-sm text-ink-900'
                  />
                )}
              </label>
            ))}
          </section>

          {/* -------- navigation: default home + visible pages -------- */}
          <section className='flex flex-col gap-4'>
            <h2 className='text-lg font-semibold border-b border-ink-300 pb-1'>
              Navegación e inicio
            </h2>
            <label className='flex flex-col gap-1'>
              <span className='text-sm font-medium text-ink-700'>
                Página de inicio (a donde lleva la raíz `/`)
              </span>
              <span className='text-xs text-ink-500'>
                Tras iniciar sesión o entrar a la raíz, los usuarios aterrizan
                aquí.
              </span>
              <select
                value={general.defaultHome}
                onChange={(e) => updateGeneralHome(e.target.value)}
                className='w-full p-2 border border-ink-300 rounded-card text-sm text-ink-900 bg-surface'
              >
                {navigationItems.map((item) => (
                  <option key={item.key} value={item.href}>
                    {item.label} ({item.href})
                  </option>
                ))}
              </select>
            </label>

            <p className='text-sm text-ink-500'>
              Páginas visibles en la navegación. Ocultar una página solo quita
              su enlace; la URL directa sigue funcionando.
            </p>
            <div className='flex flex-col gap-2'>
              {navigationItems.map((item) => (
                <label
                  key={item.key}
                  className='flex items-center gap-3 rounded-card border border-ink-200 p-2'
                >
                  <input
                    type='checkbox'
                    checked={general.visiblePages[item.key] ?? true}
                    onChange={(e) => togglePage(item.key, e.target.checked)}
                    className='h-4 w-4 accent-brand-600'
                  />
                  <span className='text-sm font-medium text-ink-900'>
                    {item.label}
                  </span>
                  <span className='ml-auto text-xs text-ink-500'>
                    {item.href}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* -------- checkout thank-you copy -------- */}
          <section className='flex flex-col gap-4'>
            <h2 className='text-lg font-semibold border-b border-ink-300 pb-1'>
              Textos de confirmación de compra
            </h2>
            {CHECKOUT_SUCCESS_FIELDS.map(({ key, label, multiline }) => (
              <label key={key} className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-ink-700'>{label}</span>
                {multiline ? (
                  <textarea
                    value={copyForm[key]}
                    onChange={(e) => updateCopy(key, e.target.value)}
                    rows={3}
                    className='w-full p-2 border border-ink-300 rounded-card text-sm text-ink-900'
                  />
                ) : (
                  <input
                    value={copyForm[key]}
                    onChange={(e) => updateCopy(key, e.target.value)}
                    className='w-full p-2 border border-ink-300 rounded-card text-sm text-ink-900'
                  />
                )}
              </label>
            ))}
          </section>

          {warnings.length > 0 && (
            <ul className='text-sm text-warning-700 bg-warning-50 border border-warning-500 rounded-card p-3 list-disc pl-6'>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {saveError && (
            <p className='text-sm text-danger-700 bg-danger-50 border border-danger-500 rounded-card p-3'>
              Error al guardar: {saveError}
            </p>
          )}

          {savedAt && !saveError && (
            <p className='text-sm text-success-700 bg-success-50 border border-success-500 rounded-card p-3'>
              Guardado a las {savedAt}. Ya está visible para los compradores.
            </p>
          )}

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={save}
              disabled={saving}
              className={`p-2 rounded-card text-white ${
                saving ? "bg-ink-300 cursor-not-allowed" : ""
              }`}
              style={saving ? undefined : { backgroundColor: "var(--color-brand-700)" }}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type='button'
              onClick={load}
              disabled={saving}
              className='p-2 rounded-card bg-ink-100 text-ink-700'
            >
              Descartar y recargar
            </button>
          </div>
        </div>
      ) : null}

      <Link href='../' className='p-2 bg-brand-600 text-on-brand border-white border-2 mt-6 mb-1'>
        Volver al inicio
      </Link>
    </div>
  );
};

export default withAuth(ConfigPage);
