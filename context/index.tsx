"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { createAppKit } from "@reown/appkit/react";
import { ReownAuthentication } from "@reown/appkit-siwx";
import { cookieToInitialState, type Config, WagmiProvider } from "wagmi";
import { arcTestnet, networks, projectId, wagmiAdapter } from "@/config";
import { useReownConvexAuth } from "@/context/reown-convex-auth";
import {
  REOWN_AUTH_STORAGE_KEY,
  REOWN_NONCE_STORAGE_KEY,
} from "@/lib/reown-auth";

const queryClient = new QueryClient();
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined");
}

const convex = new ConvexReactClient(convexUrl);
const siwx = new ReownAuthentication({
  localAuthStorageKey: REOWN_AUTH_STORAGE_KEY,
  localNonceStorageKey: REOWN_NONCE_STORAGE_KEY,
});

const metadata = {
  name: "Arc Counting",
  description:
    "Private finance operations for payroll, invoicing, treasury, and usage-based settlement.",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: arcTestnet,
  metadata,
  siwx,
  features: {
    analytics: true,
  },
});

export default function ContextProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        <ConvexProviderWithAuth client={convex} useAuth={useReownConvexAuth}>
          {children}
        </ConvexProviderWithAuth>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
