"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { realtimeDB } from "@/app/firebaseconfig";
import TicketCard from "@/app/components/TicketCard";
import { authedApiFetch } from "@/app/config/api";
import { formatDateTime } from "@/app/utils/format";

interface Ticket {
  activationCode: string;
  createdAt: number | string;
  status: string;
  isWinner: boolean;
  symbols: string[];
  claimed?: boolean;
}

type TicketRow = Ticket & { id: string };
type TicketAction = { action: "activate" } | { action: "setClaimed"; claimed: boolean };
const filters = [
  { id: "pending", label: "Pendientes", empty: "No hay boletos pendientes de activar." },
  { id: "all", label: "Todos", empty: "No hay boletos registrados." },
  { id: "winners", label: "Ganadores", empty: "No hay boletos ganadores finalizados." },
] as const;

export default function QuickTicketsActivePage() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [selected, setSelected] = useState<(typeof filters)[number]["id"]>("pending");
  const [readError, setReadError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => onValue(ref(realtimeDB, "quickTickets"), (snapshot) => {
    const rows: TicketRow[] = [];
    snapshot.forEach((child) => {
      const value = child.val() as Ticket | null;
      if (value && child.key) rows.push({ ...value, id: child.key });
    });
    setTickets(rows.reverse());
    setReadError(false);
  }, () => {
    setReadError(true);
    setTickets(null);
  }), [attempt]);

  async function updateTicket(ticketId: string, change: TicketAction) {
    if (busy) return;
    setBusy(ticketId);
    setActionError("");
    try {
      const response = await authedApiFetch("updateQuickTicketStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, ...change }),
      });
      if (!response.ok) {
        setActionError(response.status === 409
          ? "El boleto cambió de estado. Revisa la lista e inténtalo de nuevo."
          : "No se pudo actualizar el boleto.");
      }
      // The subscription renders the committed server state.
    } catch {
      setActionError("No se pudo conectar para actualizar el boleto.");
    } finally {
      setBusy(null);
    }
  }

  const all = tickets ?? [];
  const groups = {
    all,
    pending: all.filter((ticket) => ticket.status === "pending"),
    winners: all.filter((ticket) => ticket.isWinner === true && ticket.status === "finnished"),
  };
  const visible = groups[selected];

  return (
    <main className="space-y-4 text-ink-900">
      <header>
        <h1 className="text-2xl font-bold">Boletos rápidos</h1>
        <p className="mt-1 text-sm text-ink-700">Activa boletos pendientes y registra los premios reclamados.</p>
      </header>
      <div role="group" aria-label="Filtrar boletos" className="flex flex-wrap gap-2">
        {filters.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={selected === id} onClick={() => setSelected(id)}
            className={`focus-ring min-h-11 rounded-sm px-4 text-sm font-semibold ${selected === id ? "bg-brand-100 text-on-brand" : "bg-ink-100 text-ink-700"}`}>
            {label}{tickets && ` (${groups[id].length})`}
          </button>
        ))}
      </div>
      {actionError && <p role="alert" className="rounded-sm border border-danger-500 bg-danger-500/10 p-3">{actionError}</p>}
      {readError ? (
        <div className="rounded-card border border-ink-100 p-4">
          <p role="alert">No se pudieron cargar los boletos.</p>
          <button type="button" className="focus-ring min-h-11 rounded-sm px-2 font-semibold underline" onClick={() => { setReadError(false); setAttempt((n) => n + 1); }}>Reintentar</button>
        </div>
      ) : !tickets ? (
        <p role="status" className="text-ink-700">Cargando boletos…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-card border border-ink-100 p-4 text-ink-700">{filters.find(({ id }) => id === selected)?.empty}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((ticket) => (
            <li key={ticket.id} className="min-w-0">
              <TicketCard activationCode={ticket.activationCode} createdAt={formatDateTime(Number(ticket.createdAt) || ticket.createdAt)}
                symbols={ticket.symbols} isWinner={ticket.isWinner && selected !== "pending"}>
                {selected === "pending" && (
                  <button type="button" disabled={busy !== null} onClick={() => void updateTicket(ticket.id, { action: "activate" })}
                    className="focus-ring min-h-11 rounded-sm bg-brand-100 px-3 text-sm font-bold text-on-brand disabled:opacity-60">
                    {busy === ticket.id ? "Activando…" : "Activar boleto"}
                  </button>
                )}
                {selected === "winners" && (
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="focus-ring h-5 w-5" checked={ticket.claimed === true} disabled={busy !== null}
                      onChange={(event) => void updateTicket(ticket.id, { action: "setClaimed", claimed: event.target.checked })} />
                    Premio reclamado
                  </label>
                )}
              </TicketCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
