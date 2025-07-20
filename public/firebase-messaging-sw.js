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
  console.log("Received background message ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
