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
import { clientLogin, clientRegister } from "../components/clientAuth";

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
      <div className="w-full max-w-md my-8 bg-white rounded-card border border-ink-100 shadow-card p-6">
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
                className="w-full p-2 rounded-sm bg-white text-ink-900 border border-ink-300 focus:border-brand-500"
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
              className="w-full p-2 rounded-sm bg-white text-ink-900 border border-ink-300 focus:border-brand-500"
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
              className="w-full p-2 rounded-sm bg-white text-ink-900 border border-ink-300 focus:border-brand-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-600 text-white rounded-sm hover:bg-brand-700 font-semibold transition-colors py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
};