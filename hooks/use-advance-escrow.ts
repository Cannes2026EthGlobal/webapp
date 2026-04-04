"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADVANCE_ESCROW_ADDRESS, ADVANCE_ESCROW_ABI, centsToWei } from "@/lib/contracts";

export function useAdvanceEscrowCount() {
  const { data } = useReadContract({
    address: ADVANCE_ESCROW_ADDRESS,
    abi: ADVANCE_ESCROW_ABI,
    functionName: "advanceCount",
    query: { enabled: !!ADVANCE_ESCROW_ADDRESS },
  });
  return data as bigint | undefined;
}

export function useAdvanceEscrowGet(advanceId: number | undefined) {
  const { data, isLoading } = useReadContract({
    address: ADVANCE_ESCROW_ADDRESS,
    abi: ADVANCE_ESCROW_ABI,
    functionName: "getAdvance",
    args: advanceId !== undefined ? [BigInt(advanceId)] : undefined,
    query: { enabled: !!ADVANCE_ESCROW_ADDRESS && advanceId !== undefined },
  });
  return { advance: data, isLoading };
}

export function useCreateAdvanceOnChain() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function createAdvance(
    employeeAddress: `0x${string}`,
    grossAmountCents: number,
    interestBps: number,
    repayByTimestamp: number
  ) {
    if (!ADVANCE_ESCROW_ADDRESS) throw new Error("AdvanceEscrow address not set");
    const weiAmount = centsToWei(grossAmountCents);
    writeContract({
      address: ADVANCE_ESCROW_ADDRESS,
      abi: ADVANCE_ESCROW_ABI,
      functionName: "createAdvance",
      args: [
        employeeAddress,
        weiAmount,
        BigInt(interestBps),
        BigInt(repayByTimestamp),
      ],
      value: weiAmount,
    });
  }

  return { createAdvance, hash, isPending, isConfirming, isSuccess, error };
}

export function useReleaseAdvance() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function releaseAdvance(advanceId: number) {
    if (!ADVANCE_ESCROW_ADDRESS) throw new Error("AdvanceEscrow address not set");
    writeContract({
      address: ADVANCE_ESCROW_ADDRESS,
      abi: ADVANCE_ESCROW_ABI,
      functionName: "releaseAdvance",
      args: [BigInt(advanceId)],
    });
  }

  return { releaseAdvance, hash, isPending, isConfirming, isSuccess, error };
}
