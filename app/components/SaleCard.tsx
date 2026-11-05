import { authedApiFetch } from "@/app/config/api";
import React, { Suspense, useState } from "react";
import { FadeLoader } from "react-spinners";
import ImageWithModal from "./ImageModal";
import Link from "next/link";
import { toast } from "nextjs-toast-notify";
import { formatPrice } from "@/app/utils/format";


interface Sale {
  id: string;
  raffles: {
    raffleId: string;
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }[];
  phone: string;
  name: string;
  email?: string;
  raffle_id: string;
  raffle_name: string;
  totalRafflePrice: number;
  ticketNumbers: number[];
  paymentImage?: string;
  payment_intent: string;
  verified: boolean;
}

interface SaleCardProps {
  sale: Sale;
  isVerified: boolean;
  setSalesFunction: (sales: any) => void;
}

const SaleCard: React.FC<SaleCardProps> = ({
  sale,
  isVerified,
  setSalesFunction,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  /**
   * Resolves only when the function accepted the change. Any non-2xx response
   * (401 missing/expired token, 403 non-admin, 500 ticket update failure) is
   * thrown so the caller cannot flip the card to "confirmed" on a failed write.
   */
  const confirmOrRejectPayment = async (
    fnName: "confirmSale" | "rejectSale"
  ) => {
    const res = await authedApiFetch(fnName, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: sale.id,
        raffles: sale.raffles,
      }),
    });
    if (!res.ok) {
      console.error(`${fnName} failed:`, res.status, res.statusText);
      throw new Error(`${fnName} failed with status ${res.status}`);
    }
  };
  const handleAction = async () => {
    try {
      setIsLoading(true);
      await confirmOrRejectPayment(isVerified ? "rejectSale" : "confirmSale");
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === sale.id ? { ...s, verified: !s.verified } : s
        )
      );
    } catch (error) {
      // State is untouched: the card keeps showing what the server still has.
      toast.error(`Error al completar la compra. Inténtalo de nuevo más tarde.`,{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const msg = sale.payment_intent ? 
    `Gracias por realizar tu compra 🤗. Tu pago ha sido recibido✅. Tus boletos de rifa ya 
    estan apartados para ti 🎟️. Cualquier información adicional será enviada a este número 
    o al correo electrónico que proporcionaste. ¡Gracias por participar!¡te deseamos suerte!🍀` 
    : 
    `Gracias por tu compra 🤗. Tu transferencia ha sido recibida✅. Tus boletos de rifa ya estan 
    apartados para ti 🎟️. Cualquier información adicional será enviada a este número o al correo electrónico 
    que proporcionaste. ¡Gracias por participar!¡te deseamos suerte!🍀` ;

  const msgFailed = `¡Hola ${sale.name}! hubo un error al confirmar tu compra 😕 Si necesitas ayuda para completarla, estoy aquí para apoyarte 😊`

  return (
    <div className='bg-slate-600 p-4 rounded-card'>
      {sale.paymentImage && (
        <ImageWithModal sale={sale} />
      )}
      {sale.name && <div>Cliente: {sale.name}</div>}
      <div>Email: {sale.email}</div>
      <div>Telefono: {sale.phone.replace("+52", "")}</div>   
      <div className="flex flex-wrap flex-col">
        {sale.raffles?.map((raffle) => (         
          <div key={raffle.raffleId}>
            <h2>Rifa: {raffle.raffleName}</h2>  
            <div className="flex flex-wrap"> 
              Boletos vendidos:
              {raffle.ticketNumbers.map((tn) => (
                <span key={tn} className='p-1 bg-brand-500 rounded-card mr-1 ml-1'>
                  {tn}
                </span>
              ))}
            </div>    
          </div>     
        ))}
      </div>
      <div>Total de venta: {formatPrice(sale.totalRafflePrice)}</div>
      <div>Pago confirmado: {isVerified ? "Si" : "No"}</div>
      {sale.payment_intent && <div>ID pago: {sale.payment_intent}</div>}
      {isLoading ? (
        <button className='bg-ink-300 text-white rounded-card p-2' disabled>
          <FadeLoader color="var(--color-brand-700)" />
        </button>
      ) : (
        <div className="w-full flex flex-col gap-2 sm:flex-row mt-2">
          <button
          onClick={handleAction}
          className={`w-full ${
            isVerified ? "bg-danger-700" : "bg-success-700"
          } text-white p-2 rounded-card`}
          >
            {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
          </button>
          {sale.verified ? 
            <Link 
            className="bg-success-700 p-2 rounded-card w-full text-center"
            href={`https://wa.me/52${sale.phone.replace("+52", "")}?text=${msg}`}
            >
              Confirmar con Whatsapp
            </Link>
          : 
            <Link
              className="bg-danger-700 p-2 rounded-card w-full text-center"
              href={`https://wa.me/52${sale.phone.replace("+52", "")}?text=${msgFailed}`}
            >
              Notificar Problema
            </Link>}
        </div>
      )}
    </div>
  );
};

export default SaleCard;
