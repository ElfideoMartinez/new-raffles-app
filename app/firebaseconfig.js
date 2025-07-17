// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

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

export default firebaseApp;
export {
  db,
  auth,
  storage,
  realtimeDB,
};
