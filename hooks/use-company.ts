"use client";

import { useQuery, useMutation } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useCallback, useMemo, useState, useEffect } from "react";

const ACTIVE_COMPANY_KEY = "arc-counting-active-company";

export function useCompany() {
  const { address, isConnected } = useAppKitAccount();

  // Step 1: resolve wallet → user record
  const user = useQuery(
    api.users.getByWallet,
    address ? { walletAddress: address } : "skip"
  );
  const ensureUser = useMutation(api.users.getOrCreateByWallet);

  // Create user record on first connect (user === null means loaded but missing)
  useEffect(() => {
    if (!address || user === undefined || user !== null) return;
    void ensureUser({ walletAddress: address });
  }, [address, user, ensureUser]);

  // Step 2: resolve userId → companies (via companyMembers)
  const companies = useQuery(
    api.companies.getByUserId,
    user?._id ? { userId: user._id } : "skip"
  );

  const seedMutation = useMutation(api.seed.seedDemoData);

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_COMPANY_KEY);
    if (stored) setActiveCompanyId(stored);
  }, []);

  // When companies load and no active selection (or stored one is invalid), pick first
  useEffect(() => {
    if (!companies || companies.length === 0) return;
    const isValid = companies.some((c) => c._id === activeCompanyId);
    if (!isValid) {
      const first = companies[0]._id;
      setActiveCompanyId(first);
      localStorage.setItem(ACTIVE_COMPANY_KEY, first);
    }
  }, [companies, activeCompanyId]);

  const switchCompany = useCallback((id: Id<"companies">) => {
    setActiveCompanyId(id);
    localStorage.setItem(ACTIVE_COMPANY_KEY, id);
  }, []);

  const seed = useCallback(async () => {
    if (!address) return null;
    return await seedMutation({ walletAddress: address });
  }, [address, seedMutation]);

  const company = useMemo(() => {
    if (!companies || companies.length === 0) return null;
    if (activeCompanyId) {
      const found = companies.find((c) => c._id === activeCompanyId);
      if (found) return found;
    }
    return companies[0];
  }, [companies, activeCompanyId]);

  // isLoading: true while user record or companies are still being fetched
  const isLoading = isConnected && (user === undefined || companies === undefined);

  return {
    company,
    companyId: company?._id as Id<"companies"> | null,
    companies: companies ?? [],
    isLoading,
    isConnected,
    walletAddress: address,
    userId: user?._id ?? null,
    seed,
    hasCompany: !!company,
    switchCompany,
  };
}
