// npm --prefix functions run build && node --test functions/src/ufcCheckout.test.cjs
const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");

const documents = new Map();
const liveBets = new Map();
const mutations = [];
let beforeTransaction = () => {};
const rules = { version: 1, methodPriceCents: 2015 };
const officialSourceUrl = "https://www.ufc.com/event/ufc-999";
const frozenFeeBps = 1000;
const market = {
  title: "A vs. B",
  description: "Main event",
  date: "2099-01-01T00:00:00Z",
  pricePerTicket: 100.1,
  teams: { a: "One", b: "Two" },
};
const pilot = { ...market, ufcRules: rules, officialSourceUrl, frozenFeeBps };
const ledger = () => ({
  ufcRules: rules, cutoffMs: Date.parse(market.date), basePriceCents: 10010,
  officialSourceUrl, frozenFeeBps, teams: market.teams, orderCount: 0, reviewedCount: 0,
});
const snapshot = (value) => ({ exists: value !== undefined, data: () => value, get: (key) => value?.[key] });

function put(path, value) {
  mutations.push(path);
  documents.set(path, structuredClone(value));
}

// Exercise the actual HTTPS handlers, replacing Firebase I/O only. Unexpected
// operations (including FCM and legacy writes) have no stubs and cannot run.
function loadHandlers() {
  const firestore = Object.assign(() => ({
    collection: (name) => ({
      doc: (id) => {
        const path = `${name}/${id}`;
        return { id, path, get: async () => snapshot(documents.get(path)) };
      },
      add: async (data) => {
        if (name === "bets") put("bets/mirror", data);
        else put(`${name}/added`, data);
        return { id: name === "bets" ? "mirror" : "added" };
      },
      get: async () => {
        if (name === "salesBets") {
          return { forEach: (visit) => {
            for (const [path, value] of documents) if (path.startsWith("salesBets/")) visit(snapshot(value));
          } };
        }
        assert.equal(name, "notificationTokens", `Unexpected read: ${name}`);
        return { forEach() {} };
      },
      where: (field, operator, value) => {
        if (name === "ufcPilotOrders") {
          assert.deepEqual([field, operator], ["marketIds", "array-contains"]);
          return { limit: (limit) => ({ get: async () => ({ docs: [...documents]
            .filter(([path, data]) => path.startsWith(`${name}/`) && data.marketIds.includes(value))
            .slice(0, limit).map(([path, data]) => ({ ...snapshot(data), id: path.split("/")[1], ref: { path } })) }) }) };
        }
        assert.deepEqual([name, field, operator, value], ["tickets", "raffle_id", "==", "raffle"]);
        return { where: (field, operator, numbers) => {
          assert.deepEqual([field, operator, numbers], ["number", "in", [7]]);
          return { get: async () => ({ docs: [{ ref: { path: "tickets/seven" }, get: () => 7 }] }) };
        } };
      },
    }),
    runTransaction: async (apply) => {
      beforeTransaction();
      const writes = [];
      const result = await apply({
        get: (ref) => ref.get(),
        getAll: async (...refs) => refs.map((ref) => ({ ...snapshot(documents.get(ref.path)), ref })),
        set: (ref, data, options) => writes.push(() => put(ref.path, options?.merge ? { ...documents.get(ref.path), ...data } : data)),
        update: (ref, data) => writes.push(() => put(ref.path, { ...documents.get(ref.path), ...data })),
      });
      writes.forEach((write) => write());
      return result;
    },
  }), { FieldValue: { serverTimestamp: () => "server-time" } });
  const stubs = {
    "firebase-admin": {
      initializeApp() {}, firestore,
      auth: () => ({ verifyIdToken: async (token) => ({ uid: token, admin: token === "admin" }) }),
    },
    "firebase-admin/database": {
      getDatabase: () => ({
        ref: (path) => ({
          once: async () => ({ val: () => liveBets.get(path) ?? null }),
          set: async (data) => { mutations.push(path); liveBets.set(path, structuredClone(data)); },
          transaction: async (update) => {
            const data = update(liveBets.get(path) ?? null);
            if (data) { mutations.push(path); liveBets.set(path, data); }
            return { committed: data !== undefined, snapshot: { val: () => liveBets.get(path) ?? null } };
          },
        }),
      }),
    },
    "firebase-admin/remote-config": { getRemoteConfig: () => ({ getTemplate: async () => ({ parameters: {} }) }) },
  };
  const saved = Object.entries(stubs).map(([name, exports]) => {
    const id = require.resolve(name);
    const previous = require.cache[id];
    require.cache[id] = { exports, loaded: true };
    return [id, previous];
  });
  try { return require("../lib/index.js"); }
  finally {
    for (const [id, previous] of saved) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
  }
}

const handlers = loadHandlers();
const request = async (handler, body, { method = "POST", authorization } = {}) => {
  const res = {
    set() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { return this.json(value); },
  };
  await handlers[handler]({ method, headers: { authorization }, body }, res);
  return res;
};
const admin = { authorization: "Bearer admin" };
const concept = "1234567890123456";
const salePath = `salesBets/transfer_${concept}`;
const line = (fields = {}) => ({ betId: "fight", letterTeam: "A", ticketNumbers: 1, ...fields });
const methodLine = (fields = {}) => line({ method: "KO_TKO", ...fields });
const transfer = (bets, raffles) => request("createTransferSale", {
  name: "Test Buyer", phone: "1234567890", email: "", paymentConceptKey: concept,
  paymentImage: "https://example.test/receipt", totalBetsPrice: 1, totalSalePrice: 1, bets, raffles,
});

beforeEach(() => {
  documents.clear();
  liveBets.clear();
  mutations.length = 0;
  beforeTransaction = () => {};
  liveBets.set("bets/fight", pilot);
  documents.set("ufcPilotMarkets/fight", ledger());
});

test("transfer stores separately priced, canonical winner and method lines", async () => {
  // Public RTDB pilot metadata must not be shadowed by a stale legacy document.
  documents.set("bets/fight", { ...market, pricePerTicket: 1 });
  const response = await transfer([
    methodLine({ ticketNumbers: 3, totalPrice: 0.1, team: "Forged", ufcRules: { version: 7 } }),
    line({ totalPrice: 0.1 }),
  ]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.totalSalePrice, 160.55);
  const sale = documents.get(salePath);
  assert.equal(sale.verified, false);
  assert.equal(sale.totalBetsPrice, 160.55);
  assert.deepEqual(sale.bets, [
    { betId: "fight", betName: market.title, team: "One", letterTeam: "A", ticketNumbers: 3, totalPrice: 60.45, method: "KO_TKO", ufcRules: rules },
    { betId: "fight", betName: market.title, team: "One", letterTeam: "A", ticketNumbers: 1, totalPrice: 100.1, ufcRules: rules },
  ]);
});

test("both other version-1 methods are supported", async () => {
  const response = await transfer([line({ letterTeam: "B" }), methodLine({ letterTeam: "B", method: "SUBMISSION" }), methodLine({ letterTeam: "B", method: "DECISION" })]);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(documents.get(salePath).bets.map((entry) => entry.method), [undefined, "SUBMISSION", "DECISION"]);
});

for (const [label, picks] of [
  ["a draw on the winner market", [line({ letterTeam: "C" })]],
  ["a draw on the method market", [line(), methodLine({ letterTeam: "C" })]],
  ["a method without a winner pick", [methodLine()]],
  ["a method for a different fighter", [line({ letterTeam: "B" }), methodLine()]],
  ["a method for a different bet ID", [line({ betId: "another" }), methodLine()]],
  ["a method paired only with another method", [methodLine(), methodLine({ method: "DECISION" })]],
  ["an unknown method", [line(), methodLine({ method: "TKO" })]],
  ["a null method", [line({ method: null })]],
]) {
  test(`transfer rejects ${label}`, async () => {
    liveBets.set("bets/another", pilot);
    documents.set("ufcPilotMarkets/another", ledger());
    const response = await transfer(picks);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(mutations, []);
  });
}

for (const [label, fields] of [
  ["has closed", { date: "2000-01-01T00:00:00Z" }],
  ["has no valid cutoff", { date: "not a date" }],
  ["is finished", { isFinished: true }],
  ["has unsupported rules", { ufcRules: { ...rules, version: 2 } }],
  ["has an unsafe price multiplication", { ufcRules: { ...rules, methodPriceCents: Number.MAX_SAFE_INTEGER } }],
]) {
  test(`transfer rejects a pilot market that ${label}`, async () => {
    liveBets.set("bets/fight", { ...pilot, ...fields });
    assert.equal((await transfer([line(), methodLine({ ticketNumbers: 2 })])).statusCode, 409);
    assert.deepEqual(mutations, []);
  });
}

test("pilot cutoff is rechecked on the sale transaction attempt", async (t) => {
  const clock = t.mock.method(Date, "now", () => Date.parse("2098-12-31T23:59:59Z"));
  beforeTransaction = () => clock.mock.mockImplementation(() => Date.parse(market.date));
  assert.equal((await transfer([line(), methodLine()])).statusCode, 409);
  assert.deepEqual(mutations, []);
});

test("legacy can still buy A, B or C at the existing Firestore price but cannot buy a method", async () => {
  liveBets.set("bets/fight", market);
  documents.delete("ufcPilotMarkets/fight");
  documents.set("bets/fight", { ...market, pricePerTicket: "75" });
  assert.equal((await transfer([line(), methodLine()])).statusCode, 400);
  assert.deepEqual(mutations, []);
  assert.equal((await transfer([line(), line({ letterTeam: "B" }), line({ letterTeam: "C" })])).statusCode, 200);
  assert.deepEqual(documents.get(salePath).bets.map(({ team, totalPrice, ufcRules }) => [team, totalPrice, ufcRules]), [["One", 75, undefined], ["Two", 75, undefined], ["Empate", 75, undefined]]);
});

test("a retry cannot overwrite the original bets-only pilot order", async () => {
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  const original = documents.get(salePath);
  const retry = await transfer([line({ letterTeam: "B" })]);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.duplicate, true);
  assert.deepEqual(documents.get(salePath), original);
});

test("mixed transfer keeps raffle ticket handling and leaves pilot bets unverified", async () => {
  documents.set("raffles/raffle", { title: "Raffle", pricePerTicket: 10, numberOfTickets: 100 });
  documents.set("tickets/seven", { number: 7, sold: false });
  const response = await transfer([line(), methodLine()], [{ raffleId: "raffle", ticketNumbers: [7] }]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.totalSalePrice, 130.25);
  assert.equal(documents.get("tickets/seven").sold, true);
  assert.equal(documents.get(`sales/transfer_${concept}`).verified, true);
  assert.equal(documents.get(salePath).verified, false);
});

test("admin create persists only canonical rules to both stores and exposes them to market reads", async () => {
  const response = await request("createBet", { ...pilot, ufcRules: { ...rules, ignored: true } }, admin);
  assert.equal(response.statusCode, 200);
  const { id, firestoreId, ufcRules } = response.body.data;
  assert.deepEqual(ufcRules, rules);
  assert.deepEqual(documents.get(`bets/${firestoreId}`).ufcRules, rules);
  assert.deepEqual(liveBets.get(`bets/${id}`).ufcRules, rules);
  assert.equal(documents.get(`ufcPilotMarkets/${id}`).frozenFeeBps, frozenFeeBps);
  assert.equal(liveBets.get(`bets/${id}`).frozenFeeBps, frozenFeeBps);
  assert.deepEqual((await request("getBetData", { id })).body.betData.ufcRules, rules);
});

for (const value of [null, {}, { ...rules, version: 2 }, { ...rules, methodPriceCents: 0 }, { ...rules, methodPriceCents: 1.1 }, { ...rules, methodPriceCents: "2015" }]) {
  test(`admin create rejects malformed rules: ${JSON.stringify(value)}`, async () => {
    assert.equal((await request("createBet", { ...market, ufcRules: value }, admin)).statusCode, 400);
    assert.deepEqual(mutations, []);
  });
}

test("pilot requires a cutoff on create; legacy create does not opt in", async () => {
  assert.equal((await request("createBet", { ...pilot, date: "bad" }, admin)).statusCode, 400);
  assert.deepEqual(mutations, []);
  const response = await request("createBet", market, admin);
  assert.equal(response.statusCode, 200);
  assert.equal(Object.hasOwn(response.body.data, "ufcRules"), false);
});

test("generic market update cannot add, remove, or partially change the rules", async () => {
  for (const bet of [{ ufcRules: rules }, { ufcRules: null }, { "ufcRules/methodPriceCents": 1 }]) {
    assert.equal((await request("updateBet", { idBet: "fight", bet }, { ...admin, method: "PATCH" })).statusCode, 400);
  }
  assert.deepEqual(mutations, []);
});

test("legacy transfer writer cannot accept a pilot market or a method before any write", async () => {
  for (const bets of [[line()], [methodLine({ betId: "legacy" })]]) {
    const response = await request("checkTransfer", { raffles: [{}], bets }, admin);
    assert.equal(response.statusCode, 409);
  }
  assert.deepEqual(mutations, []);
});

test("legacy sale confirmation cannot count a pilot winner or method as legacy tickets", async () => {
  for (const bets of [[line()], [methodLine({ betId: "legacy" })], [line({ betId: "deleted", ufcRules: rules })]]) {
    documents.set(salePath, { verified: false, bets });
    assert.equal((await request("confirmRejectBetSale", { id: `transfer_${concept}`, action: "confirm" }, admin)).statusCode, 409);
  }
  assert.deepEqual(mutations, []);
});

test("legacy settlement refuses all outcomes for a pilot, including void", async () => {
  for (const result of ["A", "C", "VOID"]) {
    assert.equal((await request("settleBet", { betId: "fight", result }, admin)).statusCode, 409);
  }
  assert.deepEqual(mutations, []);
});

test("legacy settlement still refuses verified pilot lines if the market marker is missing", async () => {
  liveBets.set("bets/fight", market);
  documents.delete("ufcPilotMarkets/fight");
  documents.set(salePath, { verified: true, bets: [line({ ufcRules: rules }), methodLine()] });
  assert.equal((await request("settleBet", { betId: "fight", result: "A" }, admin)).statusCode, 409);
  assert.deepEqual(mutations, []);
});

test("legacy sale confirmation still applies the C counter", async () => {
  liveBets.set("bets/fight", { ...market, betsTeamA: 2, betsTeamB: 1, tieBets: 0, totalBets: 3 });
  documents.delete("ufcPilotMarkets/fight");
  documents.set(salePath, { verified: false, bets: [line({ letterTeam: "C", ticketNumbers: 2 })] });
  assert.equal((await request("confirmRejectBetSale", { id: `transfer_${concept}`, action: "confirm" }, admin)).statusCode, 200);
  assert.equal(documents.get(salePath).verified, true);
  assert.equal(liveBets.get("bets/fight").tieBets, 2);
  assert.equal(liveBets.get("bets/fight").totalBets, 5);
});

test("explicit pilot endpoints reject non-admins", async () => {
  for (const handler of ["verifyUfcPilotOrder", "settleUfcPilotMarket"]) {
    assert.equal((await request(handler, {})).statusCode, 401);
    assert.equal((await request(handler, {}, { authorization: "Bearer buyer" })).statusCode, 403);
  }
  assert.deepEqual(mutations, []);
});

const orderId = `transfer_${concept}`;
const review = (fields = {}) => request("verifyUfcPilotOrder", {
  orderId, action: "verify", bankReference: "TEST-BANK-001", receivedCents: 12025, ...fields,
}, admin);
const settle = (fields = {}) => request("settleUfcPilotMarket", {
  betId: "fight", result: { kind: "DRAW" }, officialSourceUrl, ...fields,
}, admin);
const advanceToCutoff = (t) => t.mock.method(Date, "now", () => Date.parse(market.date));

test("only trusted checkout orders can be verified, with bank evidence for the full amount", async () => {
  documents.set(salePath, { verified: false, paymentMethod: "transfer", bets: [line({ ufcRules: rules })] });
  assert.equal((await review()).statusCode, 404);
  documents.delete(salePath);
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  assert.equal((await review({ receivedCents: 10010 })).statusCode, 409);
  assert.equal((await review()).statusCode, 200);
  assert.equal(documents.get(salePath).verified, true);
  const count = mutations.length;
  assert.equal((await review()).body.duplicate, true);
  assert.equal((await review({ bankReference: "TEST-BANK-002" })).statusCode, 409);
  assert.equal(mutations.length, count);
});

test("settlement requires cutoff, the pinned official source, and resolved orders", async (t) => {
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  assert.equal((await settle()).statusCode, 409);
  const count = mutations.length;
  advanceToCutoff(t);
  assert.equal((await review()).statusCode, 409);
  assert.equal((await settle({ officialSourceUrl: "https://www.ufc.com/event/another" })).statusCode, 409);
  assert.equal((await settle()).statusCode, 409);
  assert.equal(mutations.length, count);
  assert.equal((await review({ action: "reject", noFundsOutstanding: true, reason: "No payment received" })).statusCode, 200);
  assert.equal((await settle()).statusCode, 200);
  assert.equal(documents.get(salePath).ufcSettlements, undefined);
});

test("settlement grades both lines independently, persists pending obligations, and is idempotent", async (t) => {
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  assert.equal((await review()).statusCode, 200);
  advanceToCutoff(t);
  const result = { kind: "WINNER", side: "A", method: "DQ" };
  assert.equal((await settle({ result })).statusCode, 200);
  const stored = documents.get(salePath).ufcSettlements.fight;
  assert.deepEqual(stored.lines, [
    { lineIndex: 0, pool: "base", kind: "PAYOUT", amountCents: 9009, transferStatus: "PENDING" },
    { lineIndex: 1, pool: "method", kind: "REFUND", amountCents: 2015, transferStatus: "PENDING" },
  ]);
  const count = mutations.length;
  assert.equal((await settle({ result })).body.alreadySettled, true);
  assert.equal((await settle()).statusCode, 409);
  assert.equal(mutations.length, count);
  assert.equal(documents.get(salePath).payoutStatus, undefined);
});

test("checkout refuses unfrozen or drifted pilot terms and refuses legacy fallback", async () => {
  liveBets.set("bets/fight", { ...pilot, teams: { a: "Two", b: "One" } });
  assert.equal((await transfer([line()])).statusCode, 409);
  liveBets.set("bets/fight", market);
  assert.equal((await transfer([line()])).statusCode, 409);
  liveBets.set("bets/fight", pilot);
  documents.delete("ufcPilotMarkets/fight");
  assert.equal((await transfer([line()])).statusCode, 409);
  assert.deepEqual(mutations, []);
});

test("pilot market creation requires an explicit valid fee and a pinned official event URL", async () => {
  for (const fields of [{ frozenFeeBps: undefined }, { frozenFeeBps: 10000 }, { frozenFeeBps: "1000" },
    { officialSourceUrl: "https://www.ufc.com.example.test/event/ufc-999" }]) {
    assert.equal((await request("createBet", { ...pilot, ...fields }, admin)).statusCode, 400);
  }
  assert.deepEqual(mutations, []);
});

test("generic mutations cannot change or delete a frozen market", async () => {
  assert.equal((await request("updateBet", { idBet: "fight", bet: { pricePerTicket: 1, date: "2100-01-01" } },
    { ...admin, method: "PATCH" })).statusCode, 409);
  assert.equal((await request("deleteBet", { idBet: "fight" }, { ...admin, method: "DELETE" })).statusCode, 409);
  assert.deepEqual(mutations, []);
});

test("verification cannot reuse a bank reference across orders", async () => {
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  assert.equal((await review()).statusCode, 200);
  const otherConcept = "1234567890123457";
  assert.equal((await request("createTransferSale", {
    name: "Other Buyer", phone: "1234567890", paymentConceptKey: otherConcept,
    paymentImage: "https://example.test/receipt", bets: [line(), methodLine()],
  })).statusCode, 200);
  assert.equal((await review({ orderId: `transfer_${otherConcept}` })).statusCode, 409);
  assert.equal(documents.get(`salesBets/transfer_${otherConcept}`).verified, false);
});

test("verified flag alone or tampered sale lines cannot enter the trusted pool", async (t) => {
  assert.equal((await transfer([line(), methodLine()])).statusCode, 200);
  documents.set("salesBets/transfer_2234567890123456", { verified: true, bets: [line({ ticketNumbers: 999 })] });
  assert.equal((await review()).statusCode, 200);
  advanceToCutoff(t);
  const original = documents.get(salePath);
  documents.set(salePath, { ...original, bets: [line({ ticketNumbers: 999 })] });
  assert.equal((await settle()).statusCode, 409);
  assert.equal(documents.get("ufcPilotMarkets/fight").settlement, undefined);
  documents.set(salePath, original);
  const result = await settle();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.pools.base.stakeCents, 10010);
});
