/**
 * Client-pages verification screenshots (2026-10-25 client login task).
 * Serves from the mock-backed build; sets localStorage mockClientUser for
 * signed-in captures (NEXT_PUBLIC_ENABLE_MOCK_AUTH=1 is baked into this build).
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3111";
const OUT = "ufc-mission";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--hide-scrollbars"] });

async function newPage(width = 390) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 2 });
  return page;
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  console.log("saved", path);
}

try {
  // 1. Sidebar (hamburger menu open, signed OUT) + signed IN.
  let page = await newPage(390);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 45000 });
  await page.click('button[aria-label="Abrir menu"]');
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "client-sidebar-anonymous");

  await page.evaluate(() => {
    localStorage.setItem("mockClientUser", JSON.stringify({ uid: "mock-uid-1", email: "cliente@correo.com" }));
    localStorage.setItem("purchases", JSON.stringify([
      { date: "2026-10-20T18:30:00.000Z", raffles: [{ raffleId: "legacy-1", raffleName: "Rifa anterior (sin cuenta)", ticketNumbers: [3, 8], raffleTotalPrice: 200 }] },
    ]));
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 45000 });
  await page.click('button[aria-label="Abrir menu"]');
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "client-sidebar-logged-in");

  // 2. Login page.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 45000 });
  await shot(page, "client-login");

  // 3. Mis compras (populated: server purchases + legacy fallback).
  await page.evaluate(() => {
    localStorage.setItem("mockClientUser", JSON.stringify({ uid: "mock-uid-1", email: "cliente@correo.com" }));
    localStorage.setItem("purchases", JSON.stringify([
      { date: "2026-10-20T18:30:00.000Z", raffles: [{ raffleId: "legacy-1", raffleName: "Rifa anterior (sin cuenta)", ticketNumbers: [3, 8], raffleTotalPrice: 200 }] },
    ]));
  });
  await page.goto(`${BASE}/user/my-purchases`, { waitUntil: "networkidle0", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "client-compras-populated");

  // 3b. Mis compras empty (no server purchases, no legacy).
  await page.evaluate(() => {
    localStorage.setItem("mockClientUser", JSON.stringify({ uid: "mock-uid-2", email: "nuevo@correo.com" }));
    localStorage.removeItem("purchases");
  });
  await page.goto(`${BASE}/user/my-purchases`, { waitUntil: "networkidle0", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "client-compras-empty");

  // 4. Notificaciones settings (signed in).
  await page.evaluate(() => {
    localStorage.setItem("mockClientUser", JSON.stringify({ uid: "mock-uid-1", email: "cliente@correo.com" }));
  });
  await page.goto(`${BASE}/user/notificaciones`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 6000));
  await shot(page, "client-notificaciones");

  await page.close();
} finally {
  await browser.close();
}
console.log("done");