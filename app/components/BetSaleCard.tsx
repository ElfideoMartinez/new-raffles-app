import React, { Suspense, useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";
import ImageWithModal from "./ImageModal";
import Link from "next/link";
import { toast } from "nextjs-toast-notify";
import { formatPrice } from "@/app/utils/format";

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

  const confirmOrRejectPayment = async (action: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/confirmRejectBetSale`,
      // `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/confirmRejectBetSale`,
      {
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
      }
    );
    const data = await res.json();
  };

  const handleAction = async () => {
    try {
      setIsLoading(true);
      if (isVerified) {
        await confirmOrRejectPayment("reject");
      } else {
        await confirmOrRejectPayment("confirm");
      }
      setIsLoading(false);
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === betSale.id ? { ...s, verified: !s.verified } : s
        )
      );
    } catch (error) {
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
      setIsLoading(false);
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === betSale.id ? { ...s, verified: !s.verified } : s
        )
      );
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
    <div className='bg-slate-600 p-4 rounded-md'>
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
              <span
                className={`px-3 py-1 rounded-md ${
                  bet.letterTeam == "A" ? "bg-green-600" : "bg-red-600"
                }`}
              >
                {bet.team}
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
        <button className='bg-gray-400 text-white rounded-md p-2' disabled>
          <FadeLoader color="var(--color-ink-inverse)" />
        </button>
      ) : (
        <div className='w-full flex flex-col gap-2 sm:flex-row mt-2'>
          <button
            onClick={handleAction}
            className={`w-full ${
              isVerified ? "bg-danger-700" : "bg-success-700"
            } text-white p-2 rounded-md`}
          >
            {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
          </button>
          {betSale.verified ? (
            <Link
              className='bg-success-700 p-2 rounded-md w-full text-center'
              href={`https://wa.me/52${betSale.phone.replace(
                "+52",
                ""
              )}?text=${msg}`}
            >
              Confirmar con Whatsapp
            </Link>
          ) : (
            <Link
              className='bg-danger-700 p-2 rounded-md w-full text-center'
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
