"use client";

import { useQuery, useMutation } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useCallback, useMemo } from "react";

export function useCompany() {
  const { address, isConnected } = useAppKitAccount();

  const companies = useQuery(
    api.companies.getByWallet,
    address ? { wallet: address } : "skip"
  );

  const seedMutation = useMutation(api.seed.seedDemoData);

  const seed = useCallback(async () => {
    if (!address) return null;
    return await seedMutation({ ownerWallet: address });
  }, [address, seedMutation]);

  const company = useMemo(() => {
    if (!companies || companies.length === 0) return null;
    return companies[0];
  }, [companies]);

  return {
    company,
    companyId: company?._id as Id<"companies"> | null,
    isLoading: companies === undefined,
    isConnected,
    walletAddress: address,
    seed,
    hasCompany: !!company,
  };
}
