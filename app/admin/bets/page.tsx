"use client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "nextjs-toast-notify";
import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";
import { onValue, ref, set, update } from "firebase/database";
import { realtimeDB } from "@/app/firebaseconfig";
import { formatDate, formatPrice } from "@/app/utils/format";
import { authedApiFetch } from "@/app/config/api";
import Dialog from "@/app/components/Dialog";

interface IBetsData {
  id: string;
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  image: string;
  title: string;
  date: string;
  description: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  oddsTeamA?: string;
  oddsTeamB?: string;
  tieBets?: number;
  teams: { a: string; b: string };
  isFinished: boolean;
  settled?: boolean;
  totalBets?: number;
}

interface EditBetFormData {
  title: string;
  description: string;
  pricePerTicket: string;
  date: string;
  teams: { a: string; b: string };
  image: string;
}

function EditBetModal({
  bet,
  isOpen,
  onClose,
  onSave,
}: {
  bet: IBetsData;
  isOpen: boolean;
  onClose: () => void;
  onSave: (betId: string, updatedData: EditBetFormData) => void;
}) {
  const [formData, setFormData] = useState<EditBetFormData>({
    title: bet.title,
    image: bet.image,
    description: bet.description,
    pricePerTicket: bet.pricePerTicket,
    date: bet.date,
    teams: { a: bet.teams.a || "", b: bet.teams.b || "" },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(bet.id, formData);
    onClose();
  };

  const handleInputChange = (field: keyof EditBetFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTeamChange = (index: 0 | 1, value: string) => {
    setFormData((prev) => ({
      ...prev,
      teams:
        index === 0
          ? { a: value, b: prev.teams.b }
          : { a: prev.teams.a, b: value },
    }));
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} labelledBy="edit-bet-title">
      <div className='bg-surface rounded-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-card border border-ink-100'>
        <div className='flex justify-between items-center mb-4'>
          <h2 id='edit-bet-title' className='text-xl font-bold text-ink-900'>Editar Apuesta</h2>
          <button
            onClick={onClose}
            className='text-ink-500 hover:text-ink-900 text-2xl'
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-ink-700 mb-1'>
              Título
            </label>
            <input
              type='text'
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-ink-700 mb-1'>
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500 h-24'
              required
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-ink-700 mb-1'>
                Precio por boleto
              </label>
              <input
                type='number'
                step='0.01'
                value={formData.pricePerTicket}
                onChange={(e) =>
                  handleInputChange("pricePerTicket", e.target.value)
                }
                className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
                required
              />
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-ink-700 mb-1'>
              Fecha de cierre
            </label>
            <input
              type='datetime-local'
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
              required
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-ink-700 mb-1'>
                Equipo A
              </label>
              <input
                type='text'
                value={formData.teams.a}
                onChange={(e) => handleTeamChange(0, e.target.value)}
                className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
                required
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-ink-700 mb-1'>
                Equipo B
              </label>
              <input
                type='text'
                value={formData.teams.b}
                onChange={(e) => handleTeamChange(1, e.target.value)}
                className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
                required
              />
            </div>
          </div>
          <div className='text-xs text-ink-500'>
            Link de imagen (opcional):
            <input
              type='text'
              value={formData.image || ""}
              onChange={(e) => handleInputChange("image", e.target.value)}
              className='w-full p-2 rounded-sm bg-surface text-ink-900 border border-ink-300 focus:border-brand-500'
              placeholder='URL de la imagen'
            />
          </div>
          <div className='flex gap-4 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors'
            >
              Cancelar
            </button>
            <button
              type='submit'
              className='flex-1 px-4 py-2 bg-brand-600 text-on-brand rounded-sm hover:bg-brand-700 transition-colors'
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

// Client-side payout ESTIMATE, mirroring functions/src/payout.ts (B2, Option A).
// Authoritative maths always runs in settleBet; this preview uses the live RTDB
// counters (which may have drifted) and the default take rate (10%), so it is
// clearly labelled as an estimate in the UI.
const ESTIMATED_TAKE_RATE = 0.1;

function payoutPreviewCents(
  ticketsByOutcome: { A: number; B: number; C: number },
  outcome: "A" | "B" | "C" | "VOID",
  pricePerTicket: number
): { perTicketCents: number; refundAll: boolean } {
  const totalTickets =
    ticketsByOutcome.A + ticketsByOutcome.B + ticketsByOutcome.C;
  const poolCents = Math.round(totalTickets * pricePerTicket * 100);
  const distributableCents = Math.floor(poolCents * (1 - ESTIMATED_TAKE_RATE));
  const isVoid = outcome === "VOID";
  const winningTickets = isVoid ? 0 : ticketsByOutcome[outcome];
  const refundAll = isVoid || winningTickets === 0;
  const perTicketCents = refundAll
    ? Math.round(pricePerTicket * 100)
    : Math.floor(distributableCents / winningTickets);
  return { perTicketCents, refundAll };
}

const SETTLE_OUTCOME_LABELS: Record<"A" | "B" | "C" | "VOID", string> = {
  A: "Gana A",
  B: "Gana B",
  C: "Empate",
  VOID: "VOID (anulada)",
};

function SettleBetModal({
  bet,
  isOpen,
  onClose,
  onSettled,
}: {
  bet: IBetsData;
  isOpen: boolean;
  onClose: () => void;
  onSettled: (betId: string) => void;
}) {
  const pricePerTicket = parseFloat(bet.pricePerTicket);
  const ticketsByOutcome = {
    A: bet.betsTeamA || 0,
    B: bet.betsTeamB || 0,
    C: bet.tieBets || 0,
  };
  const [outcome, setOutcome] = useState<"A" | "B" | "C" | "VOID" | null>(
    null
  );
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySettled, setAlreadySettled] = useState(false);

  if (!isOpen) return null;

  const preview =
    outcome && Number.isFinite(pricePerTicket) && pricePerTicket > 0
      ? payoutPreviewCents(ticketsByOutcome, outcome, pricePerTicket)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome || !confirmed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await authedApiFetch("settleBet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betId: bet.id,
          result: outcome,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: number;
        message?: string;
        alreadySettled?: boolean;
      };
      if (!res.ok) {
        setError(data.message || `Error del servidor (${res.status})`);
      } else if (data.alreadySettled) {
        setAlreadySettled(true);
      } else {
        onSettled(bet.id);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al liquidar"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} labelledBy="settle-bet-title">
      <div className='bg-surface rounded-card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-card border border-ink-100'>
        <div className='flex justify-between items-center mb-4'>
          <h2
            id='settle-bet-title'
            className='text-xl font-bold text-ink-900'
          >
            Liquidar Apuesta
          </h2>
          <button
            onClick={onClose}
            className='text-ink-500 hover:text-ink-900 text-2xl'
          >
            ×
          </button>
        </div>

        <p className='text-sm text-ink-700 mb-4'>
          {bet.teams.a} vs {bet.teams.b} — {bet.title}
        </p>

        <div
          role='alert'
          className='mb-4 px-3 py-2 rounded-sm border border-warning-500 text-warning-700 text-sm bg-warning-50'
        >
          La liquidación es <strong>permanente e idempotente</strong>: una
          apuesta solo puede liquidarse una vez. Revisa el resultado antes de
          confirmar.
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-ink-700 mb-2'>
              Resultado oficial
            </label>
            <div className='grid grid-cols-2 gap-2'>
              {(
                ["A", "B", "C", "VOID"] as const
              ).map((o) => (
                <button
                  key={o}
                  type='button'
                  onClick={() => {
                    setOutcome(o);
                    setConfirmed(false);
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-sm border text-sm font-semibold transition-colors ${
                    outcome === o
                      ? "bg-brand-600 text-on-brand border-brand-600"
                      : "bg-surface text-ink-900 border-ink-300 hover:bg-ink-100"
                  }`}
                >
                  {SETTLE_OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          {preview && (
            <div className='rounded-sm border border-ink-300 bg-ink-100 p-3 text-sm'>
              <p className='font-semibold text-ink-900 mb-1'>
                Pago estimado por boleto ganador
              </p>
              {preview.refundAll ? (
                <p className='text-ink-700'>
                  Reembolso total: cada boleto recupera su apuesta completa (
                  {formatPrice(pricePerTicket)}). Sin ganancias para la banca.
                </p>
              ) : (
                <p className='text-ink-700'>
                  Aprox.{' '}
                  {formatPrice((preview.perTicketCents / 100).toFixed(2))} por
                  boleto ganador ({formatPrice(pricePerTicket)} apostado).
                </p>
              )}
              <p className='text-xs text-ink-500 mt-2'>
                Estimación con tasa de la casa 10% y contadores en vivo; el
                cálculo oficial lo hace settleBet con los documentos de venta
                verificados.
              </p>
            </div>
          )}

          {alreadySettled && (
            <div
              role='alert'
              className='px-3 py-2 rounded-sm bg-ink-100 border border-ink-300 text-ink-700 text-sm'
            >
              Esta apuesta ya estaba liquidada; no se aplicó ningún cambio.
            </div>
          )}

          {error && (
            <div
              role='alert'
              className='px-3 py-2 rounded-sm bg-danger-50 border border-danger-500 text-danger-700 text-sm'
            >
              {error}
            </div>
          )}

          <label className='flex items-center gap-2 text-sm text-ink-700'>
            <input
              type='checkbox'
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className='accent-brand-600'
              disabled={!outcome || isSubmitting}
            />
            Confirmo el resultado y entiendo que la liquidación es definitiva.
          </label>

          <div className='flex gap-4 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors'
            >
              Cancelar
            </button>
            <button
              type='submit'
              disabled={!outcome || !confirmed || isSubmitting}
              className='flex-1 px-4 py-2 bg-danger-700 text-white rounded-sm hover:bg-danger-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? "Procesando…" : "Liquidar definitivamente"}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

function AdminBetCard({
  bet,
  onEdit,
  onSettle,
}: {
  bet: IBetsData;
  onEdit: (bet: IBetsData) => void;
  onSettle: (bet: IBetsData) => void;
}) {
  const totalBets = bet.betsTeamA + bet.betsTeamB + (bet.tieBets || 0);
  const teamAPercentage =
    totalBets > 0 ? ((bet.betsTeamA / totalBets) * 100).toFixed(1) : "0";
  const teamBPercentage =
    totalBets > 0 ? ((bet.betsTeamB / totalBets) * 100).toFixed(1) : "0";

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`Link copiado al portapapeles!`, {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      })
      .catch((error) => console.error("Error al copiar:", error));
  };

  return (
    <div className='bg-surface rounded-card overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink-100'>
      {bet.image && (
        <div className='relative h-48 w-full'>
          <Image
            src={bet.image}
            alt={bet.title}
            fill
            className='object-cover'
          />
        </div>
      )}

      <div className='p-4'>
        <h3 className='text-xl font-bold text-ink-900 mb-2 line-clamp-2'>
          🎯 {bet.title}
        </h3>

        <p className='text-ink-700 text-sm mb-3 line-clamp-3'>
          {bet.description}
        </p>

        <div className='space-y-2 mb-4'>
          <div className='text-sm text-ink-500'>
            <span className='font-semibold'>Precio por boleto:</span>
            <span className='text-ink-900'>{formatPrice(bet.pricePerTicket)}</span>
          </div>
          <div className='text-sm text-ink-500'>
            <span className='font-semibold'>Total de apuestas:</span>
            <span className='text-ink-900'>
              {formatPrice(totalBets * parseFloat(bet.pricePerTicket))}
            </span>
          </div>

          <div className='text-sm text-ink-500'>
            <span className='font-semibold'>Fecha de cierre:</span>
            <span className='text-ink-900'>
              {formatDate(bet.date)}
            </span>
          </div>

          <div className='text-sm text-ink-500'>
            <span className='font-semibold'>Estado:</span>
            <span
              className={`ml-1 px-2 py-1 rounded-pill text-xs ${
                bet.isFinished
                  ? "bg-danger-700 text-white"
                  : "bg-success-700 text-white"
              }`}
            >
              {bet.isFinished ? "Finalizada" : "Activa"}
            </span>
          </div>
        </div>

        {/* Teams and betting stats */}
        <div className='space-y-2 mb-4'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-success-700'>
              {bet.teams.a}
              <span className='ml-2 bg-ink-100 text-ink-700 text-xs px-2 py-1 rounded-pill'>
                {formatPrice(bet.betsTeamA * parseFloat(bet.pricePerTicket))}
              </span>
            </span>
            <span className='text-sm text-ink-700'>
              {bet.betsTeamA} Apuestas ({teamAPercentage}%)
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-danger-700'>
              {bet.teams.b}
              <span className='ml-2 bg-ink-100 text-ink-700 text-xs px-2 py-1 rounded-pill'>
                {formatPrice(bet.betsTeamB * parseFloat(bet.pricePerTicket))}
              </span>
            </span>
            <span className='text-sm text-ink-700'>
              {bet.betsTeamB} Apuestas ({teamBPercentage}%)
            </span>
          </div>
          {bet.tieBets !== undefined && (
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-warning-700'>
                Empate
                <span className='ml-2 bg-ink-100 text-ink-700 text-xs px-2 py-1 rounded-pill'>
                  {formatPrice(bet.tieBets * parseFloat(bet.pricePerTicket))}
                </span>
              </span>
              <span className='text-sm text-ink-700'>
                {bet.tieBets} Apuestas (
                {totalBets > 0
                  ? ((bet.tieBets / totalBets) * 100).toFixed(1)
                  : "0"}
                %)
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className='space-y-2'>
          <Link
            target='_blank'
            href={`${process.env.NEXT_PUBLIC_BASE_URL}/bet/${bet.id}`}
            className='block w-full text-center py-2 px-4 bg-brand-600 hover:bg-brand-700 text-on-brand rounded-sm font-semibold transition-colors duration-300'
          >
            Ver Apuesta
          </Link>

          <div className='grid grid-cols-2 gap-2'>
            <button
              onClick={() => onEdit(bet)}
              className='w-full py-2 px-4 bg-warning-500 text-ink-900 hover:bg-warning-700 hover:text-white rounded-sm font-semibold transition-colors duration-300'
            >
              Editar
            </button>

            <button
              onClick={() =>
                copyToClipboard(
                  `${process.env.NEXT_PUBLIC_BASE_URL || ""}/bet/${bet.id}`
                )
              }
              className='w-full py-2 px-4 bg-ink-100 text-ink-900 hover:bg-ink-300 rounded-sm font-semibold transition-colors duration-300'
            >
              Copiar Link
            </button>
          </div>

          {bet.settled === true ? (
            <div className='w-full text-center py-2 px-4 bg-success-700 text-white rounded-sm font-semibold text-sm'>
              ✓ Liquidada
            </div>
          ) : (
            <button
              onClick={() => onSettle(bet)}
              className='w-full py-2 px-4 bg-danger-700 text-white hover:bg-danger-800 rounded-sm font-semibold transition-colors duration-300'
            >
              Liquidar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BetsPage() {
  const [dataBet, setDataBet] = useState<IBetsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBet, setEditingBet] = useState<IBetsData | null>(null);
  const [settlingBet, setSettlingBet] = useState<IBetsData | null>(null);

  useEffect(() => {
    const fetchBets = async () => {
      try {
        setIsLoading(true);
        const betsRef = ref(realtimeDB, "bets");
        onValue(betsRef, (snapshot) => {
          const betsData = snapshot.val();
          if (betsData) {
            const betsArray: IBetsData[] = Object.keys(betsData).map((key) => ({
              id: key,
              ...betsData[key],
            }));
            console.log(betsArray);
            setDataBet(betsArray);
          } else {
            setDataBet([]);
          }
        });

        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        toast.error("Error al cargar las apuestas", {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      }
    };
    fetchBets();
  }, []);

  const handleEditBet = (bet: IBetsData) => {
    setEditingBet(bet);
  };

  const handleSaveBet = async (betId: string, updatedData: EditBetFormData) => {
    try {
      update(ref(realtimeDB, `bets/${betId}`), updatedData);
      setDataBet((prev) =>
        prev.map((bet) =>
          bet.id === betId
            ? {
                ...bet,
                ...updatedData,
                teams: { a: updatedData.teams.a, b: updatedData.teams.b },
              }
            : bet
        )
      );
      toast.info("Apuesta actualizada correctamente", {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
    } catch (error) {
      toast.error("Error al actualizar la apuesta", {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
    }
  };

  const closeEditModal = () => {
    setEditingBet(null);
  };

  const handleSettleBet = (bet: IBetsData) => {
    setSettlingBet(bet);
  };

  const handleBetSettled = (betId: string) => {
    setDataBet((prev) =>
      prev.map((bet) =>
        bet.id === betId ? { ...bet, settled: true } : bet
      )
    );
    toast.info("Apuesta liquidada correctamente", {
      duration: 2000,
      progress: false,
      position: "top-right",
      transition: "popUp",
      icon: "",
      sound: false,
    });
  };

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`Link copiado al portapapeles!`, {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      })
      .catch((error) => console.error("Error al copiar:", error));
  };

  return (
    <div className='min-h-screen p-4'>
      <div className='max-w-7xl mx-auto'>
        <h2 className='text-3xl font-bold text-ink-900 text-center mb-8'>
          Administrar Apuestas
        </h2>
        <div className='flex justify-center mb-4'>
          <Link
            href={`${process.env.NEXT_PUBLIC_BASE_URL}/admin/create/bet`}
            className='focus-ring px-4 py-2 bg-brand-600 hover:bg-brand-700 text-on-brand rounded-sm font-semibold transition-colors duration-300'
          >
            + Crear Nueva Apuesta
          </Link>
        </div>
        {isLoading ? (
          <div className='flex justify-center mt-20'>
            <FadeLoader color="var(--color-brand-700)" />
          </div>
        ) : dataBet.length === 0 ? (
          <div className='text-center text-ink-500 mt-20'>
            <p>No hay apuestas disponibles</p>
          </div>
        ) : (
          <div className='grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
            {dataBet.map((bet) => (
              <AdminBetCard
                key={bet.id}
                bet={bet}
                onEdit={handleEditBet}
                onSettle={handleSettleBet}
              />
            ))}
          </div>
        )}
        {editingBet && (
          <EditBetModal
            bet={editingBet}
            isOpen={!!editingBet}
            onClose={closeEditModal}
            onSave={handleSaveBet}
          />
        )}
        {settlingBet && (
          <SettleBetModal
            bet={settlingBet}
            isOpen={!!settlingBet}
            onClose={() => setSettlingBet(null)}
            onSettled={handleBetSettled}
          />
        )}
      </div>
    </div>
  );
}
