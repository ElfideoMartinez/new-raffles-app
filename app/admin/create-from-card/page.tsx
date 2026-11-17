"use client";
import {useEffect,useMemo,useState} from "react";
import {authedApiFetch,apiUrl} from "@/app/config/api";
import withAuth from "@/app/components/WithAuth";
import {betPayload} from "./card-selection.mjs";

type Matchup={id:string;order:number;a:string;b:string;recordA:string;recordB:string;date:string;image:string;photoLicenses?:string[]};
type Card={event:string;eventDate:string;matchups:Matchup[]};
type Pick={checked:boolean;price:string;pool:string;approved:boolean};
export default withAuth(function CreateFromCard(){
  const [card,setCard]=useState<Card|null>(null);
  const [error,setError]=useState("");
  const [picks,setPicks]=useState<Record<string,Pick>>({});
  const [busy,setBusy]=useState(false);
  const [results,setResults]=useState<Record<string,string>>({});
  useEffect(()=>{fetch('/bet-cards/latest.json',{cache:'no-store'}).then(async res=>{if(!res.ok)throw new Error('No hay card preparado; genera los datos y despliega los assets primero.');return res.json()}).then((c:Card)=>{setCard(c);setPicks(Object.fromEntries(c.matchups.map(m=>[m.id,{checked:false,price:'50',pool:'0',approved:false}])))}).catch(e=>setError(String(e.message)));},[]);
  const selected=useMemo(()=>card?.matchups.filter(m=>picks[m.id]?.checked)??[],[card,picks]);
  const setPick=(id:string,change:Partial<Pick>)=>setPicks(old=>({...old,[id]:{...old[id],...change}}));
  const publish=async()=>{
    if(!card||!selected.length)return;
    setError("");
    const payloads=[];
    try{for(const m of selected)payloads.push(betPayload(card,{id:m.id,...picks[m.id]}));}catch(e){setError(e instanceof Error?e.message:String(e));return;}
    if(!window.confirm(`Crear ${payloads.length} apuesta(s) en la base de datos activa? Revisa nombres, horarios, imagen, derechos, precio y pool antes de confirmar.`))return;
    setBusy(true);
    try{
      // Recheck public bets before submitting; the server independently enforces sourceKey uniqueness.
      const existing=await fetch(apiUrl('getAllBets'));
      if(!existing.ok)throw new Error('No se pudieron comprobar apuestas existentes. Ninguna creada.');
      const data=await existing.json();
      const keys=new Set((data.result??[]).map((b:{sourceKey?:string})=>b.sourceKey));
      for(const payload of payloads){
        if(keys.has(payload.sourceKey)){setResults(old=>({...old,[payload.sourceKey]:'Ya existe · omitida'}));continue;}
        try{
          const response=await authedApiFetch('createBet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.message??`HTTP ${response.status}`);}
          const created=await response.json();
          setResults(old=>({...old,[payload.sourceKey]:`Creada · ${created.data?.id??'respuesta recibida'}`}));
          keys.add(payload.sourceKey);
        }catch(e){setResults(old=>({...old,[payload.sourceKey]:`Error · ${e instanceof Error?e.message:String(e)}`}));}
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  };
  return <main className="mx-auto max-w-5xl p-4 text-ink-900"><h1 className="text-2xl font-bold">Crear desde cartelera</h1><p className="my-3 text-ink-600">Selecciona enfrentamientos, revisa fuentes e imagen y aprueba cada apuesta. Nada se crea al preparar la cartelera.</p>{error&&<p role="alert" className="my-3 rounded-card border border-danger-500 p-3">{error}</p>}{!card&&!error&&<p role="status">Cargando cartelera…</p>}{card&&<><h2 className="text-xl font-bold">{card.event} · {card.eventDate}</h2><p className="my-3 text-sm text-ink-600">Imagen y fotos oficiales UFC: referencia © UFC; confirmar derechos de uso antes de publicar. Los horarios pueden cambiar.</p><div className="grid gap-4">{card.matchups.map(m=><article key={m.id} className="rounded-card border border-ink-200 bg-surface p-4"><label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={picks[m.id]?.checked??false} onChange={e=>setPick(m.id,{checked:e.target.checked,approved:false})}/> {m.order+1}. {m.a} vs. {m.b}</label><p className="text-sm text-ink-600">Récords {m.recordA} · {m.recordB} · {new Date(m.date).toLocaleString('es-MX',{timeZone:'America/Chihuahua'})} Chihuahua</p><img src={m.image} alt={`Vista previa ${m.a} vs. ${m.b}`} className="mt-3 h-48 max-w-full rounded-sm object-contain"/><div className="mt-4 grid gap-3 sm:grid-cols-2"><label>Precio por boleto ($)<input aria-label={`Precio ${m.a} vs. ${m.b}`} type="number" min="1" step="0.01" value={picks[m.id]?.price??'50'} onChange={e=>setPick(m.id,{price:e.target.value,approved:false})} className="mt-1 min-h-11 w-full rounded-sm border border-ink-300 bg-surface p-2"/></label><label>Pool inicial total ($)<input aria-label={`Pool ${m.a} vs. ${m.b}`} type="number" min="0" step="0.01" value={picks[m.id]?.pool??'0'} onChange={e=>setPick(m.id,{pool:e.target.value,approved:false})} className="mt-1 min-h-11 w-full rounded-sm border border-ink-300 bg-surface p-2"/></label></div><label className="mt-4 flex min-h-11 items-center gap-2"><input type="checkbox" checked={picks[m.id]?.approved??false} onChange={e=>setPick(m.id,{approved:e.target.checked})}/> Verifiqué pelea, hora, precio, imagen y derechos</label>{results[m.id]&&<p role="status" className="font-semibold">{results[m.id]}</p>}</article>)}</div><button type="button" disabled={busy||!selected.length} onClick={publish} className="mt-5 min-h-11 rounded-pill bg-brand-600 px-6 font-semibold text-on-brand disabled:opacity-50">{busy?'Creando…':`Crear ${selected.length} apuesta(s) seleccionada(s)`}</button></>}</main>;
});
