"use client";
/**
 * Client (customer) authentication — Model A identity.
 *
 * WHY THIS EXISTS
 * Before this module the storefront had no client identity at all: purchases
 * were anonymous (`createTransferSale` recorded `userId: null`) and the only
 * signed-in identity was the administrator via /admin. This module adds
 * Firebase Auth email/password login for customers so that:
 *   - a signed-in client's real `auth.uid` becomes the purchase identity
 *     (`sale.userId` / `saleBet.userId` — captured server-side from the
 *     Bearer token the checkout already sends),
 *   - notification tokens register under `notificationTokens/{uid}` as the
 *     Firestore rules expect (`tokenId == request.auth.uid`).
 *
 * Anonymous browsing still works everywhere: `user` is simply null and pages
 * fall back to the legacy behaviour (local purchase history, no registration).
 *
 * MOCK-AUTH (local screenshots only): when the build sets
 * NEXT_PUBLIC_ENABLE_MOCK_AUTH=1, a `mockClientUser` entry in localStorage is
 * honoured as a signed-in user. Production builds never set the flag, so this
 * cannot affect the deployed app; real endpoints still require a real ID
 * token.
 */
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../firebaseconfig";

const ENABLE_MOCK_AUTH =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "1";

export interface MockClientUser {
  uid: string;
  email: string;
}

function readMockUser(): MockClientUser | null {
  if (!ENABLE_MOCK_AUTH || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("mockClientUser");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.uid === "string" &&
      typeof parsed.email === "string"
    ) {
      return { uid: parsed.uid, email: parsed.email };
    }
  } catch {
    // ignore malformed mock payloads
  }
  return null;
}

/** Signed-in client state. `null` means anonymous browsing. */
export function useClientAuth(): {
  user: User | MockClientUser | null;
  /** True when the signed-in user carries the `admin === true` custom claim. */
  isAdmin: boolean;
  loading: boolean;
} {
  const [user, setUser] = useState<User | MockClientUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock mode resolves immediately — Firebase auth state may never fire in
    // a sandbox without network access to the auth backend. Mock users never
    // carry the admin claim.
    if (ENABLE_MOCK_AUTH) {
      const mock = readMockUser();
      if (mock) {
        setUser(mock);
        setIsAdmin(false);
        setLoading(false);
      }
    }
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const current = ++revision;
      setLoading(true);
      setIsAdmin(false);
      setUser(firebaseUser ?? readMockUser());
      // A protected layout must not redirect until the claim has resolved.
      const token = await firebaseUser?.getIdTokenResult().catch(() => null);
      if (current !== revision) return;
      setIsAdmin(token?.claims.admin === true);
      setLoading(false);
    });
    return () => {
      revision++;
      unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}

export async function clientLogin(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Google sign-in (2026-11-05). The provider was enabled in the Firebase
 * console by Daniel (project-630899937485, support email
 * fideomartinez52@gmail.com — Daniel plans to move the support email later).
 * Popup keeps the storefront flow (no full-page redirect); the returned user
 * is a normal Model A identity for purchases and notification tokens.
 */
export async function clientGoogleLogin(): Promise<User> {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export async function clientRegister(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return credential.user;
}

export async function clientLogout(): Promise<void> {
  await signOut(auth);
}

/**
 * fetch() for client (customer) endpoints — any signed-in user, not admin.
 *
 * Sends the caller's Firebase ID token; the server function resolves the
 * identity from it. Throws when nobody is signed in so callers fail loudly.
 */
export async function userApiFetch(
  fnName: string,
  init: RequestInit = {}
): Promise<Response> {
  const { user } = { user: auth.currentUser };
  const { apiUrl } = await import("@/app/config/api");
  const headers = new Headers(init.headers);
  if (user) {
    const idToken = await user.getIdToken();
    headers.set("Authorization", `Bearer ${idToken}`);
  } else if (ENABLE_MOCK_AUTH && readMockUser()) {
    // Mock-only: no token exists; the mock server ignores Authorization.
  } else {
    throw new Error("Inicia sesión para continuar.");
  }
  return fetch(apiUrl(fnName), { ...init, headers });
}