import { expect, test, type Page } from "@playwright/test";

const fight = "/bet/fixture-ufc";
const fighter = "Alba Torres";
const title = "Alba Torres vs. Bea Rivera";
const addToCart = (page: Page) => page.getByRole("button", { name: "Agregar al carrito" });
const rowRemoveButton = (page: Page, line: string) =>
  page.getByText(line, { exact: true }).locator(
    'xpath=ancestor::div[button[@aria-label="Borrar apuesta"]][1]',
  ).getByRole("button", { name: "Borrar apuesta" });
// A cart bet row is any div that directly contains a "Borrar apuesta" button
// (one such div per winner/method line, per app/user/cart/page.tsx).
const cartRows = (page: Page) =>
  page.locator('//div[button[@aria-label="Borrar apuesta"]]');

async function pickWinner(page: Page) {
  await page.goto(fight);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Elegir Empate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "KO/TKO" })).toHaveCount(0);
  await page.getByRole("button", { name: `Elegir ${fighter}` }).click();
  await expect(page.getByRole("region", { name: /Agrega un boleto de método/ })).toContainText(`${fighter} debe ganar`);
}

async function addPair(page: Page) {
  await pickWinner(page);
  await page.getByRole("button", { name: `Agregar un boleto de ${fighter}` }).click();
  const method = page.getByRole("button", { name: "KO/TKO" });
  await expect(method).toHaveAttribute("aria-pressed", "false");
  await method.click();
  await expect(method).toHaveAttribute("aria-pressed", "true");
  // The whole-peso storefront formatter rounds; checkout/Firestore retain cents.
  await expect(page.getByText("Total: $220", { exact: true })).toBeVisible();
  await addToCart(page).click();
  await expect(page).toHaveURL("/user/cart");
  await expect(page.getByText("Monto total: $220", { exact: true })).toBeVisible();
}

test("fight selections reach transfer checkout and persist as two same-fight sale lines", async ({ page, request }) => {
  await addPair(page);
  await page.reload();
  await expect(page.getByText(`Equipo: ${fighter}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Método: ${fighter} por KO/TKO`, { exact: true })).toBeVisible();
  await expect(page.getByText("Precio total: $200", { exact: true })).toBeVisible();
  await expect(page.getByText("Precio total: $20", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Pago por transferencia" }).click();
  await expect(page).toHaveURL("/checkout/transfer");
  await expect(page.getByText("Monto total $220.15", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "0000000000000000" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Completar Compra" });
  await expect(submit).toBeDisabled();
  await page.getByPlaceholder("Ingresa tu nombre completo").fill("Comprador Prueba");
  await page.getByPlaceholder("Ingresa tu número de teléfono").fill("0000000000");
  await page.getByLabel("Subir Imagen").setInputFiles({
    name: "fictional-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=", "base64"),
  });
  const [response] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === "/api/createTransferSale" && res.request().method() === "POST"),
    submit.click(),
  ]);
  const wire = response.request().postDataJSON();
  const winner = { betId: "fixture-ufc", betName: title, team: fighter, letterTeam: "A", ticketNumbers: 2, totalPrice: 200 };
  const extra = { ...winner, method: "KO_TKO", team: `${fighter} por KO/TKO`, ticketNumbers: 1, totalPrice: 20.15 };
  expect(wire.bets).toEqual([winner, extra]);
  expect(wire.raffles).toEqual([]);
  expect(wire.paymentConceptKey).toMatch(/^\d{16}$/);
  expect(wire.paymentImage).toContain(`/o/salesImages%2F${wire.paymentConceptKey}?`);
  expect(response.status(), await response.text()).toBe(200);
  const saleId = `transfer_${wire.paymentConceptKey}`;
  expect(await response.json()).toMatchObject({ saleBetId: saleId, saleId: null, verified: false, duplicate: false, totalSalePrice: 220.15 });
  const readback = await request.get(`${process.env.UFC_FIXTURE_API}/__test/salesBets/${saleId}`);
  expect(readback.ok(), await readback.text()).toBe(true);
  const sale = await readback.json();
  expect(sale).toMatchObject({
    paymentMethod: "transfer", verified: false, userId: null, totalSalePrice: 220.15,
    totalBetsPrice: 220.15, paymentConceptKey: wire.paymentConceptKey, paymentImage: wire.paymentImage,
  });
  const ufcRules = { version: 1, methodPriceCents: 2015 };
  expect(sale.bets).toEqual([
    { ...winner, ufcRules }, { ...extra, team: fighter, ufcRules },
  ]);
  await expect(page).toHaveURL("/checkout/success");
  await expect(page.getByText(/Hemos registrado tu compra por transferencia/)).toBeVisible();
  await page.getByRole("link", { name: "Ir a inicio" }).click();
  await expect(page).toHaveURL("/user/cart");
  await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
});

test("removing the optional method leaves the winner; removing the winner drops both", async ({ page }) => {
  await addPair(page);
  const remove = page.getByRole("button", { name: "Borrar apuesta" });
  const methodRow = cartRows(page).filter({ hasText: `Método: ${fighter} por KO/TKO` });
  await methodRow.filter({ hasNot: page.getByText(`Equipo: ${fighter}`, { exact: true }) }).filter({ has: remove }).last().getByRole("button", { name: "Borrar apuesta" }).click();
  await expect(remove).toHaveCount(1);
  await expect(page.getByText("Monto total: $200", { exact: true })).toBeVisible();
  await page.reload();
  await expect(remove).toHaveCount(1);
  await addPair(page);
  await cartRows(page).filter({ has: page.getByText(`Equipo: ${fighter}`, { exact: true }), hasNot: page.getByText(`Método: ${fighter} por KO/TKO`, { exact: true }) }).last().getByRole("button", { name: "Borrar apuesta" }).click();
  await page.reload();
  await expect(remove).toHaveCount(0);
  await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
});

test("legacy fight still offers a draw and has no method market", async ({ page }) => {
  await page.goto("/bet/fixture-legacy");
  await page.getByRole("button", { name: "Elegir Empate" }).click();
  await expect(page.getByRole("button", { name: "KO/TKO" })).toHaveCount(0);
  await addToCart(page).click();
  await expect(page).toHaveURL("/user/cart");
  await expect(page.getByText("Equipo: Empate", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Borrar apuesta" })).toHaveCount(1);
});
