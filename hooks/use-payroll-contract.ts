"use client";

import { useReadContract } from "wagmi";
import { PAYROLL_ABI } from "@/lib/payroll-contract";

export function usePayrollBalance(contractAddress: `0x${string}` | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: PAYROLL_ABI,
    functionName: "contractBalance",
    query: {
      enabled: !!contractAddress,
      refetchInterval: 15000,
    },
  });

  const balanceWei = data as bigint | undefined;

  return {
    balanceWei,
    balanceUsdc: balanceWei !== undefined ? Number(balanceWei) / 1e18 : undefined,
    isLoading,
    error,
    refetch,
  };
}

export function usePayrollOwner(contractAddress: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    address: contractAddress,
    abi: PAYROLL_ABI,
    functionName: "owner",
    query: {
      enabled: !!contractAddress,
    },
  });

  return {
    owner: data as `0x${string}` | undefined,
    isLoading,
  };
}
