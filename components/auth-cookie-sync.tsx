"use client";

import { useEffect } from "react";
import { useAppKitAccount } from "@reown/appkit/react";

const AUTH_COOKIE = "arc-counting-auth";

export function AuthCookieSync() {
  const { isConnected } = useAppKitAccount();

  useEffect(() => {
    if (isConnected) {
      document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax`;
      return;
    }

    document.cookie = `${AUTH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [isConnected]);

  return null;
}
