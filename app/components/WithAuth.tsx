"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, auth } from "../firebaseconfig";
import { getMessagingToken, onMessageListener } from "../firebaseMessaging";
import { setDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const withAuth = (Component: any) => {
  const WithAuth = (props: any) => {
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
    // Token registration (fixed 2026-10-25):
    //   1. The old code short-circuited on a localStorage token and never
    //      re-registered — refreshed FCM tokens were silently lost.
    //   2. It wrote userId:"daniel" hardcoded. Now the device registers under
    //      the SIGNED-IN user's uid (doc id = uid, as the Firestore rules
    //      expect: tokenId == request.auth.uid). If nobody is signed in, we
    //      cache the token locally and it registers on first sign-in — the
    //      anonymous storefront is never blocked.
    const requestNoptificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission status:", permission);
        if (permission === "granted") {
          // Always ask FCM for the (possibly refreshed) token — no
          // localStorage short-circuit.
          const token = await getMessagingToken();
          console.log("Notification token:", token);
          if (token) {
            localStorage.setItem("notificationToken", token);
            const user = auth.currentUser;
            if (!user) {
              // Anonymous (or not yet signed in): register on first login.
              console.log("No signed-in user; notification token cached locally only.");
              return;
            }
            await setDoc(
              doc(db, "notificationTokens", user.uid),
              {
                userId: user.uid,
                token: token,
                enabled: true,
                updatedAt: new Date(),
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
      // Register once a user exists; re-run on sign-in so the token lands
      // under the right uid (auth state is already observed above).
      if (authenticated) requestNoptificationPermission();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authenticated]);
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
    if (loading)
      return (
        <p role="status" className="p-6 text-center text-sm text-ink-500">
          Cargando…
        </p>
      );
    if (!authenticated) return null;

    return <Component {...props} />;
  };
  WithAuth.displayName = `withAuth(${
    Component.displayName || Component.name || "Component"
  })`;
  return WithAuth;
};

export default withAuth;
