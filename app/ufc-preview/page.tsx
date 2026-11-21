import type { Metadata } from "next";
import UfcTicketBuilder from "@/app/components/UfcTicketBuilder";

export const metadata: Metadata = {
  title: "Ganador + método | Rifas Mtz",
  robots: { index: false, follow: false },
};

export default function UfcPreviewPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 py-5 text-ink-900">
      <header>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-700">UFC · Pelea de prueba · Sin dinero real</p>
        <h1 className="text-3xl font-bold tracking-tight">Ganador + método</h1>
        <p className="mt-2 text-sm text-ink-700">Si hay empate oficial, se devuelve el importe de cada boleto, sin comisión. Precios en MXN.</p>
      </header>
      <UfcTicketBuilder />
    </main>
  );
}
