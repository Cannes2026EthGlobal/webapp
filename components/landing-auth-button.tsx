"use client";

import Link from "next/link";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";

export function LandingAuthButton() {
  const { open } = useAppKit();
  const { isConnected, status } = useAppKitAccount();

  if (isConnected) {
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  }

  const isBusy = status === "connecting" || status === "reconnecting";

  return (
    <Button onClick={() => open()} size="lg" disabled={isBusy}>
      {isBusy ? "Connecting..." : "Login"}
    </Button>
  );
}
