import { expect, test } from "@playwright/test";

test("a signed-out dashboard deep link redirects to the admin login", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones de administración" })).toHaveCount(0);
});
