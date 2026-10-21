"use client";
import { apiUrl } from "@/app/config/api";
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getSales`,
        apiUrl("getSales"),
        {
          method: "GET",
          mode: "cors", // Important for cross-origin requests
        }
      );
      const data = await res.json();
      console.log(data);
      setSales(data.sales);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSales([]);
    }
  };

  // Filter verified and non-verified sales
  const verifiedSales = sales.filter((sale: any) => sale.verified);
  const nonVerifiedSales = sales.filter((sale: any) => !sale.verified);

  return (
    <div className='flex flex-col w-full items-center'>
      <h1 className="my-1">Ventas</h1>
      <div className='flex space-x-4 mb-4'>
        <button
          className={`p-2 ${
            activeTab === "verified" ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
          }`}
          onClick={() => setActiveTab("verified")}
        >
          Ventas verificadas
        </button>
        <button
          className={`p-2 ${
            activeTab === "non-verified"
              ? "bg-blue-500 text-white"
              : "bg-gray-300 text-gray-600"
          }`}
          onClick={() => setActiveTab("non-verified")}
        >
          Ventas no verificadas
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center w-full h-64">
          <FadeLoader color="var(--color-ink-inverse)"/>
        </div>
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
