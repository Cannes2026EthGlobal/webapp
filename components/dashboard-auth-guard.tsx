"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && status === "disconnected") {
      router.replace("/");
    }
  }, [isHydrated, router, status]);

  if (!isHydrated || status === "reconnecting" || status === "connecting") {
    return <DashboardLoadingState message="Checking session..." />;
  }

  if (!isConnected) {
    return <DashboardLoadingState message="Redirecting..." />;
  }

  return <>{children}</>;
}
