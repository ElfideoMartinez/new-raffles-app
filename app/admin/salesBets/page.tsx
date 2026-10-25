'use client'
// Thin wrapper: the shared shell lives in AdminSalesListPage. Kept as its own
// route so existing links to /admin/salesBets keep working.
import AdminSalesListPage from "@/app/components/AdminSalesListPage";
import BetSaleCard from "@/app/components/BetSaleCard";
import withAuth from "@/app/components/WithAuth";

// Card type is owned by BetSaleCard; reuse it instead of duplicating the shape.
type Bets = Parameters<typeof BetSaleCard>[0]["betSale"];

const BetsPage = () => (
  <AdminSalesListPage<Bets>
    heading="Apuestas"
    fetchKey="getSalesBets"
    listKey="betSales"
    entityLabel="apuestas"
    tabs={[
      { key: "verified", label: "Apuestas verificadas" },
      { key: "non-verified", label: "Apuestas no verificadas" },
    ]}
    renderCard={(betSale, setSales, isVerified) => (
      <BetSaleCard key={betSale.id} betSale={betSale} setSalesFunction={setSales} isVerified={isVerified} />
    )}
  />
);

export default withAuth(BetsPage);
