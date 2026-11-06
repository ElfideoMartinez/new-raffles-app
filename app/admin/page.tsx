"use client";
/**
 * Admin login (2026-11-05 rework).
 *
 * Before: a full-screen `bg-ink-100` wrapper with a white card floated on
 * top of the app shell — it read as a stray square block under the header and
 * stayed light in dark mode (raw Tailwind colours, no tokens). Now it uses the
 * shared token system: card on `bg-surface` with the standard border/shadow,
 * ink text ramp, brand CTA with `text-on-brand` (ratified A1a), so it themes
 * correctly in both modes. The wrapper no longer forces min-h-screen — the
 * card centers inside the normal page flow.
 *
 * Authorization (2026-11-06): any Firebase sign-in used to redirect straight
 * to the dashboard, regardless of whether the account was actually an admin.
 * The backend already rejects non-admin calls (assertAdmin), but the admin UI
 * flashed up first — the "still let me through to the admin" bug. Now, after a
 * successful email/password or Google sign-in, we check the `admin` custom
 * claim on the ID token; accounts without it are signed out and shown an error
 * instead of reaching the dashboard. An account with the claim needs no second
 * login anywhere — the storefront nav exposes admin once isAdmin is true.
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebaseconfig";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

/** True only when the signed-in account carries the `admin === true` claim. */
async function isAdminAccount(user: User): Promise<boolean> {
  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims?.admin === true;
  } catch {
    return false;
  }
}

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  /** Validate the claim, then send an admin on to the dashboard. */
  const grantAdminAccess = async (user: User) => {
    if (await isAdminAccount(user)) {
      router.push("/admin/dashboard");
      return;
    }
    // Non-admin signed in: revoke the session so the account doesn't linger
    // as an unauthenticated-ish admin, and explain why it was rejected.
    await signOut(auth).catch(() => {});
    setError(
      "Esta cuenta no tiene permisos de administrador. Inicia sesión con la cuenta de administrador."
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      if (!user) throw new Error("No session");
      await grantAdminAccess(user);
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      setError(
        code === "auth/operation-not-allowed"
          ? "El inicio de sesión con Google no está habilitado."
          : "Correo electrónico o contraseña no válidos. Por favor, inténtalo de nuevo."
      );
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await grantAdminAccess(credential.user);
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
        console.error(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-12 flex w-full justify-center">
      <div className="w-full max-w-md space-y-6 rounded-card border border-ink-100 bg-surface p-6 shadow-card">
        <h2 className="text-center text-xl font-bold text-ink-900">
          Iniciar sesión
        </h2>
        {error && (
          <p
            role="alert"
            className="rounded-sm border border-danger-500 bg-danger-50 p-3 text-center text-sm text-danger-700"
          >
            {error}
          </p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="mb-1 block text-sm font-medium text-ink-700"
            >
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-sm border border-ink-300 bg-surface p-2 text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-sm font-medium text-ink-700"
            >
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-sm border border-ink-300 bg-surface p-2 text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-brand-600 px-4 py-2 font-semibold text-on-brand transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-100" />
          <span className="text-xs uppercase tracking-wide text-ink-500">o</span>
          <span className="h-px flex-1 bg-ink-100" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-ink-200 bg-surface px-4 py-2 font-semibold text-ink-900 transition-colors hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60"
        >
          <GoogleIcon />
          Continuar con Google
        </button>
      </div>
    </div>
  );
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.61l3.99 3.1c.95-2.84 3.6-4.95 6.73-4.95Z"
      />
    </svg>
  );
}

export default LoginPage;
