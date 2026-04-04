"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, type Config, WagmiProvider } from "wagmi";
import { arcTestnet, networks, projectId, wagmiAdapter } from "@/config";
import { AuthCookieSync } from "@/components/auth-cookie-sync";

const queryClient = new QueryClient();

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
    cookies
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        <AuthCookieSync />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
