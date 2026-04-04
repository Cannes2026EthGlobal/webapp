"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useCompany } from "./use-company";

export function useBusinessProfile() {
  const { userId, isConnected, walletAddress, company } = useCompany();

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
    // Sourced from the active company — correct for multi-workspace SaaS
    payrollContractAddress: company?.payrollContractAddress as
      | `0x${string}`
      | undefined,
  };
}
