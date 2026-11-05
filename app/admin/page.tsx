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
 */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebaseconfig";
import { signInWithEmailAndPassword } from "firebase/auth";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin/dashboard"); // Redirect to the admin dashboard
    } catch (err) {
      setError(
        "Correo electrónico o contraseña no válidos. Por favor, inténtalo de nuevo."
      );
      console.error(err);
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
            className="w-full rounded-sm bg-brand-600 px-4 py-2 font-semibold text-on-brand transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
