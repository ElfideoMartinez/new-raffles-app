"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, auth } from "../firebaseconfig";
import { getMessagingToken, onMessageListener } from "../firebaseMessaging";
import { collection, getDoc, setDoc, addDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const withAuth = (Component: any) => {
  return (props: any) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setAuthenticated(true);
        } else {
          router.replace("/admin"); // Redirect to login if not authenticated
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }, [router]);
    const requestNoptificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission status:", permission);
        if (permission === "granted") {
          //chekc for token in localStorage
          const existingToken = localStorage.getItem("notificationToken");
          if (existingToken) {
            console.log("Existing notification token found:", existingToken);
            return existingToken; // Return the existing token if found
          }
          const token = await getMessagingToken();
          console.log("Notification permission granted. Token:", token);
          if (token) {
            localStorage.setItem("notificationToken", token);
            console.log("Notification token saved to localStorage:", token);
            const notificationTokenCollection = collection(
              db,
              "notificationTokens"
            );
            if (!notificationTokenCollection) {
              console.error("Notification token collection not found.");
              return;
            }
            await setDoc(
              doc(notificationTokenCollection, token),
              {
                userId: "daniel",
                token: token,
                createdAt: new Date(),
              },
              { merge: true }
            );
          }
        } else {
          console.error("Notification permission denied.");
          //request second time
          await Notification.requestPermission();
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };
    useEffect(() => {
      requestNoptificationPermission();
    }, []);
    useEffect(() => {
      console.log("Setting up message listener...");
      onMessageListener()
        .then((payload) => {
          console.log("Message received. ", payload);
          // You can handle the payload here, e.g., show a notification
          new Notification(payload.title, {
            body: payload.body,
          });
        })
        .catch((err) => console.log("failed: ", err));
    }, []);
    if (loading) return <p>Cargando...</p>;
    if (!authenticated) return null;

    return <Component {...props} />;
  };
};

export default withAuth;
