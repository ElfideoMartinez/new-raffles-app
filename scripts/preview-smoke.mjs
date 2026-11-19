// Read-only browser checks. Run against the Hosting emulator or an approved preview URL.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = new URL(process.env.PREVIEW_URL ?? `http://${process.env.FIREBASE_HOSTING_EMULATOR_HOST ?? '127.0.0.1:4399'}`);
assert(base.pathname === '/' && !base.search && !base.hash && !base.username && !base.password);
assert((base.protocol === 'http:' && base.hostname === '127.0.0.1') ||
  (base.protocol === 'https:' && /^rifasmtz--ui-fixture-[a-z0-9-]+\.web\.app$/.test(base.hostname)), 'Not a fixture preview URL');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ ...(existsSync(chromium.executablePath()) ? {} : existsSync(chrome) ? { executablePath: chrome } : {}) });
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const violations = [];
    await context.route('**/*', (route) => {
      const req = route.request();
      if (new URL(req.url()).origin !== base.origin || !['GET', 'HEAD'].includes(req.method())) {
        violations.push(`${req.method()} ${req.url()}`);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => violations.push(error.message));
    page.on('console', message => { if (/Content Security Policy/.test(message.text())) violations.push(message.text()); });
    let response = await page.goto(new URL('/', base).href);
    assert.equal(response.status(), 200);
    await page.getByRole('link', { name: 'Abrir panel de demostración' }).click();
    await page.waitForURL('**/admin/dashboard');
    await page.getByRole('navigation', { name: 'Secciones de administración' }).waitFor();
    await page.getByRole('region', { name: 'Rifas', exact: true }).getByText('$250', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Apuestas', exact: true }).getByText('Sin verificar', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Boletos rápidos', exact: true }).getByText('Pendiente de activar', { exact: true }).waitFor();
    const total = page.getByText('$18,750', { exact: true });
    assert.equal(await total.isVisible(), false, 'Totals should not be visible by default');
    const toggleTotals = page.getByText('Totales de ventas', { exact: true });
    await toggleTotals.click();
    await total.waitFor();
    await page.getByText('$32,400', { exact: true }).waitFor();
    await toggleTotals.click();
    await total.waitFor({ state: 'hidden' });
    response = await page.reload();
    assert.equal(response.status(), 200, 'Dashboard deep link');
    assert.match(response.headers()['content-security-policy'] ?? '', /connect-src 'self';.*form-action 'none'/);
    // Preview Hosting may replace our configured header with its own noindex.
    assert.match(response.headers()['x-robots-tag'] ?? '', /\bnoindex\b/i);
    const mode = page.getByRole('button', { name: 'Cambiar a modo oscuro' });
    await mode.click();
    await page.locator('html.dark').waitFor();
    await page.reload();
    await page.locator('html.dark').waitFor();
    await page.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('link', { name: 'Rifas', exact: true }).click();
    await page.waitForURL('**/admin/sales');
    await page.getByText('Pantalla no incluida', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Crear rifa', exact: true }).click();
    await page.waitForURL('**/admin/create/raffle');
    await page.getByText('Pantalla no incluida', { exact: true }).waitFor();
    assert.equal(await page.locator('form').count(), 0);
    assert.equal((await page.reload()).status(), 200, 'Placeholder deep link');
    assert.equal((await context.request.get(new URL('/admin/no-such-page', base).href)).status(), 404);
    assert.deepEqual(violations, []);
    await context.close();
    console.log(`Fixture preview OK at ${width}px: dashboard totals, theme persistence, navigation, deep links, 404, headers, no off-origin requests or writes`);
  }
} finally {
  await browser.close();
}
