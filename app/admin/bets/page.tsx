'use client'
import BetSaleCard from "@/app/components/BetSaleCard";
import withAuth from "@/app/components/WithAuth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";

interface Bets{
  id: string;
  name: string;
  phone: string;
  email: string;
  bet: {
    betId: string;
    betName: string;
    team: string;
    letterTeam: string;
    ticketNumbers: number;
    totalPrice: number;
  }
  paymentImage: string;
  totalBetsPrice: string;
  verified: boolean;
}

const BetsPage = () => {

  const [salesBets, setSales] = useState<Bets[]>([]);
  const [activeTab, setActiveTab] = useState("verified"); // State to track active tab
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  },[])

  const fetchData = async () => {
    try {
      const res = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getSalesBets`,
        `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getSalesBets`,
        {
          method: "GET",
          mode: "cors", // Important for cross-origin requests
        }
      );
      const data = await res.json();
      console.log(data);
      setSales(data.betSales);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSales([]);
    }
  }

  // Filter verified and non-verified sales
  const verifiedSales = salesBets.filter((betSale: any) => betSale.verified);
  const nonVerifiedSales = salesBets.filter((betSale: any) => !betSale.verified);
  
  return (
    <div className='flex flex-col w-full items-center'>
      <h1 className="my-1">Apuestas</h1>
      <div className='flex space-x-4 mb-4'>
        <button
          className={`p-2 ${
            activeTab === "verified" ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
          }`}
          onClick={() => setActiveTab("verified")}
        >
          Apuestas verificadas
        </button>
        <button
          className={`p-2 ${
            activeTab === "non-verified"
              ? "bg-blue-500 text-white"
              : "bg-gray-300 text-gray-600"
          }`}
          onClick={() => setActiveTab("non-verified")}
        >
          Apuestas no verificadas
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center w-full h-64">
          <FadeLoader color='#ffffff'/>
        </div>
      ):(
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full'>
          {activeTab === "verified"
            ? verifiedSales.map((betSale: any) => (
                <BetSaleCard
                  key={betSale.id}
                  betSale={betSale}
                  setSalesFunction={setSales}
                  isVerified={true}
                />
              ))
            : nonVerifiedSales.map((betSale: any) => (
                <BetSaleCard
                  key={betSale.id}
                  betSale={betSale}
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

export default withAuth(BetsPage()); 
