"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClientAuth } from "../components/clientAuth";
import AdminNavigation from "./AdminNavigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading } = useClientAuth();

  useEffect(() => {
    if (pathname === "/admin" || loading || isAdmin) return;
    router.replace(user ? "/" : "/admin");
  }, [pathname, loading, isAdmin, user, router]);

  if (pathname === "/admin") return children;
  if (loading) return <p role="status" className="p-6 text-center text-sm text-ink-700">Cargando…</p>;
  if (!isAdmin) return null;

  return (
    <>
      <AdminNavigation />
      <div className="pt-5">{children}</div>
    </>
  );
}
