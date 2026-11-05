"use client";
/**
 * Notificaciones — client notification settings (2026-10-25, item 19).
 *
 * Identity roster, per the Firestore rules (firestore.rules:90-93): the
 * device's FCM token registers under `notificationTokens/{uid}` where uid is
 * the signed-in client's auth.uid. Two distinct stop options:
 *   (a) PAUSE on this device — keeps the roster doc, sets `enabled:false`.
 *       Bulk sends in functions/src/index.ts skip tokens with
 *       `enabled === false`, so nothing is delivered until reactivated.
 *   (b) STOP completely — deletes `notificationTokens/{uid}` client-side
 *       (rules allow the owner to delete their own doc: tokenId ==
 *       request.auth.uid). Clean re-registration afterwards via the
 *       activate button.
 *
 * "Enviar prueba" calls the user-gated `sendTestPush` Cloud Function: sends
 * FCM only to the caller's own registered token.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FadeLoader } from "react-spinners";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
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
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
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
          enabled: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSettings((s) => ({ ...s, enabled: true }));
      setNotice("Listo. Este dispositivo recibirá notificaciones.");
    } catch (err) {
      setError("No pudimos registrar el dispositivo. Inténtalo de nuevo.");
    }
  }, [user, settings.label]);

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

  // (a) PAUSE: keep the roster doc, set enabled:false. The functions skip
  // tokens with enabled === false on every bulk send.
  const pauseDevice = async () => {
    setSettings((s) => ({ ...s, enabled: false }));
    setNotice(null);
    setError(null);
    setSaving(true);
    try {
      await setDoc(
        doc(db, "notificationTokens", user!.uid),
        {
          userId: user!.uid,
          label: settings.label || "",
          enabled: false,
          ...(settings.token ? { token: settings.token } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setNotice("Pausado. No recibirás notificaciones en este dispositivo hasta que las actives de nuevo.");
    } catch {
      setError("No pudimos pausar las notificaciones. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const resumeDevice = async () => {
    setSettings((s) => ({ ...s, enabled: true }));
    setNotice(null);
    setError(null);
    setSaving(true);
    try {
      await setDoc(
        doc(db, "notificationTokens", user!.uid),
        {
          userId: user!.uid,
          label: settings.label || "",
          enabled: true,
          ...(settings.token ? { token: settings.token } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setNotice("Notificaciones reactivadas en este dispositivo.");
    } catch {
      setError("No pudimos reactivar las notificaciones. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // (b) STOP completely: delete the roster doc client-side (owner delete is
  // allowed by the Firestore rules). After this the device is fully
  // unregistered; the activate button offers clean re-registration.
  const stopCompletely = async () => {
    if (!user) return;
    setStopping(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "notificationTokens", user.uid));
      localStorage.removeItem("notificationToken");
      setSettings({ label: "", enabled: true, token: null });
      setConfirmStop(false);
      setNotice("Registro eliminado. Este dispositivo ya no recibirá notificaciones.");
    } catch {
      setError("No pudimos eliminar el registro. Inténtalo de nuevo.");
    } finally {
      setStopping(false);
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
        <div className="w-full max-w-3xl my-6 bg-surface rounded-card border border-ink-100 shadow-card p-6 text-center">
          <h1 className="text-xl font-bold text-ink-900">Notificaciones</h1>
          <p className="mt-2 text-sm text-ink-700">
            Inicia sesión para administrar las notificaciones de este dispositivo.
          </p>
          <Link
            href="/login?next=/user/notificaciones"
            className="mt-4 inline-block bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const registered = !!settings.token;

  return (
    <div className="flex flex-col w-full items-center px-4">
      <div className="w-full max-w-3xl my-6 space-y-6">
        <h1 className="text-center text-xl font-bold text-ink-900">Notificaciones</h1>
        <p className="text-center text-sm text-ink-500">
          Recibe avisos de tus compras y resultados en este dispositivo.
        </p>

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
        <section className="bg-surface rounded-card border border-ink-100 shadow-card p-4">
          <h2 className="text-lg font-bold text-ink-900">Este dispositivo</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-1 rounded-pill text-xs ${
                registered
                  ? settings.enabled
                    ? "bg-success-50 text-success-700"
                    : "bg-warning-50 text-ink-900"
                  : "bg-warning-50 text-ink-900"
              }`}
            >
              {registered
                ? settings.enabled
                  ? "✓ Activo"
                  : "Pausado"
                : "Sin registrar"}
            </span>
            <span className="px-2 py-1 rounded-pill text-xs bg-ink-100 text-ink-700">
              Permiso: {permission === "granted" ? "concedido" : permission === "denied" ? "denegado" : permission === "unsupported" ? "no soportado" : "pendiente"}
            </span>
          </div>
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              type="button"
              onClick={requestPermissionAndRegister}
              className="mt-3 bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2"
            >
              Activar notificaciones
            </button>
          )}
          {permission === "granted" && !registered && (
            <button
              type="button"
              onClick={requestPermissionAndRegister}
              className="mt-3 bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2"
            >
              Registrar este dispositivo
            </button>
          )}
        </section>

        {/* --- Settings --- */}
        <section className="bg-surface rounded-card border border-ink-100 shadow-card p-4">
          <h2 className="text-lg font-bold text-ink-900">Configuración</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="deviceLabel" className="block text-sm font-medium text-ink-700 mb-1">
                Nombre del dispositivo
              </label>
              <input
                id="deviceLabel"
                type="text"
                value={settings.label}
                onChange={(e) => setSettings((s) => ({ ...s, label: e.target.value }))}
                maxLength={40}
                className="w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500"
                placeholder="Mi celular"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={testing || !registered || !settings.enabled}
                title={registered ? undefined : "Registra el dispositivo primero"}
                className="bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Enviando…" : "Enviar prueba"}
              </button>
            </div>
          </div>
        </section>

        {/* --- Stop options (item 19): pause vs stop completely --- */}
        <section className="bg-surface rounded-card border border-ink-100 shadow-card p-4">
          <h2 className="text-lg font-bold text-ink-900">Detener notificaciones</h2>
          {settings.enabled ? (
            <>
              <p className="mt-2 text-sm text-ink-500">
                Pausar: detiene los avisos en este dispositivo hasta que los actives de nuevo. Tu registro se conserva.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={pauseDevice}
                  disabled={saving || !registered}
                  title={registered ? undefined : "Registra el dispositivo primero"}
                  className="bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pausar en este dispositivo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="bg-danger-700 text-white rounded-sm hover:bg-danger-800 font-semibold transition-colors px-4 py-2"
                >
                  Dejar de recibir notificaciones
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-500">
                Las notificaciones están pausadas en este dispositivo.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resumeDevice}
                  disabled={saving}
                  className="bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 font-semibold transition-colors px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reactivar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="bg-danger-700 text-white rounded-sm hover:bg-danger-800 font-semibold transition-colors px-4 py-2"
                >
                  Dejar de recibir notificaciones
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* --- Confirm dialog before destructive stop (b) --- */}
      {confirmStop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-confirm-title"
        >
          <div className="w-full max-w-md bg-surface rounded-card border border-ink-100 shadow-card p-6">
            <h3 id="stop-confirm-title" className="text-xl font-bold text-ink-900">
              ¿Detener por completo?
            </h3>
            <p className="mt-2 text-sm text-ink-700">
              Se elimina el registro de este dispositivo. No volverás a recibir
              ninguna notificación aquí. Si más adelante las quieres, tendrás
              que activarlas de nuevo.
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                disabled={stopping}
                className="bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors px-4 py-2 font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={stopCompletely}
                disabled={stopping}
                className="bg-danger-700 text-white rounded-sm hover:bg-danger-800 font-semibold transition-colors px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stopping ? "Eliminando…" : "Sí, eliminar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyNotificationsPage;