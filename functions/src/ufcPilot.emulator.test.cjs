// firebase emulators:exec --only auth,firestore,database --project demo-ufc-pilot 'node --test functions/src/ufcPilot.emulator.test.cjs'
const assert = require("node:assert/strict");
const { test } = require("node:test");

const projectId = "demo-ufc-pilot";
const { FIRESTORE_EMULATOR_HOST, FIREBASE_DATABASE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST } = process.env;
const loopback = (host) => /^127\.0\.0\.1:\d+$/.test(host ?? "");
const enabled = [FIRESTORE_EMULATOR_HOST, FIREBASE_DATABASE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST].every(loopback) &&
  (process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT) === projectId;

test("pilot handler transactions on Firebase emulators", { skip: !enabled }, async (t) => {
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` });
  const admin = require("firebase-admin");
  const handlers = require("../lib/index.js");
  t.after(() => admin.app().delete());
  const db = admin.firestore();
  const { getDatabase } = require("firebase-admin/database");
  const rtdb = getDatabase();

  const authRequest = async (endpoint, body) => {
    const response = await fetch(`http://${FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=demo`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const credentials = { email: "pilot-admin@example.test", password: "demo-only", returnSecureToken: true };
  const user = await authRequest("signUp", credentials);
  await admin.auth().setCustomUserClaims(user.localId, { admin: true });
  const { idToken } = await authRequest("signInWithPassword", credentials);

  const call = async (name, body, token = idToken) => {
    const res = {
      set() { return this; }, status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; }, send(payload) { return this.json(payload); },
    };
    await handlers[name]({ method: "POST", headers: { authorization: `Bearer ${token}` }, body }, res);
    return res;
  };

  const officialSourceUrl = "https://www.ufc.com/event/ufc-999";
  const created = await call("createBet", {
    title: "Test pilot", description: "Emulator only", date: new Date(Date.now() + 3_600_000).toISOString(),
    pricePerTicket: 50, teams: { a: "One", b: "Two" }, officialSourceUrl, frozenFeeBps: 1000,
    ufcRules: { version: 1, methodPriceCents: 2000 },
  });
  assert.equal(created.statusCode, 200, JSON.stringify(created.body));
  const betId = created.body.data.id;
  const market = db.collection("ufcPilotMarkets").doc(betId);
  const purchase = async (paymentConceptKey) => {
    const response = await call("createTransferSale", {
      name: "Emulator Buyer", phone: "1234567890", paymentConceptKey, paymentImage: "https://example.test/receipt",
      bets: [{ betId, letterTeam: "A", ticketNumbers: 1 }, { betId, letterTeam: "A", ticketNumbers: 1, method: "KO_TKO" }],
    });
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body.saleBetId;
  };
  const orderId = await purchase("1234567890123456");
  const pendingId = await purchase("1234567890123457");
  assert.equal((await market.get()).get("orderCount"), 2);

  // An ordinary client cannot create or modify a trusted order even though
  // Firestore rules permit its separate, unverified salesBets projection.
  const write = await fetch(`http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/ufcPilotOrders/${orderId}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${user.idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { status: { stringValue: "VERIFIED" } } }),
  });
  assert.equal(write.status, 403);
  const verify = { action: "verify", orderId, receivedCents: 7000, bankReference: "EMULATOR-BANK-001" };
  const approvals = await Promise.all([call("verifyUfcPilotOrder", verify), call("verifyUfcPilotOrder", verify)]);
  assert.deepEqual(approvals.map((r) => [r.statusCode, r.body.duplicate]).sort(), [[200, false], [200, true]]);
  const reviewTimestamp = (await db.collection("ufcPilotOrders").doc(orderId).get()).get("review.reviewedAtMs");
  assert.equal((await market.get()).get("reviewedCount"), 1);

  // Advance only the fixture's authoritative cutoff, not the process clock.
  while (Date.now() <= reviewTimestamp) await new Promise((resolve) => setTimeout(resolve, 2));
  await market.update({ cutoffMs: Date.now() });
  const settlement = { betId, officialSourceUrl, result: { kind: "DRAW" } };
  const late = await Promise.all([
    call("verifyUfcPilotOrder", { ...verify, orderId: pendingId, bankReference: "EMULATOR-BANK-002" }),
    call("settleUfcPilotMarket", settlement),
  ]);
  assert.deepEqual(late.map((r) => r.statusCode), [409, 409]);
  const rejection = await call("verifyUfcPilotOrder", {
    orderId: pendingId, action: "reject", noFundsOutstanding: true, reason: "No payment received",
  });
  assert.equal(rejection.statusCode, 200);

  const settlements = await Promise.all([
    call("settleUfcPilotMarket", settlement), call("settleUfcPilotMarket", settlement),
  ]);
  assert.deepEqual(settlements.map((r) => [r.statusCode, r.body.alreadySettled]).sort(), [[200, false], [200, true]]);
  const sale = await db.collection("salesBets").doc(orderId).get();
  assert.deepEqual(sale.get(`ufcSettlements.${betId}.lines`), [
    { lineIndex: 0, pool: "base", kind: "REFUND", amountCents: 5000, transferStatus: "PENDING" },
    { lineIndex: 1, pool: "method", kind: "REFUND", amountCents: 2000, transferStatus: "PENDING" },
  ]);
  assert.equal((await rtdb.ref(`bets/${betId}`).once("value")).val().settled, true);
  assert.equal((await market.get()).get("settlement.uid"), user.localId);
});
