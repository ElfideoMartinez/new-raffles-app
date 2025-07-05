"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  auth,
  messagin,
  getMessagingToken,
  onMessageListener,
} from "../firebaseconfig";
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
          const token = await getMessagingToken();
          console.log("Notification permission granted. Token:", token);
          //if tocken save on localStorage
          if (token) {
            localStorage.setItem("notificationToken", token);
            console.log("Notification token saved to localStorage:", token);
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
