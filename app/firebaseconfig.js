// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTg3tVWY-Msr3bZ54fumk_OfORPb04Q88",
  authDomain: "raffleapp-dbc1b.firebaseapp.com",
  databaseURL: "https://raffleapp-dbc1b-default-rtdb.firebaseio.com",
  projectId: "raffleapp-dbc1b",
  storageBucket: "raffleapp-dbc1b.appspot.com",
  messagingSenderId: "630899937485",
  appId: "1:630899937485:web:1068af9b484278d011d984",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const storage = getStorage(firebaseApp);
//initialize db
const db = getFirestore(firebaseApp);
const realtimeDB = getDatabase(firebaseApp);
const messagin = getMessaging(firebaseApp);
const getMessagingToken = async () => {
  try {
    const token = await getToken(messagin, {
      vapidKey:
        "BC_nlAx1Fti-x-M1WRmWkdIVmwNV_PVYbcksLOUzaTww2ytV2GVDCepRlBk6kbT8oKXDRHOLJ07tc6m1KYA929A",
    });
    if (token) {
      console.log("Token generated:", token);
      return token;
    } else {
      console.log(
        "No registration token available. Request permission to generate one."
      );
      return null;
    }
  } catch (error) {
    console.error("Error getting messaging token:", error);
    return null;
  }
};
const onMessageListener = () => {
  return new Promise((resolve) => {
    onMessage(messagin, (payload) => {
      console.log("Message received. ", payload);
      // You can handle the payload here, e.g., show a notification
      resolve(payload.notification);
    });
  });
};

export default firebaseApp;
export {
  db,
  auth,
  storage,
  realtimeDB,
  messagin,
  getMessagingToken,
  onMessageListener,
};
