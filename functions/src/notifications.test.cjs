const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildNotificationPayload } = require("../lib/notifications.js");

test("builds a purchase notification with safe copy and admin destination", () => {
  assert.deepEqual(buildNotificationPayload({
    title: "Nueva compra por transferencia",
    body: "Hay una compra pendiente de revisión. Consulta el panel.",
    destination: "adminSales",
  }), {
    notification: {
      title: "Nueva compra por transferencia",
      body: "Hay una compra pendiente de revisión. Consulta el panel.",
    },
    webpush: {
      notification: { data: { url: "/admin/sales" } },
      fcmOptions: { link: "https://raffleapp-dbc1b.web.app/admin/sales" },
    },
  });
});

test("builds a customer notification link using the configured site origin", (t) => {
  const previous = process.env.PUBLIC_SITE_URL;
  process.env.PUBLIC_SITE_URL = "https://rifas.example/";
  t.after(() => {
    if (previous === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = previous;
  });

  assert.equal(
    buildNotificationPayload({ title: "Resultado", body: "Consulta tus compras.", destination: "myPurchases" })
      .webpush.fcmOptions.link,
    "https://rifas.example/user/my-purchases"
  );
});

test("includes optional image and a specific same-origin destination", () => {
  const payload = buildNotificationPayload({
    title: "¡Ganaste!",
    body: "Consulta tu resultado.",
    destination: "myPurchases",
    path: "/bet/bet-123",
    imageUrl: "https://example.test/logo.png",
  });
  assert.equal(payload.notification.imageUrl, "https://example.test/logo.png");
  assert.equal(payload.webpush.notification.icon, "https://example.test/logo.png");
  assert.equal(payload.webpush.notification.data.url, "/bet/bet-123");
  assert.equal(payload.webpush.fcmOptions.link, "https://raffleapp-dbc1b.web.app/bet/bet-123");
});

test("rejects unsafe notification paths", () => {
  for (const path of ["//attacker.example", "/\\\\attacker.example", "https://attacker.example"]) {
    assert.throws(() => buildNotificationPayload({
      title: "Title",
      body: "Body",
      destination: "myPurchases",
      path,
    }), /same-origin path/);
  }
});

test("rejects unsupported notification destinations", () => {
  assert.throws(() => buildNotificationPayload({
    title: "Title",
    body: "Body",
    destination: "external",
  }), /Unsupported notification destination/);
});
