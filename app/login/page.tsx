"use client";
/**
 * Client login / registration page (Model A identity).
 *
 * Spanish-only UX, consistent with the store design: card pattern, radius
 * ladder, brand CTA. After a successful sign-in the customer returns to the
 * storefront; their `auth.uid` is then the identity for purchases
 * (createTransferSale reads the Bearer token) and notification settings
 * (notificationTokens/{uid}).
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clientGoogleLogin,
  clientLogin,
  clientRegister,
} from "../components/clientAuth";

type Mode = "login" | "register";

export default function ClientLoginPage() {
  // useSearchParams needs a Suspense boundary for the static prerender of
  // /login (Next build failed exporting the route without it).
  return (
    <Suspense fallback={null}>
      <ClientLoginForm />
    </Suspense>
  );
}

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await clientLogin(email.trim(), password);
      } else {
        await clientRegister(name, email.trim(), password);
      }
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      setError(FIREBASE_ERRORS[code] ?? "No pudimos completar la operación. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full items-center px-4">
      <div className="w-full max-w-md my-8 bg-surface rounded-card border border-ink-100 shadow-card p-6">
        <h1 className="text-center text-xl font-bold text-ink-900">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-center text-sm text-ink-500">
          {mode === "login"
            ? "Accede para ver tus compras y recibir notificaciones."
            : "Crea tu cuenta para guardar tus compras y notificaciones."}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-sm bg-danger-100 border border-danger-500 text-danger-700 text-sm p-3"
          >
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-700 mb-1">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500 focus:outline-none"
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500 focus:outline-none"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500 focus:outline-none"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy
              ? mode === "login"
                ? "Ingresando…"
                : "Creando cuenta…"
              : mode === "login"
              ? "Iniciar sesión"
              : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-ink-300" />
          <span className="text-xs uppercase tracking-wide text-ink-500">o</span>
          <span className="h-px flex-1 bg-ink-300" />
        </div>

        {/* Google sign-in (2026-11-05): provider enabled by Daniel in the
            Firebase console. Light "outline" style so it reads as an
            alternative to the primary CTA, not a second primary. */}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await clientGoogleLogin();
              router.push(next);
              router.refresh();
            } catch (err: unknown) {
              const code =
                typeof err === "object" && err && "code" in err
                  ? String((err as { code: unknown }).code)
                  : "";
              setError(
                FIREBASE_ERRORS[code] ??
                  "No pudimos completar el acceso con Google. Inténtalo de nuevo."
              );
              setBusy(false);
            }
          }}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-ink-300 bg-surface py-2 font-semibold text-ink-900 transition-colors hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.72 12 .72 7.4.72 3.44 3.37 1.54 7.14l3.66 2.84C6.1 7.09 8.8 5.04 12 5.04Z"
            />
            <path
              fill="#4285F4"
              d="M23.28 12.26c0-.8-.07-1.56-.2-2.3H12v4.51h6.34c-.27 1.46-1.1 2.7-2.34 3.53l3.62 2.81c2.12-1.96 3.66-4.85 3.66-8.55Z"
            />
            <path
              fill="#FBBC05"
              d="M5.2 14.02A6.9 6.9 0 0 1 4.82 12c0-.7.12-1.38.34-2.02L1.5 7.14A11.25 11.25 0 0 0 .72 12c0 1.74.42 3.39 1.15 4.86l3.33-2.84Z"
            />
            <path
              fill="#34A853"
              d="M12 23.28c3.04 0 5.6-1 7.46-2.73l-3.62-2.81c-1 .68-2.3 1.08-3.84 1.08-3.2 0-5.9-2.05-6.8-4.94L1.87 16.9c1.9 3.77 5.86 6.38 10.13 6.38Z"
            />
          </svg>
          Continuar con Google
        </button>

        <p className="mt-4 text-center text-sm text-ink-500">
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}

/** Firebase auth error codes → customer-facing Spanish messages. */
const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-email": "El correo electrónico no es válido.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "La contraseña no es correcta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "auth/weak-password": "La contraseña es muy corta (mínimo 6 caracteres).",
  "auth/too-many-requests":
    "Demasiados intentos. Espera un momento y vuelve a intentar.",
  "auth/popup-closed-by-user":
    "Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.",
  "auth/popup-blocked":
    "Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.",
  "auth/account-exists-with-different-credential":
    "Ese correo ya tiene una cuenta con contraseña. Inicia sesión con tu correo y contraseña.",
  "auth/operation-not-allowed":
    "El acceso con Google no está habilitado en este momento.",
};