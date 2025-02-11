import React, { Suspense, useState } from "react";
import { FadeLoader } from "react-spinners";


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
  totalSalePrice: number;
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
    const res = await fetch(
      //${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/confirmSale`,
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/confirmSale`,
      {
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
    const res = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/rejectSale`,
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/rejectSale`,
      {
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
      alert("Error al completar la compra. Inténtalo de nuevo más tarde.");
      setIsLoading(false);
      setSalesFunction((prevSales: any) =>
        prevSales.map((s: { id: string; verified: any }) =>
          s.id === sale.id ? { ...s, verified: !s.verified } : s
        )
      );
    }
  };

  return (
    <div className='bg-slate-600 p-4 rounded-md'>
      {sale.paymentImage && (
        <img src={sale.paymentImage} alt='payment' className='w-20 h-20 mb-2' />
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
      <div>Total de venta: ${sale.totalSalePrice}</div>
      <div>Pago confirmado: {isVerified ? "Si" : "No"}</div>
      {sale.payment_intent && <div>ID pago: {sale.payment_intent}</div>}
      {isLoading ? (
        <button className='bg-gray-400 text-white rounded-md p-2' disabled>
          <FadeLoader color='#ffffff' />
        </button>
      ) : (
        <button
          onClick={handleAction}
          className={`${
            isVerified ? "bg-red-500" : "bg-green-500"
          } text-white p-2 rounded-md my-2`}
        >
          {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
        </button>
      )}
    </div>
  );
};

export default SaleCard;
