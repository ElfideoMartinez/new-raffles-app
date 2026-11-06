"use client";
// Root page — a redirect to the configured default home.
//
// Before (2026-11-06): `/` was the raffles listing. Daniel wanted the root to
// land wherever the admin decides, so the raffles listing moved to /rifas and
// this page now forwards to appConfig/general.defaultHome (default /bet). The
// configured value is read live via useGeneralConfig (starts on the default so
// the redirect is immediate, then re-fires if a stored value differs).
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGeneralConfig } from "@/app/config/general";

export default function Home() {
  const router = useRouter();
  const { defaultHome } = useGeneralConfig();

  useEffect(() => {
    // The resolved landing is always non-"/" (a configured home, or /rifas as
    // the fallback), so this page can never redirect to itself.
    const target =
      defaultHome && defaultHome !== "/" ? defaultHome : "/rifas";
    router.replace(target);
  }, [defaultHome, router]);

  return (
    <p role="status" className="p-6 text-center text-sm text-ink-500">
      Cargando…
    </p>
  );
}
