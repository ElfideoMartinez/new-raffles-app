// Client-side Firebase messaging configuration
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBTg3tVWY-Msr3bZ54fumk_OfORPb04Q88",
  authDomain: "raffleapp-dbc1b.firebaseapp.com",
  databaseURL: "https://raffleapp-dbc1b-default-rtdb.firebaseio.com",
  projectId: "raffleapp-dbc1b",
  storageBucket: "raffleapp-dbc1b.appspot.com",
  messagingSenderId: "630899937485",
  appId: "1:630899937485:web:1068af9b484278d011d984",
};

// Initialize Firebase for messaging (client-side only)
let messaging = null;
let firebaseApp = null;

if (typeof window !== "undefined") {
  firebaseApp = initializeApp(firebaseConfig);
  messaging = getMessaging(firebaseApp);
}

const getMessagingToken = async () => {
  if (typeof window === "undefined" || !messaging) {
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey:
        "BC_nlAx1Fti-x-M1WRmWkdIVmwNV_PVYbcksLOUzaTww2ytV2GVDCepRlBk6kbT8oKXDRHOLJ07tc6m1KYA929A",
    });
    if (token) {
      return token;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting messaging token:", error);
    return null;
  }
};

const onMessageListener = () => {
  if (typeof window === "undefined" || !messaging) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload.notification);
    });
  });
};

export { messaging, getMessagingToken, onMessageListener };
