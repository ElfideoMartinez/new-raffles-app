import { expect, test } from "@playwright/test";

/**
 * Storefront smoke against the local mock (mock/server.mjs).
 *
 * The assertions encode what the fixture guarantees, not production data:
 * two raffles, one active and one sold out. The sold-out card must not offer a
 * way in — that was a real defect (the badge said "Agotada" while the teal
 * "Ver Rifa" CTA stayed clickable).
 */
test.describe("storefront renders mock fixture data", () => {
  test("shows the active raffle with price, progress and tickets left", async ({
    page,
  }) => {
    await page.goto("/");

    const active = page.locator("article", {
      has: page.getByRole("heading", { name: /Player A vs Player B/ }),
    });
    await expect(active).toBeVisible();

    await expect(active.getByText("363 restantes")).toBeVisible();
    await expect(active.getByText("137 de 500 vendidos")).toBeVisible();
    await expect(active.getByText("27%")).toBeVisible();
    await expect(active.getByText("$100")).toBeVisible();
    await expect(active.getByRole("link", { name: "Ver Rifa" })).toBeVisible();
  });

  test("sold-out raffle shows Agotada and offers no link", async ({ page }) => {
    await page.goto("/");

    const soldOut = page.locator("article", {
      has: page.getByRole("heading", { name: /Finished Example/ }),
    });
    await expect(soldOut).toBeVisible();
    await expect(soldOut.getByText("Agotada")).toHaveCount(2);
    // The disabled control is a <span>, so it must not be a link at all.
    await expect(soldOut.getByRole("link")).toHaveCount(0);
  });

  test("Ver Rifa navigates to the raffle detail page", async ({ page }) => {
    await page.goto("/");

    const active = page.locator("article", {
      has: page.getByRole("heading", { name: /Player A vs Player B/ }),
    });
    await active.getByRole("link", { name: "Ver Rifa" }).click();

    await expect(page).toHaveURL(/\/raffle\/mock-raffle-1$/);
    await expect(
      page.getByText(/Player A vs Player B — Mock Prize/)
    ).toBeVisible();
  });
});

test.describe("layout has no horizontal overflow", () => {
  for (const width of [320, 390]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.locator("article")).toHaveCount(2);

      const { viewport, scrollWidth } = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(viewport).toBe(width);
      expect(scrollWidth).toBeLessThanOrEqual(viewport);
    });
  }
});
