"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, auth } from "../firebaseconfig";
import { getMessagingToken, onMessageListener } from "../firebaseMessaging";
import { setDoc, doc } from "firebase/firestore";
import { useClientAuth } from "./clientAuth";

/**
 * Admin-only route guard (HOC).
 *
 * PREVIOUSLY this checked only "is a user signed in?" and passed anyone —
 * including a normal storefront customer or a stale/failed login — through to
 * the admin shell. The backend is claim-gated (assertAdmin rejects calls
 * without `admin === true`), so no data leaked, but the admin UI + navigation
 * still rendered and read as accessible. That was the "still let me through to
 * the admin" bug.
 *
 * NOW this also requires the signed-in user to carry the `admin === true`
 * custom claim. A signed-in non-admin is redirected to the storefront instead
 * of seeing the admin UI. Every page wrapped here is admin-only.
 */
const withAuth = (Component: any) => {
  const WithAuth = (props: any) => {
    const router = useRouter();
    const { user, isAdmin, loading } = useClientAuth();
    const [showLoading, setShowLoading] = useState(true);

    useEffect(() => {
      if (loading) return; // auth state not resolved yet
      if (!user) {
        // Not signed in at all → admin login page.
        router.replace("/admin");
      } else if (!isAdmin) {
        // Signed in but the account lacks the admin claim → away.
        router.replace("/");
      } else {
        setShowLoading(false);
      }
    }, [loading, user, isAdmin, router]);

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
        if (permission === "granted") {
          // Always ask FCM for the (possibly refreshed) token — no
          // localStorage short-circuit.
          const token = await getMessagingToken();
          if (token) {
            localStorage.setItem("notificationToken", token);
            const user = auth.currentUser;
            if (!user) {
              // Anonymous (or not yet signed in): register on first login.
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
          await Notification.requestPermission();
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };
    useEffect(() => {
      if (isAdmin) requestNoptificationPermission();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);
    useEffect(() => {
      onMessageListener()
        .then((payload) => {
          new Notification(payload.title, {
            body: payload.body,
          });
        })
        .catch(() => {});
    }, []);
    if (showLoading)
      return (
        <p role="status" className="p-6 text-center text-sm text-ink-500">
          Cargando…
        </p>
      );
    if (!user || !isAdmin) return null;

    return <Component {...props} />;
  };
  WithAuth.displayName = `withAuth(${
    Component.displayName || Component.name || "Component"
  })`;
  return WithAuth;
};

export default withAuth;