// Register click behavior before loading FCM; the SDK may otherwise replace it.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin);
  if (destination.origin !== self.location.origin) return;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(destination.href);
        return client.focus();
      }
    }
    return clients.openWindow(destination.href);
  })());
});

importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: "AIzaSyBTg3tVWY-Msr3bZ54fumk_OfORPb04Q88",
  authDomain: "raffleapp-dbc1b.firebaseapp.com",
  databaseURL: "https://raffleapp-dbc1b-default-rtdb.firebaseio.com",
  projectId: "raffleapp-dbc1b",
  storageBucket: "raffleapp-dbc1b.appspot.com",
  messagingSenderId: "630899937485",
  appId: "1:630899937485:web:1068af9b484278d011d984",
};
firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  // Notification payloads are displayed automatically by FCM in the background.
  if (payload.notification) return;

  console.log("Received background message ", payload);

  const notificationTitle = payload.data?.title || "Rifas Mtz";
  const notificationOptions = {
    body: payload.data?.body || "Tienes una actualización.",
    icon: "/icon.png",
    data: { url: payload.data?.url || "/" },
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
