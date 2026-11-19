const assert = require("node:assert/strict");
const { test } = require("node:test");

function routeSettlementTokens(roster, sales) {
  const byUser = new Map();
  for (const row of roster) {
    if (typeof row.id !== "string" || !row.id || typeof row.token !== "string" || !row.token || row.enabled === false) continue;
    const tokens = byUser.get(row.id) ?? [];
    tokens.push(row.token);
    byUser.set(row.id, tokens);
  }
  return sales.flatMap((sale) => {
    const tokens = sale.userId ? byUser.get(sale.userId) ?? [] : [];
    return tokens.length ? [{ saleId: sale.saleId, tokens }] : [];
  });
}

test("personal settlement messages route only to the matching user's enabled devices", () => {
  const roster = [
    { id: "winner", token: "winner-1", enabled: true },
    { id: "winner", token: "winner-2", enabled: true },
    { id: "other", token: "other-device", enabled: true },
    { id: "winner", token: "paused-device", enabled: false },
  ];
  const sales = [
    { userId: "winner", saleId: "sale-1" },
    { userId: null, saleId: "anonymous-sale" },
    { userId: "unregistered", saleId: "no-token-sale" },
  ];
  assert.deepEqual(routeSettlementTokens(roster, sales), [
    { saleId: "sale-1", tokens: ["winner-1", "winner-2"] },
  ]);
});
