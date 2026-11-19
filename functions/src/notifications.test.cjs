const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildNotificationPayload, tokensByUser } = require("../lib/notifications");

test("links purchase pushes to the Rifas Mtz production site", () => {
  assert.deepEqual(buildNotificationPayload({ title: "Nueva compra pendiente de confirmación", body: "Revisa el panel.", destination: "adminSales" }), {
    notification: { title: "Nueva compra pendiente de confirmación", body: "Revisa el panel." },
    webpush: { notification: { data: { url: "/admin/sales" } }, fcmOptions: { link: "https://rifasmtz.web.app/admin/sales" } },
  });
});

test("uses configured customer route with optional image", () => {
  const payload = buildNotificationPayload({ title: "¡Ganaste!", body: "Consulta tus compras.", destination: "myPurchases", path: "/bet/bet-123", imageUrl: "https://example.test/icon.png" });
  assert.equal(payload.webpush.fcmOptions.link, "https://rifasmtz.web.app/bet/bet-123");
  assert.equal(payload.webpush.notification.data.url, "/bet/bet-123");
  assert.equal(payload.notification.imageUrl, "https://example.test/icon.png");
});

test("rejects unsafe paths and unknown destinations", () => {
  for (const path of ["//attacker.example", "/\\\\attacker.example", "https://attacker.example"]) {
    assert.throws(() => buildNotificationPayload({ title: "t", body: "b", destination: "myPurchases", path }), /same-origin path/);
  }
  assert.throws(() => buildNotificationPayload({ title: "t", body: "b", destination: "bad" }), /Unsupported/);
});

test("routes settlement push only to the sale owner's enabled tokens", () => {
  const roster = tokensByUser([
    { userId: "winner", token: "winner-1", enabled: true },
    { userId: "winner", token: "winner-2", enabled: true },
    { userId: "other", token: "other-device", enabled: true },
    { userId: "winner", token: "paused", enabled: false },
    { userId: "winner", token: null },
  ]);
  assert.deepEqual(roster.get("winner"), ["winner-1", "winner-2"]);
  assert.deepEqual(roster.get("anonymous"), undefined);
});
