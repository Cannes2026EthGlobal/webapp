"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";

export function LandingAuthButton() {
  const { open } = useAppKit();
  const { isConnected, status } = useAppKitAccount();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isResolvingSession = !isHydrated || status === "reconnecting";

  if (isResolvingSession) {
    return (
      <Button size="lg" disabled aria-busy="true">
        Checking session...
      </Button>
    );
  }

  if (isConnected) {
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  }

  const isBusy = status === "connecting";

  return (
    <Button onClick={() => open()} size="lg" disabled={isBusy}>
      {isBusy ? "Connecting..." : "Login"}
    </Button>
  );
}
