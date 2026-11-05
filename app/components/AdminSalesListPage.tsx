"use client";
// Shared shell for the admin sales lists (/admin/sales and /admin/salesBets).
// Both pages were near-identical (same fetch, loading, tabs, error state, card
// grid) and every fix had to be applied twice. The pages now only supply the
// endpoint, list key, labels, and the card renderer; behaviour is unchanged.
import { authedApiFetch } from "@/app/config/api";
import ApiErrorState, { safeMessage, type ErrorKind } from "@/app/components/ApiErrorState";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";

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
      <h1 className="my-1">{heading}</h1>
      <div className='flex space-x-4 mb-4' role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`p-2 border-b-2 ${
              activeTab === tab.key
                ? "bg-brand-600 text-on-brand border-brand-700"
                : "bg-ink-300 text-ink-500 border-transparent"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center items-center w-full h-64">
          <FadeLoader color="var(--color-brand-700)" />
        </div>
      ) : error ? (
        <ApiErrorState
          kind={error.kind}
          message={error.message}
          onRetry={fetchData}
          entityLabel={entityLabel}
        />
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full'>
          {visible.map((item) =>
            renderCard(item, setItems, activeTab === "verified")
          )}
        </div>
      )}
      <Link href='../' className='p-2 bg-brand-600 border-white border-2 mt-4 mb-1 '>
        Volver al inicio
      </Link>
    </div>
  );
}

export default AdminSalesListPage;
