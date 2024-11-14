"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "../firebaseconfig";
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

    if (loading) return <p>Loading...</p>;
    if (!authenticated) return null;

    return <Component {...props} />;
  };
};

export default withAuth;
