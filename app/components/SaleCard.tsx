import { apiUrl, authedApiFetch } from "@/app/config/api";
import React, { Suspense, useState } from "react";
import { FadeLoader } from "react-spinners";
import ImageWithModal from "./ImageModal";
import Link from "next/link";
import { toast } from "nextjs-toast-notify";


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
  const confirmPayment = async (sale: {
    id: string;
    raffles: {
      raffleId: string;
      raffleName: string;
      ticketNumbers: number[];
      raffleTotalPrice: number;
    }[];
  }) => {
    const res = await authedApiFetch("confirmSale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sale.id,
          raffles: sale.raffles,
        }),
      }
    );
    const data = await res.json();
  };
  const rejectPayment = async (sale: {
    id: string;
    raffles: {
      raffleId: string;
      raffleName: string;
      ticketNumbers: number[];
      raffleTotalPrice: number;
    }[];
  }) => {
    console.log("Rejecting payment", sale);
    const res = await authedApiFetch("rejectSale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sale.id,
          raffles: sale.raffles,
        }),
      }
    );
  };
  const handleAction = async () => {
    try {
      setIsLoading(true);
      if (isVerified) {
        await rejectPayment(sale);
      } else {
        await confirmPayment(sale);
      }
      setIsLoading(false);
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === sale.id ? { ...s, verified: !s.verified } : s
        )
      );
    } catch (error) {
      toast.error(`Error al completar la compra. Inténtalo de nuevo más tarde.`,{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
      setIsLoading(false);
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === sale.id ? { ...s, verified: !s.verified } : s
        )
      );
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
    <div className='bg-slate-600 p-4 rounded-md'>
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
                <span key={tn} className='p-1 bg-blue-400 rounded-lg mr-1 ml-1'>
                  {tn}
                </span>
              ))}
            </div>    
          </div>     
        ))}
      </div>
      <div>Total de venta: ${sale.totalRafflePrice}</div>
      <div>Pago confirmado: {isVerified ? "Si" : "No"}</div>
      {sale.payment_intent && <div>ID pago: {sale.payment_intent}</div>}
      {isLoading ? (
        <button className='bg-gray-400 text-white rounded-md p-2' disabled>
          <FadeLoader color="var(--color-ink-inverse)" />
        </button>
      ) : (
        <div className="w-full flex flex-col gap-2 sm:flex-row mt-2">
          <button
          onClick={handleAction}
          className={`w-full ${
            isVerified ? "bg-red-500" : "bg-green-500"
          } text-white p-2 rounded-md`}
          >
            {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
          </button>
          {sale.verified ? 
            <Link 
            className="bg-green-500 p-2 rounded-md w-full text-center"
            href={`https://wa.me/52${sale.phone.replace("+52", "")}?text=${msg}`}
            >
              Confirmar con Whatsapp
            </Link>
          : 
            <Link
              className="bg-red-500 p-2 rounded-md w-full text-center"
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
