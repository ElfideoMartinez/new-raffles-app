const assert = require("node:assert/strict");
const { test } = require("node:test");

function routeSettlementTokens(roster, sales) {
  const tokensByUser = new Map();
  for (const row of roster) {
    if (typeof row.id !== "string" || !row.id || typeof row.token !== "string" || !row.token || row.enabled === false) continue;
    const tokens = tokensByUser.get(row.id) ?? [];
    tokens.push(row.token);
    tokensByUser.set(row.id, tokens);
  }
  return sales.flatMap((sale) => {
    const tokens = sale.userId ? tokensByUser.get(sale.userId) ?? [] : [];
    return tokens.length ? [{ saleId: sale.saleId, tokens }] : [];
  });
}

test("routes settlement pushes only to the sale owner's enabled device tokens", () => {
  const recipientTokens = ["winner-token", "winner-secondary-token"];
  const roster = [
    { id: "winner-uid", token: recipientTokens[0], enabled: true },
    { id: "winner-uid", token: recipientTokens[1], enabled: true },
    { id: "another-user", token: "other-user-token", enabled: true },
    { id: "winner-uid", token: "paused-token", enabled: false },
  ];
  const sales = [
    { userId: "winner-uid", saleId: "sale-1" },
    { userId: null, saleId: "anonymous-sale" },
    { userId: "unregistered", saleId: "no-token-sale" },
  ];
  assert.deepEqual(routeSettlementTokens(roster, sales), [
    { saleId: "sale-1", tokens: recipientTokens },
  ]);
});
