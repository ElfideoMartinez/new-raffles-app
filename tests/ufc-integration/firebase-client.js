// Test-only replacement for Firebase endpoint configuration; all SDK calls
// (including RTDB onValue, receipt upload, and download URL) are real.
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const loopback = "127.0.0.1";
const projectId = "demo-ufc-integration";
const firebaseApp = initializeApp({
  apiKey: "fake-api-key",
  projectId,
  databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
  storageBucket: `${projectId}.appspot.com`,
  appId: "1:000:web:integration",
});
export const auth = getAuth(firebaseApp);
export const realtimeDB = getDatabase(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
connectAuthEmulator(auth, `http://${loopback}:48316`, { disableWarnings: true });
connectDatabaseEmulator(realtimeDB, loopback, 48313);
connectFirestoreEmulator(db, loopback, 48314);
// The real checkout requires an HTTPS receipt URL. The local TLS proxy gives
// the Storage SDK an HTTPS origin, forwarding unchanged to the HTTP emulator.
storage.host = `${loopback}:48317`;
export default firebaseApp;
