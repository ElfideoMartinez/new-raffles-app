"use client";
import { authedApiFetch } from "@/app/config/api";
import ApiErrorState, { safeMessage, type ErrorKind } from "@/app/components/ApiErrorState";
import SaleCard from "@/app/components/SaleCard";
import withAuth from "@/app/components/WithAuth";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";
interface Sale {
  id: string;
  phone: string;
  email?: string;
  raffles: {
    raffleId: string;
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }[];
  ticketCount: string;
  totalRafflePrice: number;
  ticketNumbers: number[];
  paymentImage?: string;
  verified: boolean;
}

const SalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState("verified"); // State to track active tab
  const [loading, setLoading] = useState(true);
  // Same failure mode as /admin/salesBets: treat a non-2xx as an error state
  // instead of letting setSales(undefined) crash the render.
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedApiFetch("getSales", { method: "GET" });
      if (!res.ok) {
        setSales([]);
        setError({ kind: res.status === 401 ? "session" : res.status === 403 ? "forbidden" : "server", message: await safeMessage(res) });
        return;
      }
      const data = await res.json();
      setSales(Array.isArray(data?.sales) ? data.sales : []);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSales([]);
      setError({ kind: "network", message: "No se pudo conectar con el servidor." });
    } finally {
      setLoading(false);
    }
  };

  // Filter verified and non-verified sales
  const verifiedSales = sales.filter((sale: any) => sale.verified);
  const nonVerifiedSales = sales.filter((sale: any) => !sale.verified);

  return (
    <div className='flex flex-col w-full items-center'>
      <h1 className="my-1">Ventas</h1>
      <div className='flex space-x-4 mb-4' role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "verified"}
          className={`p-2 border-b-2 ${
            activeTab === "verified"
              ? "bg-blue-500 text-white border-blue-700"
              : "bg-gray-300 text-gray-600 border-transparent"
          }`}
          onClick={() => setActiveTab("verified")}
        >
          Ventas verificadas
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "non-verified"}
          className={`p-2 border-b-2 ${
            activeTab === "non-verified"
              ? "bg-blue-500 text-white border-blue-700"
              : "bg-gray-300 text-gray-600 border-transparent"
          }`}
          onClick={() => setActiveTab("non-verified")}
        >
          Ventas no verificadas
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center w-full h-64">
          <FadeLoader color="var(--color-brand-700)"/>
        </div>
      ): error ? (
        <ApiErrorState
          kind={error.kind}
          message={error.message}
          onRetry={fetchData}
          entityLabel="ventas"
        />
      ):(
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full'>
          {activeTab === "verified"
            ? verifiedSales.map((sale: any) => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  setSalesFunction={setSales}
                  isVerified={true}
                />
              ))
            : nonVerifiedSales.map((sale: any) => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  setSalesFunction={setSales}
                  isVerified={false}
                />
              ))
          }
        </div>
      )}     
      <Link href='../' className='p-2 bg-blue-500 border-white border-2 mt-4 mb-1 '>
        Volver al inicio
      </Link>
    </div>
  );
};

export default withAuth(SalesPage);
