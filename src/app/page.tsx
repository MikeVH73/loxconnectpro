"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Image from "next/image";
import { seedCountries } from "./utils/seedCountries";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Seed countries on first load
    seedCountries();
  }, []);

  return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
}
