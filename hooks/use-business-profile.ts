"use client";

import { useQuery } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "../convex/_generated/api";

export function useBusinessProfile() {
  const { address, isConnected } = useAppKitAccount();

  const profile = useQuery(
    api.businessProfiles.getByWallet,
    address ? { wallet: address } : "skip"
  );

  return {
    profile,
    hasProfile: !!profile,
    isLoading: profile === undefined && isConnected,
    isConnected,
    walletAddress: address,
    payrollContractAddress: profile?.payrollContractAddress as
      | `0x${string}`
      | undefined,
  };
}
