import { test } from "@playwright/test";

/**
 * Screenshot capture for the completed audit work.
 * Runs against the same mock as storefront.spec.ts. Images land in
 * screenshots/ and are sent to Telegram; not committed.
 */
const OUT = "screenshots";

test.describe("audit change screenshots", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("storefront", async ({ page }) => {
    await page.goto("/rifas");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/01-storefront-mobile.png`, fullPage: true });
  });

  test("raffle detail + ticket picker", async ({ page }) => {
    await page.goto("/raffle/mock-raffle-1");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/02-raffle-detail-mobile.png`, fullPage: true });
  });

  test("bets page (storefront card recipe)", async ({ page }) => {
    await page.goto("/bet");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/03-bets-page-mobile.png`, fullPage: true });
  });

  test("cart page", async ({ page }) => {
    await page.goto("/user/cart");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/04-cart-mobile.png`, fullPage: true });
  });
});
