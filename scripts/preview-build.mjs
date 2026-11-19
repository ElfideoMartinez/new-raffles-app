// Prepare only: create a static Hosting artifact, never invoke Firebase.
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const ts = require('typescript');
const shared = [
  'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts', 'app/globals.css',
  'app/admin/AdminNavigation.tsx', 'app/admin/sections.ts',
  'app/admin/dashboard/DashboardView.tsx', 'app/admin/dashboard/types.ts',
  'app/components/ThemeToggle.tsx', 'app/components/theme.ts', 'app/utils/format.ts',
];
const forbidden = /raffleapp-dbc1b|\brifasmtz\.web\.app\b|cloudfunctions\.net|\.run\.app\b|firebaseio\.com|firebasedatabase\.app|firebaseapp\.com|googleapis\.com|identitytoolkit|__FIREBASE_DEFAULTS__|mockClientUser|enableMockAuth/i;
for (const path of shared) {
  const source = join(repo, path);
  if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`Missing reviewed input: ${path}`);
  const text = readFileSync(source, 'utf8');
  if (forbidden.test(text)) throw new Error(`Live/backend marker in ${path}`);
  if (/^app\/.*\.tsx?$/.test(path)) {
    const { importedFiles } = ts.preProcessFile(text, true, true);
    for (const { fileName } of importedFiles) {
      if (['react', 'next/link', 'next/navigation'].includes(fileName)) continue;
      const target = fileName.startsWith('@/') ? fileName.slice(2) : fileName.startsWith('.') ? join(dirname(path), fileName) : '';
      if (!['', '.ts', '.tsx'].some(ext => shared.includes(target + ext))) throw new Error(`Unreviewed import in ${path}: ${fileName}`);
    }
  }
}

const scratch = join(homedir(), '.hermes/cache/scratch');
mkdirSync(scratch, { recursive: true });
const work = mkdtempSync(join(scratch, 'rifasmtz-fixture-'));
const stage = join(work, 'source');
const bundle = join(work, 'hosting');
const put = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};
const json = (path, value) => put(path, JSON.stringify(value, null, 2) + '\n');
try {
  for (const path of shared) {
    const dest = join(stage, path);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(repo, path), dest);
  }
  symlinkSync(join(repo, 'node_modules'), join(stage, 'node_modules'), 'dir');
  json(join(stage, 'package.json'), { name: 'rifasmtz-fixture-preview', private: true });
  put(join(stage, 'next.config.mjs'), `export default { output: 'export', distDir: '.next', productionBrowserSourceMaps: false, images: { unoptimized: true }, devIndicators: false, experimental: { cpus: 2, workerThreads: false } };\n`);
  put(join(stage, 'app/layout.tsx'), `import Link from 'next/link';
import './globals.css';
export const metadata = { title: 'Rifas MTZ · Vista de demostración', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{if(localStorage.getItem('rmtz-theme')==='dark')document.documentElement.classList.add('dark')}catch{}"}} /></head>
    <body className="font-sans"><header className="border-b border-ink-300 bg-surface px-4 py-3 text-ink-900"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2"><Link href="/" className="font-bold">Rifas MTZ · Demostración</Link><span className="rounded-sm bg-warning-50 px-2 py-1 text-sm font-semibold text-warning-800" style={{color:'#78350f'}}>Solo lectura · Datos ficticios</span></div></header>
    <div className="mx-auto w-full max-w-7xl px-4 pb-16">{children}</div></body></html>;
}
`);
  put(join(stage, 'app/page.tsx'), `import Link from 'next/link';
export default function Home() {
  return <main className="mt-8 space-y-4 text-ink-900"><h1 className="text-3xl font-bold">Vista de demostración</h1><p>El panel usa datos ficticios. No requiere iniciar sesión y no permite modificar nada.</p>
    <Link className="focus-ring inline-flex min-h-11 items-center rounded-sm bg-brand-100 px-4 font-semibold" href="/admin/dashboard">Abrir panel de demostración</Link></main>;
}
`);
  put(join(stage, 'app/admin/layout.tsx'), `import AdminNavigation from './AdminNavigation';
export default function Layout({children}: {children: React.ReactNode}) {
  return <><AdminNavigation/><div className="mt-5">{children}</div></>;
}
`);
  put(join(stage, 'app/admin/dashboard/page.tsx'), `import DashboardView from './DashboardView';
import type { DashboardStats } from './types';
const stats: DashboardStats = {
  raffles: { confirmed: 75, pending: 9, amount: 18750, limited: false, latest: { createdAt: 1795093200000, status: 'verified', amount: 250 } },
  bets: { confirmed: 132, pending: 18, amount: 32400, limited: true, latest: { createdAt: 1795094700000, status: 'unverified', amount: 400 } },
  quick: { confirmed: 61, pending: 14, limited: false, latest: { createdAt: 1795095600000, status: 'pending' } },
};
export default function Page() { return <DashboardView stats={stats} />; }
`);
  put(join(stage, 'app/admin/[...path]/page.tsx'), `import Link from 'next/link';
import { notFound } from 'next/navigation';
import { salesSections, settingsHref } from '../sections';
const pages = new Map<string, string>();
for (const section of salesSections) for (const { href, label } of section.links) pages.set(href, label);
pages.set(settingsHref, 'Configuración');
export const dynamicParams = false;
export function generateStaticParams() { return Array.from(pages.keys(), href => ({path: href.split('/').slice(2)})); }
export default async function Page({ params }: {params: Promise<{path: string[]}>}) {
  const title = pages.get('/admin/' + (await params).path.join('/'));
  if (!title) notFound();
  return <main className="space-y-3 rounded-card bg-surface p-5 text-ink-900"><h1 className="text-2xl font-bold">{title}</h1><p className="font-semibold">Pantalla no incluida</p>
    <p>Esta ruta está desactivada en la demostración de solo lectura.</p><Link className="focus-ring inline-flex min-h-11 items-center underline" href="/admin/dashboard">Volver al resumen</Link></main>;
}
`);
  // Do not inherit NEXT_PUBLIC_*, Firebase/Google credentials, proxy settings, or .env files.
  const result = spawnSync(process.execPath, [next, 'build'], {
    cwd: stage, stdio: ['ignore', 2, 2], env: { PATH: process.env.PATH, HOME: homedir(), TMPDIR: scratch, NEXT_TELEMETRY_DISABLED: '1', CI: '1' },
  });
  if (result.status !== 0) throw result.error ?? new Error(`Static export failed (${result.status ?? result.signal})`);
  const out = join(stage, 'out');
  for (const path of ['index.html', '404.html', 'admin/dashboard.html', 'admin/dashboard.txt', 'admin/create/raffle.html']) {
    if (!existsSync(join(out, path))) throw new Error(`Missing export: ${path}`);
  }
  const allowed = /\.(?:html|txt|js|css|ico)$/;
  function inspect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (!entry.isFile() || !allowed.test(entry.name) || /\.map$|firebase|\.env|^\./i.test(entry.name) || forbidden.test(readFileSync(path, 'utf8'))) {
        throw new Error(`Unexpected or backend-linked export: ${path}`);
      }
    }
  }
  inspect(out);
  mkdirSync(bundle);
  // The Hosting directory contains only the scanned export and the single-site config.
  const { renameSync } = await import('node:fs');
  renameSync(out, join(bundle, 'out'));
  const csp = ["default-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'", "worker-src 'none'"].join('; ');
  json(join(bundle, 'firebase.json'), {
    hosting: { site: 'rifasmtz', public: 'out', cleanUrls: true, trailingSlash: false, headers: [{ source: '**', headers: [
      { key: 'Content-Security-Policy', value: csp }, { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }] },
    emulators: { hosting: { host: '127.0.0.1', port: 4399 }, ui: { enabled: false } },
  });
  rmSync(stage, { recursive: true, force: true });
  console.log(bundle);
} catch (error) {
  rmSync(work, { recursive: true, force: true });
  throw error;
}
