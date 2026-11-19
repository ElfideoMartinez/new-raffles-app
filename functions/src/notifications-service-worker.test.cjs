const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

function loadWorker() {
  const source = fs.readFileSync(require.resolve("../../public/firebase-messaging-sw.js"), "utf8");
  const listeners = {};
  const shown = [];
  const navigated = [];
  let backgroundHandler;
  let focused = 0;
  const context = {
    importScripts() {},
    firebase: {
      initializeApp() {},
      messaging: () => ({ onBackgroundMessage: (handler) => { backgroundHandler = handler; } }),
    },
    self: {
      location: { origin: "https://rifasmtz.web.app" },
      registration: { showNotification: async (title, options) => shown.push({ title, options }) },
      addEventListener: (name, handler) => { listeners[name] = handler; },
    },
    clients: {
      matchAll: async () => [{
        navigate: async (url) => navigated.push(url),
        focus: async () => { focused += 1; },
      }],
      openWindow: async (url) => navigated.push(url),
    },
    URL,
    console,
  };
  vm.runInNewContext(source, context, { filename: "firebase-messaging-sw.js" });
  return { backgroundHandler, listeners, shown, navigated, get focused() { return focused; } };
}

test("FCM background notification payload is not shown twice", () => {
  const worker = loadWorker();
  worker.backgroundHandler({ notification: { title: "FCM", body: "already displayed" } });
  assert.deepEqual(worker.shown, []);
});

test("data-only push is shown and click navigates to an in-origin route", async () => {
  const worker = loadWorker();
  worker.backgroundHandler({ data: { title: "Resultado", body: "Consulta tus compras.", url: "/bet/bet-123" } });
  assert.deepEqual(JSON.parse(JSON.stringify(worker.shown)), [{
    title: "Resultado",
    options: { body: "Consulta tus compras.", icon: "/icon.png", data: { url: "/bet/bet-123" } },
  }]);

  let work;
  worker.listeners.notificationclick({
    notification: { data: { url: "/bet/bet-123" }, close() {} },
    waitUntil: (promise) => { work = promise; },
  });
  await work;
  assert.deepEqual(worker.navigated, ["https://rifasmtz.web.app/bet/bet-123"]);
  assert.equal(worker.focused, 1);
});

test("service worker rejects cross-origin notification links", async () => {
  const worker = loadWorker();
  let work;
  worker.listeners.notificationclick({
    notification: { data: { url: "https://attacker.example" }, close() {} },
    waitUntil: (promise) => { work = promise; },
  });
  await work;
  assert.deepEqual(worker.navigated, []);
});
