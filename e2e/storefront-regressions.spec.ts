import { expect, test, type BrowserContext } from "@playwright/test";

// Stub the read-only Firebase transport; no browser connection to the live DB.
// The real SDK still delivers each snapshot through the app's onValue listener.
const databaseHost = "raffleapp-dbc1b-default-rtdb.firebaseio.com";
const openBet = {
  title: "Fixture — Live Bet",
  description: "Fixture for a bet that settles while its detail is open.",
  teams: { a: "Alpha", b: "Beta" },
  betsTeamA: 40,
  betsTeamB: 25,
  tieBets: 5,
  pricePerTicket: 50,
  isFinished: false,
};

test("the bets list distinguishes an open bet from a closed bet without a result", async ({ page }) => {
  await page.goto("/bet");
  await expect(page.getByRole("link", { name: "Participar" })).toHaveAttribute("href", "/bet/mock-bet-1");
  await expect(page.getByRole("link", { name: "Ver detalles" })).toHaveAttribute("href", "/bet/mock-bet-2");
  await expect(page.getByText("Esta apuesta ha terminado")).toBeVisible();
});

async function stubBetSnapshot(context: BrowserContext, path: string, initial: object | null | "denied") {
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => route.abort());
  let publish!: (data: object | null) => void;
  await context.routeWebSocket(`wss://${databaseHost}/.ws?**`, (socket) => {
    const send = (data: unknown) => socket.send(JSON.stringify(data));
    publish = (data) => send({ t: "d", d: { a: "d", b: { p: path, d: data } } });
    socket.onMessage((raw) => {
      if (typeof raw !== "string" || raw === "0") return;
      const message = JSON.parse(raw);
      if (message.t !== "d") return;
      if (message.d.a === "q" && message.d.b.p === path) {
        if (initial === "denied") {
          send({ t: "d", d: { r: message.d.r, b: { s: "permission_denied", d: "Fixture denial" } } });
          return;
        }
        publish(initial);
      }
      send({ t: "d", d: { r: message.d.r, b: { s: "ok", d: {} } } });
    });
    send({ t: "c", d: { t: "h", d: { ts: Date.now(), v: "5", h: databaseHost, s: "fixture-session" } } });
  });

  return (data: object) => publish(data);
}

test("a live settlement blocks adding tickets already selected", async ({ page, context }) => {
  const publish = await stubBetSnapshot(context, "/bets/storefront-live-bet", openBet);
  await page.goto("/bet/storefront-live-bet");
  await expect(page.getByRole("heading", { name: openBet.title })).toBeVisible();
  await page.getByRole("button", { name: "Elegir Alpha" }).click();
  const addToCart = page.getByRole("button", { name: "Agregar al carrito" });
  await expect(addToCart).toBeEnabled();

  publish({ ...openBet, settled: true, result: "A", payoutPerTicket: 78.75 });
  await expect(page.getByText("Ganador: Alpha")).toBeVisible();
  await expect(page.getByText("Elige un resultado")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar un boleto de Alpha" })).toBeDisabled();
  await expect(addToCart).toBeHidden();
});

for (const [snapshot, heading] of [
  [null, "No encontramos esta apuesta"],
  ["denied", "No se pudo cargar la apuesta"],
] as const) {
  test(`bet detail shows a useful state for a ${snapshot ?? "missing"} snapshot`, async ({ page, context }) => {
    await stubBetSnapshot(context, "/bets/storefront-unavailable-bet", snapshot);
    await page.goto("/bet/storefront-unavailable-bet");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("status", { name: "Cargando apuesta" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Volver a Apuestas" })).toHaveAttribute("href", "/bet");
  });
}

test("long persisted bet names stay inside the cart at 320px", async ({ page, context }) => {
  await context.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 740 });
  const longName = "FixtureBet".repeat(16);
  await page.addInitScript(({ longName }) => localStorage.setItem("ticket-store", JSON.stringify({
    state: { userCartBets: [{ betId: "legacy", betName: longName, team: "Alpha", letterTeam: "A", ticketNumbers: 2, totalPrice: 100 }] },
    version: 0,
  })), { longName });
  await page.goto("/user/cart");
  const name = page.getByText(`Apuesta: ${longName}`);
  await expect(name).toBeVisible();
  await expect(page.getByText("Sin imagen")).toBeVisible();
  expect(await name.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(await name.evaluate((element) => element.clientWidth));
  await expect(page.getByRole("button", { name: "Borrar apuesta" })).toBeInViewport();
});
