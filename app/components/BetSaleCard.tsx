import React, { Suspense, useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";
import ImageWithModal from "./ImageModal";
import Link from "next/link";
import { toast } from "nextjs-toast-notify";
import { formatPrice } from "@/app/utils/format";
import { authedApiFetch } from "@/app/config/api";

interface IBetsSale {
  id: string;
  name: string;
  phone: string;
  email: string;
  bets: {
    betId: string;
    betName: string;
    team: string;
    letterTeam: string;
    ticketNumbers: number;
    totalPrice: number;
  }[];
  paymentImage: string;
  totalBetsPrice: string;
  verified: boolean;
  clientReturns?: number;
}

interface BetSaleCardProps {
  betSale: IBetsSale;
  isVerified: boolean;
  setSalesFunction: (sales: any) => void;
}

const SaleCard: React.FC<BetSaleCardProps> = ({
  betSale,
  isVerified,
  setSalesFunction,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Resolves only when the function accepted the change. Any non-2xx response
   * (401 missing/expired token, 403 non-admin, 500 update failure) is thrown so
   * the caller cannot flip the card to "confirmed" on a failed write.
   */
  const confirmOrRejectPayment = async (action: "confirm" | "reject") => {
    const res = await authedApiFetch("confirmRejectBetSale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: betSale.id,
        action: action,
        betSummary: betSale.bets.map((bet) => ({
          betId: bet.betId,
          totalPrice: bet.totalPrice,
          ticketNumbers: bet.ticketNumbers,
          team: bet.letterTeam,
          betName: bet.betName,
          clientReturns: betSale.clientReturns,
        })),
      }),
    });
    if (!res.ok) {
      console.error(
        `confirmRejectBetSale (${action}) failed:`,
        res.status,
        res.statusText
      );
      throw new Error(`confirmRejectBetSale failed with status ${res.status}`);
    }
  };
  const handleAction = async () => {
    try {
      setIsLoading(true);
      await confirmOrRejectPayment(isVerified ? "reject" : "confirm");
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === betSale.id ? { ...s, verified: !s.verified } : s
        )
      );
    } catch (error) {
      // State is untouched: the card keeps showing what the server still has.
      toast.error(
        `Error al completar la compra. Inténtalo de nuevo más tarde.`,
        {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    //console.log(betSale.bets.map(bet => bet.betId));
  });

  const msg = `Gracias por tu compra 🤗. Tu transferencia ha sido recibida✅. Tus boletos de rifa ya estan 
    apartados para ti 🎟️. Cualquier información adicional será enviada a este número o al correo electrónico 
    que proporcionaste. ¡Gracias por participar!¡te deseamos suerte!🍀`;

  const msgFailed = `¡Hola ${betSale.name}! hubo un error al confirmar tu compra 😕 Si necesitas ayuda para completarla, estoy aquí para apoyarte 😊`;

  return (
    <div className='bg-slate-600 p-4 rounded-card'>
      {betSale.paymentImage && <ImageWithModal sale={betSale} />}
      {betSale.name && <div>Cliente: {betSale.name}</div>}
      <div>Email: {betSale.email}</div>
      <div>Telefono: {betSale.phone.replace("+52", "")}</div>
      <div className='flex flex-wrap flex-col'>
        {betSale?.bets?.map((bet) => (
          <div key={bet.betId}>
            <h2>Apuesta: {bet.betName}</h2>
            <p>Boletos vendidos: {bet.ticketNumbers}</p>
            <p className='mt-1'>
              Equipo:{" "}
              {/* Empate (letter C) needs its own colour: the old ternary
                  painted it the same red as team B, so an admin reading a
                  batch of sales could not tell a draw pick from the away
                  fighter at a glance. */}
              <span
                className={`px-3 py-1 rounded-card ${
                  bet.letterTeam === "A"
                    ? "bg-green-600 text-white"
                    : bet.letterTeam === "C"
                    ? "bg-yellow-500 text-gray-900"
                    : "bg-red-600 text-white"
                }`}
              >
                {bet.letterTeam === "C" ? "Empate" : bet.team}
              </span>
            </p>
          </div>
        ))}
      </div>
      <div>Total de venta: {formatPrice(betSale.totalBetsPrice)}</div>
      {betSale.clientReturns && (
        <div>Devolución al cliente: {formatPrice(betSale.clientReturns)}</div>
      )}
      <div>Pago confirmado: {isVerified ? "Si" : "No"}</div>

      {isLoading ? (
        <button className='bg-gray-400 text-white rounded-card p-2' disabled>
          <FadeLoader color="var(--color-brand-700)" />
        </button>
      ) : (
        <div className='w-full flex flex-col gap-2 sm:flex-row mt-2'>
          <button
            onClick={handleAction}
            className={`w-full ${
              isVerified ? "bg-danger-700" : "bg-success-700"
            } text-white p-2 rounded-card`}
          >
            {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
          </button>
          {betSale.verified ? (
            <Link
              className='bg-success-700 p-2 rounded-card w-full text-center'
              href={`https://wa.me/52${betSale.phone.replace(
                "+52",
                ""
              )}?text=${msg}`}
            >
              Confirmar con Whatsapp
            </Link>
          ) : (
            <Link
              className='bg-danger-700 p-2 rounded-card w-full text-center'
              href={`https://wa.me/52${betSale.phone.replace(
                "+52",
                ""
              )}?text=${msgFailed}`}
            >
              Notificar Problema
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default SaleCard;
