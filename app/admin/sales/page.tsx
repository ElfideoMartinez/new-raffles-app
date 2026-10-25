"use client";
// Thin wrapper: the shared shell lives in AdminSalesListPage. Kept as its own
// route so existing links to /admin/sales keep working.
import AdminSalesListPage from "@/app/components/AdminSalesListPage";
import SaleCard from "@/app/components/SaleCard";
import withAuth from "@/app/components/WithAuth";

// Card types are owned by SaleCard; reuse them instead of duplicating the shape.
type Sale = Parameters<typeof SaleCard>[0]["sale"];

const SalesPage = () => (
  <AdminSalesListPage<Sale>
    heading="Ventas"
    fetchKey="getSales"
    listKey="sales"
    entityLabel="ventas"
    tabs={[
      { key: "verified", label: "Ventas verificadas" },
      { key: "non-verified", label: "Ventas no verificadas" },
    ]}
    renderCard={(sale, setSales, isVerified) => (
      <SaleCard key={sale.id} sale={sale} setSalesFunction={setSales} isVerified={isVerified} />
    )}
  />
);

export default withAuth(SalesPage);
