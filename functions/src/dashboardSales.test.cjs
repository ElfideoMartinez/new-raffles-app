// From the repo root: npm --prefix functions run build && node --test functions/src/dashboardSales.test.cjs
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const { test } = require("node:test");

const firestoreRows = { sales: [], salesBets: [] }; // newest first
let quickRows = []; // RTDB query order, oldest first
const reads = [];
let readError;
let ticket;
const transactions = [];

// Replace only the Firebase I/O. Load the actual HTTPS handler and admin guard.
function loadHandler() {
  const stubs = {
    "firebase-admin": {
      initializeApp() {},
      auth: () => ({
        verifyIdToken: async (token) => {
          if (token === "invalid") throw new Error("invalid token");
          return { admin: token === "admin" };
        },
      }),
      firestore: () => ({
        collection: (name) => ({
          orderBy: (field, direction) => ({
            select: (...fields) => ({
              limit: (limit) => ({
                get: async () => {
                  reads.push([name, field, direction, fields, limit]);
                  if (readError) throw readError;
                  return {
                    docs: firestoreRows[name].slice(0, limit).map((row) => ({
                      data: () => Object.fromEntries(fields.map((field) => [field, row[field]])),
                    })),
                  };
                },
              }),
            }),
          }),
        }),
      }),
    },
    "firebase-admin/database": {
      getDatabase: () => ({
        ref: (path) => ({
          transaction: async (update) => {
            transactions.push(path);
            // A cold RTDB client can initially pass null, then retry with server data.
            assert.equal(update(null), null);
            const next = update(ticket);
            if (next !== undefined) ticket = next;
            return { committed: next !== undefined, snapshot: { exists: () => ticket !== null } };
          },
          orderByKey: () => ({
            limitToLast: (limit) => ({
              once: async (event) => {
                reads.push([path, "key", limit, event]);
                return {
                  forEach: (visit) => quickRows.slice(-limit).forEach((row) => visit({ val: () => row })),
                };
              },
            }),
          }),
        }),
      }),
    },
    "firebase-admin/remote-config": { getRemoteConfig: () => ({}) },
  };
  const saved = Object.entries(stubs).map(([name, exports]) => {
    const id = require.resolve(name);
    const previous = require.cache[id];
    require.cache[id] = { exports, loaded: true };
    return [id, previous];
  });
  try {
    return require("../lib/index.js");
  } finally {
    for (const [id, previous] of saved) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
  }
}

const { getDashboardSales, updateQuickTicketStatus } = loadHandler();

async function request(method = "GET", authorization = "Bearer admin", handler = getDashboardSales, body) {
  assert.equal(typeof handler, "function", "The HTTPS handler must be exported");
  const headers = {};
  const res = {
    set(name, value) { headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
  await handler({ method, headers: { authorization }, body }, res);
  return { status: res.statusCode, body: res.body, headers };
}

test("returns only recent aggregate counts and confirmed category amounts", async () => {
  firestoreRows.sales = [
    { verified: true, totalRafflePrice: 20.1, totalSalePrice: 160.1, email: "buyer@example.test", createdAt: { toMillis: () => 1795000000000 } },
    { verified: true, totalRafflePrice: 0.2 },
    { verified: false, totalRafflePrice: 999 },
    { totalRafflePrice: 500 },
    { verified: true, totalRafflePrice: -12 },
  ];
  firestoreRows.salesBets = [
    { verified: false, totalBetsPrice: "47.25", totalSalePrice: 160.35, createdAt: { toMillis: () => 1795100000000 } },
    { verified: true, totalBetsPrice: "140.25" },
    { verified: true, totalSalePrice: 120 },
    { verified: true, totalBetsPrice: Infinity },
    { verified: "true", totalBetsPrice: 200 },
  ];
  quickRows = [
    { status: "pending", activationCode: "secret" },
    { status: "active" },
    { status: "finnished", claimed: true },
    { status: "unknown", claimed: true },
    { status: "pending", createdAt: 1795200000000, activationCode: "never return this" },
  ];
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.body, {
    raffles: { confirmed: 3, pending: 2, amount: 20.3, limited: false, latest: { amount: 20.1, status: "verified", createdAt: 1795000000000 } },
    bets: { confirmed: 3, pending: 2, amount: 140.25, limited: false, latest: { amount: 47.25, status: "unverified", createdAt: 1795100000000 } },
    quick: { confirmed: 2, pending: 2, limited: false, latest: { status: "pending", createdAt: 1795200000000 } },
  });
  assert.deepEqual(reads.splice(0), [
    ["sales", "createdAt", "desc", ["verified", "totalRafflePrice", "createdAt"], 501],
    ["salesBets", "createdAt", "desc", ["verified", "totalBetsPrice", "createdAt"], 501],
    ["quickTickets", "key", 501, "value"],
  ]);
});

test("excludes the oldest probe only when a collection exceeds 500 records", async () => {
  firestoreRows.sales = [
    ...Array.from({ length: 500 }, () => ({ verified: true, totalRafflePrice: 1 })),
    { verified: true, totalRafflePrice: 999 },
  ];
  firestoreRows.salesBets = Array.from({ length: 500 }, () => ({ verified: false }));
  quickRows = [{ status: "active" }, ...Array.from({ length: 500 }, () => ({ status: "pending" }))];
  assert.deepEqual((await request()).body, {
    raffles: { confirmed: 500, pending: 0, amount: 500, limited: true, latest: { amount: 1, status: "verified", createdAt: null } },
    bets: { confirmed: 0, pending: 500, amount: 0, limited: false, latest: { amount: null, status: "unverified", createdAt: null } },
    quick: { confirmed: 0, pending: 500, limited: true, latest: { status: "pending", createdAt: null } },
  });
});

test("returns zeros for empty collections", async () => {
  firestoreRows.sales = [];
  firestoreRows.salesBets = [];
  quickRows = [];
  assert.deepEqual((await request()).body, {
    raffles: { confirmed: 0, pending: 0, amount: 0, limited: false, latest: null },
    bets: { confirmed: 0, pending: 0, amount: 0, limited: false, latest: null },
    quick: { confirmed: 0, pending: 0, limited: false, latest: null },
  });
});

test("rejects unauthorized callers and non-GET methods before reading sales", async () => {
  reads.length = 0;
  assert.equal((await request("GET", "")).status, 401);
  assert.equal((await request("GET", "Bearer invalid")).status, 401);
  assert.equal((await request("GET", "Bearer nonadmin")).status, 403);
  const preflight = await request("OPTIONS", "");
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-methods"], "GET, OPTIONS");
  const post = await request("POST");
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, OPTIONS");
  assert.deepEqual(reads, []);
});

test("returns a generic failure rather than partial stats or database details", async (t) => {
  t.mock.method(console, "error", () => {});
  readError = new Error("internal database details");
  try {
    const response = await request();
    assert.equal(response.status, 500);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.body, { status: 500, message: "Error fetching dashboard sales" });
  } finally {
    readError = undefined;
  }
});

test("local mock exposes the same flat GET contract", async (t) => {
  const server = spawn(process.execPath, [join(__dirname, "../../mock/server.mjs")], {
    env: { ...process.env, MOCK_PORT: "0" },
  });
  t.after(() => server.kill());
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Mock server startup timed out")), 5000);
    server.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Mock exited: ${code}`)); });
    server.once("error", (err) => { clearTimeout(timer); reject(err); });
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/functions base: (http:\/\/127\.0\.0\.1:\d+\/[^\n]+)/);
      if (match) { clearTimeout(timer); resolve(`${match[1]}/getDashboardSales`); }
    });
  });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    raffles: { confirmed: 3, pending: 2, amount: 500, limited: false, latest: { status: "verified", amount: 150, createdAt: 1795093200000 } },
    bets: { confirmed: 4, pending: 1, amount: 650, limited: false, latest: { status: "unverified", amount: 200, createdAt: 1795094700000 } },
    quick: { confirmed: 2, pending: 1, limited: false, latest: { status: "pending", createdAt: 1795095600000 } },
  });
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
});

test("quick-ticket mutation validates auth, payload and current state", async () => {
  const ticketId = "ticket_1763600000000_a1b2c3";
  const activate = { ticketId, action: "activate" };
  const setClaimed = (claimed) => ({ ticketId, action: "setClaimed", claimed });
  const send = (body, auth, method = "POST") => {
    assert.equal(typeof updateQuickTicketStatus, "function", "updateQuickTicketStatus must be exported");
    return request(method, auth, updateQuickTicketStatus, body);
  };
  assert.equal((await send(activate, "Bearer nonadmin")).status, 403);
  assert.equal((await send(activate, "")).status, 401);
  assert.equal((await send(activate, undefined, "GET")).status, 405);
  for (const body of [{ ...activate, ticketId: "../secret" }, { ...activate, claimed: true },
    setClaimed("true"), { ...activate, action: "finish" }, { ...activate, winnerLevel: "bigWinner" }]) {
    assert.equal((await send(body)).status, 400);
  }
  assert.deepEqual(transactions, []);

  const fields = { activationCode: "private", isWinner: true, winnerLevel: "minorWinner" };
  ticket = { ...fields, status: "pending" };
  assert.equal((await send(setClaimed(true))).status, 409);
  assert.deepEqual((await send(activate)).body, { ok: true, status: "active" });
  assert.deepEqual(ticket, { ...fields, status: "active" });
  assert.deepEqual(transactions, Array(2).fill(`quickTickets/${ticketId}`));
  assert.equal((await send(activate)).status, 409);

  ticket = { ...fields, status: "finnished", isWinner: false };
  assert.equal((await send(setClaimed(true))).status, 409);
  ticket = { ...fields, status: "finnished" };
  for (const claimed of [true, false]) {
    assert.deepEqual((await send(setClaimed(claimed))).body, { ok: true, claimed });
    assert.deepEqual(ticket, { ...fields, status: "finnished", claimed });
  }
  ticket = null;
  assert.equal((await send(activate)).status, 404);
  assert.equal(ticket, null);
});
