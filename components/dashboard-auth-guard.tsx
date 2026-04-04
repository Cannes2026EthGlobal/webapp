"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";

function DashboardLoadingState({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground" aria-busy="true">
        {message}
      </p>
    </main>
  );
}

export function DashboardAuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isConnected, status } = useAppKitAccount();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasEverConnected = useRef(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Track if the wallet has ever connected during this session
  if (isConnected) {
    hasEverConnected.current = true;
  }

  // Give AppKit time to restore the wallet session after a page refresh.
  // On refresh, status briefly flashes "disconnected" before going to
  // "reconnecting" → "connected". We wait a short period before treating
  // "disconnected" as final.
  useEffect(() => {
    if (!isHydrated) return;

    // If already connected or reconnecting, we're ready
    if (isConnected || status === "reconnecting" || status === "connecting") {
      setIsReady(true);
      return;
    }

    // Status is "disconnected" — wait briefly for AppKit to start reconnecting
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isHydrated, isConnected, status]);

  // Redirect only when we're confident the session is truly gone
  useEffect(() => {
    if (isReady && !isConnected && status === "disconnected") {
      router.replace("/");
    }
  }, [isReady, isConnected, status, router]);

  if (!isHydrated || !isReady || status === "reconnecting" || status === "connecting") {
    return <DashboardLoadingState message="Checking session..." />;
  }

  if (!isConnected) {
    return <DashboardLoadingState message="Redirecting..." />;
  }

  return <>{children}</>;
}
