import React, { Suspense, useState } from "react";
import { FadeLoader } from "react-spinners";

interface Sale {
  id: string;
  phone: string;
  email?: string;
  raffle_id: string;
  raffle_name: string;
  totalSalePrice: number;
  ticketNumbers: number[];
  paymentImage?: string;
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
    ticketNumbers: number[];
    raffle_id: string;
    raffleId?: string;
  }) => {
    const res = await fetch(
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/confirmSale`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sale.id,
          ticketNumbers: sale.ticketNumbers,
          raffle_id: sale.raffle_id || sale.raffleId,
        }),
      }
    );
    const data = await res.json();
  };
  const rejectPayment = async (sale: {
    id: string;
    ticketNumbers: number[];
    raffle_id: string;
    raffleId?: string;
  }) => {
    console.log("Rejecting payment", sale);
    const res = await fetch(
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sale.id,
          ticketNumbers: sale.ticketNumbers,
          raffle_id: sale.raffle_id || sale.raffleId,
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
        <img src={sale.paymentImage} alt='payment' className='w-20 h-20' />
      )}
      <div>Cliente: {sale.phone}</div>
      {sale.email && <div>Email: {sale.email}</div>}
      <div>Rifa: {sale.raffle_name}</div>
      <div>Total de venta: {sale.totalSalePrice}</div>
      <div>
        Boletos vendidos:
        {sale.ticketNumbers.map((tn) => (
          <span key={tn} className='p-1 bg-blue-400 rounded-lg mr-1'>
            {tn}
          </span>
        ))}
      </div>
      <div>Pago confirmado: {isVerified ? "Si" : "No"}</div>
      {isLoading ? (
        <button className='bg-gray-400 text-white rounded-md p-2' disabled>
          <FadeLoader color='#ffffff' />
        </button>
      ) : (
        <button
          onClick={handleAction}
          className={`${
            isVerified ? "bg-red-500" : "bg-green-500"
          } text-white p-2 rounded-md`}
        >
          {isVerified ? "Rechazar Pago" : "Confirmar Pago"}
        </button>
      )}
    </div>
  );
};

export default SaleCard;
