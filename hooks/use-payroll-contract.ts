"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { PAYROLL_ADDRESS, PAYROLL_ABI, centsToWei, weiToCents } from "@/lib/contracts";

export function usePayrollBalance() {
  const { data, isLoading, refetch } = useReadContract({
    address: PAYROLL_ADDRESS,
    abi: PAYROLL_ABI,
    functionName: "contractBalance",
    query: { enabled: !!PAYROLL_ADDRESS },
  });

  return {
    balanceWei: data as bigint | undefined,
    balanceCents: data ? weiToCents(data as bigint) : 0,
    isLoading,
    refetch,
  };
}

export function usePayrollOwner() {
  const { data } = useReadContract({
    address: PAYROLL_ADDRESS,
    abi: PAYROLL_ABI,
    functionName: "owner",
    query: { enabled: !!PAYROLL_ADDRESS },
  });

  return data as `0x${string}` | undefined;
}

export function usePayrollDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function deposit(amountCents: number) {
    if (!PAYROLL_ADDRESS) throw new Error("Payroll contract address not set");
    writeContract({
      address: PAYROLL_ADDRESS,
      abi: PAYROLL_ABI,
      functionName: "deposit",
      value: centsToWei(amountCents),
    });
  }

  return { deposit, hash, isPending, isConfirming, isSuccess, error };
}

// Note: There is no usePayrollPay() hook. Payments are triggered by
// Chainlink CRE via KeystoneForwarder → onReport() → _processReport().
// The webapp creates advance requests in Convex, and CRE picks them up
// on its cron cycle, executes the on-chain payment, and marks them fulfilled.

export function usePayrollForwarder() {
  const { data } = useReadContract({
    address: PAYROLL_ADDRESS,
    abi: PAYROLL_ABI,
    functionName: "getForwarderAddress",
    query: { enabled: !!PAYROLL_ADDRESS },
  });

  return data as `0x${string}` | undefined;
}
