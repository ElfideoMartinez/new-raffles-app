"use client";
import SaleCard from "@/app/components/SaleCard";
import withAuth from "@/app/components/WithAuth";
import Link from "next/link";
import React, { useEffect, useState } from "react";
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

const Page = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState("verified"); // State to track active tab

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getSales`
      );
      const data = await res.json();
      console.log(data);
      setSales(data.sales);
    } catch (error) {
      console.error("Error fetching sales data:", error);
    }
  };

  // Filter verified and non-verified sales
  const verifiedSales = sales.filter((sale: any) => sale.verified);
  const nonVerifiedSales = sales.filter((sale: any) => !sale.verified);

  return (
    <div className='flex flex-col w-full items-center'>
      <h1>Sales</h1>
      <div className='flex space-x-4 mb-4'>
        <button
          className={`p-2 ${
            activeTab === "verified" ? "bg-blue-500 text-white" : "bg-gray-300"
          }`}
          onClick={() => setActiveTab("verified")}
        >
          Verified Sales
        </button>
        <button
          className={`p-2 ${
            activeTab === "non-verified"
              ? "bg-blue-500 text-white"
              : "bg-gray-300"
          }`}
          onClick={() => setActiveTab("non-verified")}
        >
          Non-Verified Sales
        </button>
      </div>
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
            ))}
      </div>
      <Link href='../' className='p-2 bg-blue-500 border-white border-2 mt-4'>
        Back to Home
      </Link>
    </div>
  );
};

export default withAuth(Page);
