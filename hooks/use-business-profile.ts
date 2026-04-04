"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useCompany } from "./use-company";

export function useBusinessProfile() {
  const { userId, isConnected, walletAddress } = useCompany();

  const profile = useQuery(
    api.businessProfiles.getByUserId,
    userId ? { userId } : "skip"
  );

  return {
    profile,
    hasProfile: !!profile,
    isLoading: profile === undefined && isConnected,
    isConnected,
    walletAddress,
    payrollContractAddress: profile?.payrollContractAddress as
      | `0x${string}`
      | undefined,
  };
}
