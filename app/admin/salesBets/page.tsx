'use client'
import { authedApiFetch } from "@/app/config/api";
import ApiErrorState, { safeMessage, type ErrorKind } from "@/app/components/ApiErrorState";
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
  // Fetch failures must be visible. Before this, a 401/403 was treated as a
  // success, setSales(undefined) wiped the array and .filter() threw, which
  // white-screened the whole admin route. See ApiErrorState below.
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  },[])

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedApiFetch("getSalesBets", { method: "GET" });
      if (!res.ok) {
        // A 401/403 means the session or the admin claim is wrong, not that
        // there are zero sales. Never render an empty list for this.
        setSales([]);
        setError({ kind: res.status === 401 ? "session" : res.status === 403 ? "forbidden" : "server", message: await safeMessage(res) });
        return;
      }
      const data = await res.json();
      setSales(Array.isArray(data?.betSales) ? data.betSales : []);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      setSales([]);
      setError({ kind: "network", message: "No se pudo conectar con el servidor." });
    } finally {
      setLoading(false);
    }
  }

  // Filter verified and non-verified sales
  const verifiedSales = salesBets.filter((betSale: any) => betSale.verified);
  const nonVerifiedSales = salesBets.filter((betSale: any) => !betSale.verified);
  
  return (
    <div className='flex flex-col w-full items-center'>
      <h1 className="my-1">Apuestas</h1>
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
          Apuestas verificadas
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
          Apuestas no verificadas
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
          entityLabel="apuestas"
        />
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

export default withAuth(BetsPage); 
