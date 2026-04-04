"use client";

import Link from "next/link";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";

export function LandingAuthButton() {
  const { open } = useAppKit();
  const { isConnected, status } = useAppKitAccount();
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isAuthenticated) {
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  }

  const isBusy =
    status === "connecting" || status === "reconnecting" || isLoading;
  const label = isBusy
    ? "Authorizing..."
    : isConnected
      ? "Finish sign-in"
      : "Login";

  return (
    <Button onClick={() => open()} size="lg" disabled={isBusy}>
      {label}
    </Button>
  );
}
