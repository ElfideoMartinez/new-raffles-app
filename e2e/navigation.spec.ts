import { expect, test } from "@playwright/test";

test.describe("primary navigation", () => {
  test("opens accessibly and moves between raffles and bets on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rifas");

    const menuButton = page.locator('button[aria-controls="main-navigation"]');
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();

    const navigation = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(navigation.getByRole("link", { name: "Rifas activas" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Apuestas" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Mis compras" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Notificaciones" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Contacto" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Rascadito Rápido" })).toBeVisible();

    await navigation.getByRole("link", { name: "Apuestas" }).click();
    await expect(page).toHaveURL(/\/bet$/);
    await expect(page.getByRole("heading", { name: "Apuestas" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);

    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Rifas activas" }).click();
    await expect(page).toHaveURL(/\/rifas$/);
    await expect(page.getByRole("heading", { name: "Rifas activas" })).toBeVisible();

    await page.getByRole("link", { name: "Ver carrito" }).click();
    await expect(page).toHaveURL(/\/user\/cart$/);
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("bets list fits a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/bet");
    await expect(page.getByRole("heading", { name: "Apuestas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Mock Bet — Closing Soon/ })).toBeVisible();

    const { viewport, scrollWidth } = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport).toBe(320);
    expect(scrollWidth).toBeLessThanOrEqual(viewport);
  });

  test("Escape closes the menu and restores focus to its trigger", async ({ page }) => {
    await page.goto("/rifas");
    const menuButton = page.locator('button[aria-controls="main-navigation"]');
    await menuButton.click();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await expect(menuButton).toBeFocused();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  });
});
