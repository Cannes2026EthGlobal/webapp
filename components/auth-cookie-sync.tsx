"use client";

import { useEffect } from "react";
import { useAppKitAccount } from "@reown/appkit/react";

const AUTH_COOKIE = "arc-counting-auth";

export function AuthCookieSync() {
  const { isConnected, status } = useAppKitAccount();

  useEffect(() => {
    if (isConnected) {
      document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax; Max-Age=86400`;
    }
    // Don't clear cookie on disconnect — AppKit flashes "disconnected" briefly
    // during reconnection which causes the server-side layout check to fail.
    // The client-side DashboardAuthGuard handles the actual redirect.
  }, [isConnected]);

  return null;
}
