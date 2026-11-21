const assert = require("node:assert/strict");
const { test } = require("node:test");
const { settleUfcMarket } = require("../lib/ufcSettlement.js");

const base = (id, side, quantity = 1) => ({ id, pick: { side }, quantity });
const method = (id, side, method, quantity = 1) => ({ id, pick: { side, method }, quantity });
const winner = (side, method) => ({ kind: "WINNER", side, method });
const settle = (result, overrides = {}) => settleUfcMarket({
  ufcRules: { version: 1, methodPriceCents: 201 },
  basePriceCents: 501,
  frozenFeeBps: 1000,
  baseEntries: [base("a", "A", 2), base("b", "B")],
  methodEntries: [method("a", "A", "SUBMISSION"), method("c", "A", "KO_TKO", 3), method("b", "B", "KO_TKO")],
  result,
  ...overrides,
});

const line = (id, kind, amountCents) => ({ id, kind, amountCents });

test("pays the base winner independently of the exact winner and method", () => {
  const { base, method } = settle(winner("A", "KO_TKO"));
  assert.deepEqual(base, {
    status: "SETTLED", stakeCents: 1503, feeCents: 151, breakageCents: 0, owedCents: 1352,
    obligations: [line("a", "PAYOUT", 1352), line("b", "LOSS", 0)],
  });
  assert.deepEqual(method, {
    status: "SETTLED", stakeCents: 1005, feeCents: 101, breakageCents: 1, owedCents: 903,
    obligations: [line("a", "LOSS", 0), line("c", "PAYOUT", 903), line("b", "LOSS", 0)],
  });
});

const refund = (status, stakeCents, obligations) => ({
  status, stakeCents, feeCents: 0, breakageCents: 0, owedCents: stakeCents, obligations,
});
const methodRefunds = [line("a", "REFUND", 201), line("c", "REFUND", 603), line("b", "REFUND", 201)];

for (const [kind, status] of [["DRAW", "REFUND_DRAW"], ["VOID", "REFUND_VOID"]]) {
  test(`${kind} refunds both pools in full without a fee`, () => {
    assert.deepEqual(settle({ kind }), {
      base: refund(status, 1503, [line("a", "REFUND", 1002), line("b", "REFUND", 501)]),
      method: refund(status, 1005, methodRefunds),
    });
  });
}

test("DQ with an official winner settles base and voids method", () => {
  const result = settle(winner("B", "DQ"));
  assert.deepEqual(result.base.obligations, [line("a", "LOSS", 0), line("b", "PAYOUT", 1352)]);
  assert.deepEqual(result.method, refund("REFUND_VOID", 1005, methodRefunds));
});

for (const [officialMethod, pickMethod] of [["TECHNICAL_DECISION", "DECISION"], ["TECHNICAL_SUBMISSION", "SUBMISSION"]]) {
  test(`${officialMethod} grades as ${pickMethod}`, () => {
    const result = settle(winner("A", officialMethod), { methodEntries: [method("a", "A", pickMethod)] });
    assert.deepEqual(result.method.obligations, [line("a", "PAYOUT", 180)]);
  });
}

test("an unbacked method outcome refunds only method", () => {
  const result = settle(winner("B", "DECISION"));
  assert.equal(result.base.status, "SETTLED");
  assert.deepEqual(result.method, refund("REFUND_NO_WINNER", 1005, methodRefunds));
});

test("an unbacked base outcome refunds only base", () => {
  const result = settle(winner("B", "KO_TKO"), { baseEntries: [base("a", "A", 2)] });
  assert.deepEqual(result.base, refund("REFUND_NO_WINNER", 1002, [line("a", "REFUND", 1002)]));
  assert.deepEqual(result.method.obligations, [line("a", "LOSS", 0), line("c", "LOSS", 0), line("b", "PAYOUT", 904)]);
});

test("an empty optional pool owes nothing", () => {
  const result = settle(winner("A", "KO_TKO"), { methodEntries: [] });
  assert.equal(result.base.status, "SETTLED");
  assert.deepEqual(result.method, refund("REFUND_NO_WINNER", 0, []));
});

test("uses the caller's fee exactly even near the safe centavo limit", () => {
  const result = settle(winner("A", "DECISION"), {
    baseEntries: [base("a", "A")], methodEntries: [],
    basePriceCents: Number.MAX_SAFE_INTEGER, frozenFeeBps: 1,
  });
  assert.equal(result.base.owedCents, 9006298534815516);
  assert.equal(result.base.feeCents, 900719925475);
});

for (const [label, override, message] of [
  ["legacy market", { ufcRules: undefined }, /ufcRules/],
  ["unknown rules version", { ufcRules: { version: 2, methodPriceCents: 201 } }, /ufcRules/],
  ["fractional method stake", { ufcRules: { version: 1, methodPriceCents: 1.5 } }, /methodPriceCents/],
  ["zero base stake", { basePriceCents: 0 }, /basePriceCents/],
  ["missing fee", { frozenFeeBps: undefined }, /frozenFeeBps/],
  ["full take", { frozenFeeBps: 10000 }, /frozenFeeBps/],
  ["fractional quantity", { baseEntries: [base("a", "A", 1.5)] }, /quantity/],
  ["duplicate entry IDs", { baseEntries: [base("a", "A"), base("a", "B")] }, /entry id/],
  ["draw pick", { baseEntries: [base("a", "C")] }, /base pick/],
  ["missing method pick", { methodEntries: [base("a", "A")] }, /method pick/],
  ["unrecognized official result", { result: { kind: "PENDING" } }, /official result/],
  ["unrecognized official method", { result: winner("A", "OTHER") }, /official result/],
  ["overflowing pool total", { basePriceCents: Number.MAX_SAFE_INTEGER, baseEntries: [base("a", "A"), base("b", "B")] }, /pool stake/],
]) {
  test(`rejects ${label} instead of returning obligations`, () => {
    assert.throws(() => settle(winner("A", "KO_TKO"), override), message);
  });
}
