"use client";
/**
 * Notificaciones — client notification settings (2026-10-25).
 *
 * Identity roster, per the Firestore rules (firestore.rules:90-93): the
 * device's FCM token registers under `notificationTokens/{uid}` where uid is
 * the signed-in client's auth.uid (the rules require
 * `tokenId == request.auth.uid`). Settings persisted on that same doc:
 *   - `label`    — human name for the device ("Mi celular", "Laptop de casa")
 *   - `enabled`  — enable/disable notifications for this device
 *   - `token`    — the current FCM token (re-registered on every visit; the
 *                  old WithAuth short-circuit that skipped re-registration is
 *                  fixed in the registration helper)
 *
 * "Enviar prueba" calls the user-gated `sendTestPush` Cloud Function: the
 * server verifies the caller's ID token and sends FCM ONLY to that caller's
 * own registered token. It is never public.
 *
 * Notification permission is requested explicitly by a button press (browser
 * best practice; iOS/Android web need a user gesture).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FadeLoader } from "react-spinners";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebaseconfig";
import { getMessagingToken } from "../../firebaseMessaging";
import { userApiFetch, useClientAuth } from "../../components/clientAuth";

interface TokenSettings {
  label: string;
  enabled: boolean;
  token: string | null;
}

const MyNotificationsPage = () => {
  const { user, loading: authLoading } = useClientAuth();
  const [settings, setSettings] = useState<TokenSettings>({
    label: "",
    enabled: true,
    token: null,
  });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const ref = doc(db, "notificationTokens", user.uid);
        // Firestore reads can hang on flaky networks; fail to an error state
        // after 8s instead of an endless loader.
        const snap = await Promise.race<
          Awaited<ReturnType<typeof getDoc>>
        >([
          getDoc(ref),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000)
          ),
        ]);
        if (!cancelled) {
          setSettings({
            label: typeof snap.get("label") === "string" ? snap.get("label") : "",
            enabled: snap.get("enabled") !== false,
            token: typeof snap.get("token") === "string" ? snap.get("token") : null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError("No pudimos cargar tu configuración. Revisa tu conexión.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requestPermissionAndRegister = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("Tu navegador no soporta notificaciones.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      setError("Permiso de notificaciones denegado. Actívalo en tu navegador para continuar.");
      return;
    }
    try {
      // Always ask FCM for the (possibly refreshed) token — no localStorage
      // short-circuit. The token is re-registered under the signed-in uid.
      const token = await getMessagingToken();
      if (!token) {
        setError("No pudimos obtener el token del dispositivo. Reintenta en un momento.");
        return;
      }
      setSettings((s) => ({ ...s, token }));
      localStorage.setItem("notificationToken", token);
      await setDoc(
        doc(db, "notificationTokens", user.uid),
        {
          userId: user.uid,
          token,
          label: settings.label || "",
          enabled: settings.enabled,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setNotice("Dispositivo registrado para notificaciones.");
    } catch (err) {
      setError("No pudimos registrar el dispositivo. Inténtalo de nuevo.");
    }
  }, [user, settings.label, settings.enabled]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await setDoc(
        doc(db, "notificationTokens", user.uid),
        {
          userId: user.uid,
          label: settings.label || "",
          enabled: settings.enabled,
          ...(settings.token ? { token: settings.token } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setNotice("Configuración guardada.");
    } catch {
      setError("No pudimos guardar tu configuración. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!user) return;
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await userApiFetch("sendTestPush", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(data?.message || "No pudimos enviar la notificación de prueba.");
      } else {
        setNotice("Notificación de prueba enviada a este dispositivo.");
      }
    } catch {
      setError("No pudimos enviar la notificación de prueba.");
    } finally {
      setTesting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="relative mx-auto mt-4 w-full max-w-3xl p-4">
        <h1 className="text-center mb-3 text-xl font-bold text-ink-900">Notificaciones</h1>
        <div className="flex justify-center h-40 items-center">
          <FadeLoader color="var(--color-brand-700)" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col w-full items-center px-4">
        <div className="w-full max-w-3xl my-6 bg-white rounded-card border border-ink-100 shadow-card p-6 text-center">
          <h1 className="text-xl font-bold text-ink-900">Notificaciones</h1>
          <p className="mt-2 text-sm text-ink-700">
            Inicia sesión para administrar las notificaciones de este dispositivo.
          </p>
          <Link
            href="/login?next=/user/notificaciones"
            className="mt-4 inline-block bg-brand-600 text-white rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full items-center px-4">
      <div className="w-full max-w-3xl my-6 space-y-6">
        <h1 className="text-center text-xl font-bold text-ink-900">Notificaciones</h1>

        {error && (
          <p
            role="alert"
            className="rounded-sm bg-danger-100 border border-danger-500 text-danger-700 text-sm p-3"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-sm bg-success-50 border border-success-500 text-success-700 text-sm p-3"
          >
            {notice}
          </p>
        )}

        {/* --- Device registration --- */}
        <section className="bg-white rounded-card border border-ink-100 shadow-card p-4">
          <h2 className="text-lg font-bold text-ink-900">Este dispositivo</h2>
          <p className="mt-1 text-sm text-ink-500">
            Registro del token FCM bajo tu cuenta ({user.email ?? user.uid}) —
            las reglas de Firestore solo permiten escribir el token con tu
            propio uid.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-1 rounded-pill text-xs ${
                settings.token
                  ? "bg-success-50 text-success-700"
                  : "bg-warning-50 text-ink-900"
              }`}
            >
              {settings.token ? "✓ Dispositivo registrado" : "Dispositivo sin registrar"}
            </span>
            <span className="px-2 py-1 rounded-pill text-xs bg-ink-100 text-ink-700">
              Permiso: {permission === "granted" ? "concedido" : permission === "denied" ? "denegado" : permission === "unsupported" ? "no soportado" : "pendiente"}
            </span>
          </div>
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              type="button"
              onClick={requestPermissionAndRegister}
              className="mt-3 bg-brand-600 text-white rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2"
            >
              Activar notificaciones en este dispositivo
            </button>
          )}
        </section>

        {/* --- Settings --- */}
        <section className="bg-white rounded-card border border-ink-100 shadow-card p-4">
          <h2 className="text-lg font-bold text-ink-900">Configuración</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="deviceLabel" className="block text-sm font-medium text-ink-700 mb-1">
                Etiqueta del dispositivo
              </label>
              <input
                id="deviceLabel"
                type="text"
                value={settings.label}
                onChange={(e) => setSettings((s) => ({ ...s, label: e.target.value }))}
                maxLength={40}
                className="w-full p-2 rounded-sm bg-white text-ink-900 border border-ink-300 focus:border-brand-500"
                placeholder="Mi celular"
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-ink-700">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                className="h-4 w-4"
              />
              Recibir notificaciones (confirmaciones de compra y resultados)
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-brand-600 text-white rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={testing || !settings.token}
                title={settings.token ? undefined : "Registra el dispositivo primero"}
                className="bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Enviando…" : "Enviar prueba"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MyNotificationsPage;