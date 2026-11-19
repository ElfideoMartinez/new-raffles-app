"use client";
// Shared shell for the admin sales lists (/admin/sales and /admin/salesBets).
// Both pages were near-identical (same fetch, loading, tabs, error state, card
// grid) and every fix had to be applied twice. The pages now only supply the
// endpoint, list key, labels, and the card renderer; behaviour is unchanged.
import { authedApiFetch } from "@/app/config/api";
import Spinner from "@/app/components/Spinner";
import ApiErrorState, { safeMessage, type ErrorKind } from "@/app/components/ApiErrorState";
import BackLink from "@/app/components/BackLink";
import { useEffect, useState } from "react";

interface AdminSalesListPageProps<T> {
  heading: string;
  fetchKey: string;
  listKey: string;
  entityLabel: string;
  tabs: { key: "verified" | "non-verified"; label: string }[];
  renderCard: (item: T, setItems: React.Dispatch<React.SetStateAction<T[]>>, isVerified: boolean) => React.ReactNode;
}

function AdminSalesListPage<T extends { id: string }>({
  heading,
  fetchKey,
  listKey,
  entityLabel,
  tabs,
  renderCard,
}: AdminSalesListPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "verified");
  const [loading, setLoading] = useState(true);
  // Fetch failures must be visible. A 401/403 means the session or admin claim
  // is wrong, not that the list is empty; never render an empty list for it.
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedApiFetch(fetchKey, { method: "GET" });
      if (!res.ok) {
        setItems([]);
        setError({ kind: res.status === 401 ? "session" : res.status === 403 ? "forbidden" : "server", message: await safeMessage(res) });
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data?.[listKey]) ? data[listKey] : []);
    } catch (err) {
      console.error(`Error fetching ${entityLabel}:`, err);
      setItems([]);
      setError({ kind: "network", message: "No se pudo conectar con el servidor." });
    } finally {
      setLoading(false);
    }
  };

  const verified = items.filter((item: any) => item.verified);
  const nonVerified = items.filter((item: any) => !item.verified);
  const visible = activeTab === "verified" ? verified : nonVerified;

  return (
    <div className='flex flex-col w-full items-center'>
      <h1 className="mb-4 text-2xl font-bold text-ink-900">{heading}</h1>
      <div className="mb-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Filtrar por estado">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            className={`focus-ring min-h-11 rounded-sm px-3 text-sm font-semibold ${
              activeTab === tab.key
                ? "bg-brand-100 text-on-brand"
                : "bg-ink-100 text-ink-700 hover:text-ink-900"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center items-center w-full h-64">
          <Spinner color="var(--color-brand-700)" />
        </div>
      ) : error ? (
        <ApiErrorState
          kind={error.kind}
          message={error.message}
          onRetry={fetchData}
          entityLabel={entityLabel}
        />
      ) : visible.length === 0 ? (
        <p role="status" className="w-full rounded-card border border-ink-100 bg-surface p-5 text-center text-sm text-ink-700">No hay registros con este estado.</p>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full'>
          {visible.map((item) =>
            renderCard(item, setItems, activeTab === "verified")
          )}
        </div>
      )}
      <div className="mt-4"><BackLink href="/admin/dashboard" label="Volver al resumen" /></div>
    </div>
  );
}

export default AdminSalesListPage;