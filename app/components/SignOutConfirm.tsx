"use client";
import Dialog from "./Dialog";

/**
 * Confirmation shown before signing out (2026-11-06).
 *
 * Daniel's feedback: closing a session should ask first — a stray tap on
 * "Cerrar sesión" used to log the user out with no warning. Shared by the
 * desktop header and the mobile menu so both surfaces confirm the same way.
 */
const SignOutConfirm = ({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  return (
    <Dialog open={open} onClose={onCancel} labelledBy="signout-confirm-title">
      <div className="w-full max-w-sm rounded-card border border-ink-100 bg-surface p-6 text-center shadow-card">
        <h2
          id="signout-confirm-title"
          className="text-lg font-bold text-ink-900"
        >
          Cerrar sesión
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          ¿Seguro que quieres cerrar tu sesión?
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-danger-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-800"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default SignOutConfirm;
