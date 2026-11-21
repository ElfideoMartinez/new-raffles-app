#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
stage=$(mktemp -d "${TMPDIR:?}/ufc-platform.XXXXXX")
printf '%s\n' "$stage"
mkdir -p "$stage/app/ufc-preview" "$stage/app/components" "$stage/app/utils"
cp "$repo"/app/ufc-preview/page.tsx "$stage/app/ufc-preview/"
cp "$repo"/app/components/UfcTicketBuilder.tsx "$stage/app/components/"
cp "$repo"/app/utils/format.ts "$stage/app/utils/"
cp "$repo"/app/globals.css "$stage/app/"
cp "$repo"/{package.json,tsconfig.json,tailwind.config.ts,postcss.config.mjs} "$stage/"
ln -s "$repo/node_modules" "$stage/node_modules"
cd "$stage"
python3 - <<'PY'
from pathlib import Path
import json
files={
'next.config.mjs': 'export default {output:"export",trailingSlash:true,experimental:{cpus:2}};',
'app/layout.tsx': '''import "./globals.css";
export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="es-MX" className="dark"><body><header className="border-b border-ink-300 bg-surface text-ink-900"><div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3"><a href="/" className="flex min-h-11 items-center text-lg font-bold">Rifas Mtz</a><span className="text-sm text-ink-700">Vista de prueba</span></div></header><div className="px-4 pb-8">{children}</div></body></html>;
}''',
'app/page.tsx': '''import Link from "next/link";
export default function PreviewStorefront(){return <main className="mx-auto max-w-xl py-6 text-ink-900"><p className="text-xs font-bold uppercase tracking-widest text-brand-700">Rifas Mtz · Vista de prueba</p><h1 className="mb-5 mt-1 text-3xl font-bold">Apuestas UFC</h1><article className="rounded-2xl border border-ink-300 bg-surface p-5"><p className="text-sm text-ink-700">Pelea ficticia · Sin dinero real</p><h2 className="my-1 text-xl font-bold">Alex Rivera vs. Nico Santos</h2><p className="mb-4 text-sm text-ink-700">Elige al ganador y, si quieres, agrega un boleto de método.</p><Link href="/ufc-preview/" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-on-brand">Ver pelea de prueba</Link></article></main>;}''',
'firebase.json':json.dumps({'hosting':{'site':'rifasmtz','public':'out','ignore':['**/.*'],'headers':[{'source':'**','headers':[{'key':'X-Robots-Tag','value':'noindex, nofollow'},{'key':'X-Content-Type-Options','value':'nosniff'},{'key':'Referrer-Policy','value':'no-referrer'},{'key':'Content-Security-Policy','value':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}]}]}})
}
for path, text in files.items(): Path(path).write_text(text+'\n')
PY
NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build
# Fail closed if any live services accidentally become part of the export.
if rg -il --glob '*.js' --glob '*.html' 'googleapis\.com|firebaseio\.com|cloudfunctions\.net|rifasmtz\.web\.app|stripe\.com' out; then exit 1; fi
printf 'PREVIEW_BUILD=%s\n' "$stage"
