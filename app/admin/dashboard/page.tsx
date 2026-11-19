"use client";

import { useEffect, useState } from "react";
import { authedApiFetch } from "@/app/config/api";
import DashboardView from "./DashboardView";
import { isDashboardStats, type DashboardStats } from "./types";

export default function DashboardPage() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ stats?: DashboardStats; error?: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await authedApiFetch("getDashboardSales", { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setResult({ error: "Tu sesión no tiene acceso a las estadísticas. Vuelve a iniciar sesión." });
          return;
        }
        if (!response.ok) throw new Error("Dashboard sales request failed");
        const stats: unknown = await response.json();
        if (!isDashboardStats(stats)) throw new Error("Invalid dashboard sales data");
        if (!controller.signal.aborted) setResult({ stats });
      } catch {
        if (!controller.signal.aborted) setResult({ error: "No se pudieron cargar las estadísticas." });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  return <DashboardView stats={result?.stats} error={result?.error} loading={!result} onRetry={() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }} />;
}
