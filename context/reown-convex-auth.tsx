"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import type { ReownAuthentication } from "@reown/appkit-siwx";
import { useAppKitSIWX } from "@reown/appkit-siwx/react";
import {
  clearStoredReownAuthTokens,
  getStoredReownAuthToken,
} from "@/lib/reown-auth";

type FetchAccessTokenArgs = {
  forceRefreshToken: boolean;
};

export function useReownConvexAuth() {
  const { status } = useAppKitAccount();
  const siwx = useAppKitSIWX<ReownAuthentication>();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(Boolean(getStoredReownAuthToken()));
    setIsBootstrapping(false);
  }, []);

  useEffect(() => {
    if (!siwx) {
      return;
    }

    let isActive = true;

    const syncSession = async () => {
      try {
        await siwx.getSessionAccount();
        if (isActive) {
          setHasSession(true);
        }
      } catch {
        if (isActive) {
          setHasSession(Boolean(getStoredReownAuthToken()));
        }
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    };

    void syncSession();

    const unsubscribe = siwx.on("sessionChanged", (session) => {
      if (!isActive) {
        return;
      }

      setHasSession(Boolean(session || getStoredReownAuthToken()));
      setIsBootstrapping(false);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [siwx]);

  const fetchAccessToken = useCallback(async (args: FetchAccessTokenArgs) => {
    void args;

    const reownToken = getStoredReownAuthToken();

    if (!reownToken) {
      return null;
    }

    const response = await fetch("/api/auth/convex-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reownToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredReownAuthTokens();
        setHasSession(false);
      }

      return null;
    }

    const payload = (await response.json()) as { token?: string };
    return payload.token ?? null;
  }, []);

  const isConnecting = status === "connecting" || status === "reconnecting";

  return {
    isLoading: isBootstrapping || isConnecting,
    isAuthenticated: hasSession,
    fetchAccessToken,
  };
}
