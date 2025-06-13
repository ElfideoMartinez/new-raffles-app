'use client'

import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";

interface Purchase {
  raffleId: string;
  raffleName: string;
  ticketNumbers: number[];
  raffleTotalPrice: number;
};

interface PurchaseGroup {
  date: string;
  items: Purchase[];
}

const PurchasesPage = () => {

  const [purchases, setPurchases] = useState<PurchaseGroup[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isEmpty, setIsEmpty] = useState<boolean>();
  
  useEffect(() => {
    const saved = localStorage.getItem("purchases");
    if (saved) {
      const parsed: PurchaseGroup[] = JSON.parse(saved);
      setPurchases(parsed);
    }else{
      setIsEmpty(true)
    }
    setIsHydrated(true);
  },[])

  if (!isHydrated) {
    return (
      <div className="relative mx-auto mt-4 w-full p-4">
        <h1 className="text-center mb-3 text-lg">Compras</h1>
        <div className="flex justify-center">
          <FadeLoader color="#ffffff" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto mt-4 w-full p-4">
      <h1 className="text-center mb-3 text-lg">Compras</h1>
      {isEmpty ? <h1 className="text-center">No hay compras aun</h1>: 
        <ul className="space-y-6">
          {purchases.map((group, index) => (
            <li key={index} className="bg-slate-700 p-4 rounded-md">
              <p className="text-sm text-gray-300 mb-2">📅 Compra realizada el: {new Date(group.date).toLocaleString()}</p>
              <ul className="space-y-3">
                {group.items.map((purchase) => (
                  <li key={`${purchase.raffleId}-${purchase.ticketNumbers.join(",")}`} className="bg-slate-600 p-3 rounded-md md:flex md:justify-between md:items-center">
                    <section>
                      <strong>🎟 Rifa:</strong> {purchase.raffleName}<br />
                      <strong>Boletos:</strong> {purchase.ticketNumbers.join(", ")}<br />
                    </section>
                    <p><strong>Total:</strong> ${purchase.raffleTotalPrice}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      }
    </div>
  );
  
}

export default PurchasesPage;