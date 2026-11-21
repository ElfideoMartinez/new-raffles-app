"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/app/utils/format";

const fighters = ["Alex Rivera", "Nico Santos"] as const;
const methods = ["KO/TKO", "Sumisión", "Decisión"] as const;
const basePrice = 50;
const methodPrice = 20;
const panel = "rounded-2xl border border-ink-300 bg-surface p-4 sm:p-5";
const button = "min-h-11 rounded-xl border border-ink-300 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50";
const active = "border-brand-600 bg-brand-600 text-on-brand";

export default function UfcTicketBuilder() {
  const [winner, setWinner] = useState<(typeof fighters)[number] | null>(null);
  const [method, setMethod] = useState<(typeof methods)[number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<"pick" | "cart" | "pending" | "refunded">("pick");
  const heading = useRef<HTMLHeadingElement>(null);
  const firstPick = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (!interacted.current) return;
    if (step === "pick") firstPick.current?.focus();
    else heading.current?.focus();
  }, [step]);
  const total = winner ? basePrice + (method ? methodPrice : 0) : 0;
  const rows = winner ? [
    { label: `Ganador · ${winner}`, price: basePrice },
    ...(method ? [{ label: `Método · ${winner} por ${method}`, price: methodPrice }] : []),
  ] : [];
  const go = (next: typeof step) => { interacted.current = true; setStep(next); };
  function reset() { setWinner(null); setMethod(null); setExpanded(false); go("pick"); }

  return (
    <div className="space-y-3">
      {step === "pick" ? <>
        <section className={panel} aria-labelledby="winner-heading">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-500">01 · Boleto ganador</p>
          <h2 id="winner-heading" className="mb-3 mt-1 text-lg font-bold">¿Quién gana? · {formatPrice(basePrice)}</h2>
          <div className="grid grid-cols-2 gap-2">
            {fighters.map((fighter, index) => <button type="button" key={fighter} ref={index === 0 ? firstPick : undefined} aria-label={`Elegir ${fighter}`} aria-pressed={winner === fighter} className={`${button} ${winner === fighter ? active : ""}`} onClick={() => {
              if (fighter !== winner) { setWinner(fighter); setExpanded(false); setMethod(null); }
            }}>{fighter}</button>)}
          </div>
        </section>
        <section className={panel} aria-labelledby="method-heading">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-500">02 · Boleto opcional</p>
          <h2 id="method-heading" className="mt-1 text-lg font-bold">¿Cómo gana?</h2>
          <p className="mb-3 mt-1 text-sm text-ink-700">{winner ? `Boleto separado: ${winner} debe ganar por el método elegido.` : "Elige al ganador para agregar un método."}</p>
          <button type="button" className={button} disabled={!winner} aria-expanded={expanded} aria-controls="ufc-methods" onClick={() => { setExpanded(!expanded); setMethod(null); }}>
            {expanded ? "Quitar método" : `Agregar método · +${formatPrice(methodPrice)}`}
          </button>
          <div id="ufc-methods" hidden={!expanded} role="group" aria-label="Método de victoria" className={expanded ? "mt-3 flex flex-wrap gap-2" : ""}>
            {methods.map((value) => <button type="button" key={value} className={`${button} ${method === value ? active : ""}`} aria-pressed={method === value} onClick={() => setMethod(value)}>{value}</button>)}
          </div>
        </section>
        <section className={panel} aria-label="Total de la selección">
          <div className="mb-3 flex items-center justify-between" aria-live="polite"><span>{rows.length ? `${rows.length} ${rows.length === 1 ? "boleto" : "boletos"}` : "Sin boletos"}</span><strong data-testid="stake" className="text-xl tabular-nums">{formatPrice(total)}</strong></div>
          <button type="button" disabled={!winner || (expanded && !method)} className={`${button} ${active} w-full`} onClick={() => go("cart")}>Agregar al carrito</button>
        </section>
      </> : <section className={panel}>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-500">{step === "cart" ? "Carrito de prueba" : "Mis compras · Simulación"}</p>
        <h2 ref={heading} tabIndex={-1} className="mt-1 text-xl font-bold">{step === "cart" ? "Tus boletos" : "Empate oficial"}</h2>
        {step !== "cart" && <p role="status" className="mt-1 font-semibold">{step === "refunded" ? "Reembolsado" : "Reembolso pendiente"}</p>}
        <p className="mt-1 text-sm text-ink-700">{step === "cart" ? "No se cobrará nada. Cada boleto se liquida por separado." : step === "pending" ? "Aún no se ha enviado la transferencia." : "Transferencia confirmada en esta simulación."}</p>
        <ul className="my-3 divide-y divide-ink-300" data-testid={step === "cart" ? "cart-lines" : "refund-lines"}>
          {rows.map(({label, price}) => <li key={label} className="flex justify-between gap-3 py-2 text-sm"><span>{label}</span><strong>{formatPrice(price)}</strong></li>)}
        </ul>
        <div className="flex justify-between gap-3 border-t border-ink-300 pt-3"><span>{step === "cart" ? "Total de prueba" : "Reembolso sin comisión"}</span><strong data-testid={step === "cart" ? "cart-total" : "refund"} className="tabular-nums">{formatPrice(total)}</strong></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {step === "cart" ? <><button type="button" className={button} onClick={() => go("pick")}>Editar selección</button><button type="button" className={`${button} ${active}`} onClick={() => go("pending")}>Simular empate oficial</button></> : <>
            {step === "pending" && <button type="button" className={`${button} ${active}`} onClick={() => go("refunded")}>Simular transferencia confirmada</button>}
            <button type="button" className={button} onClick={reset}>Volver a probar</button>
          </>}
        </div>
      </section>}
    </div>
  );
}
