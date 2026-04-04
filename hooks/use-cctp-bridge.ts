"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import {
  CCTP,
  DOMAINS,
  TOKEN_MESSENGER_ABI,
  ERC20_APPROVE_ABI,
  ARC_USDC_ADDRESS,
  addressToBytes32,
  waitForAttestation,
  type DestinationChain,
} from "@/lib/cctp";

type BridgeState = {
  step: "idle" | "approving" | "burning" | "attesting" | "done" | "error";
  burnTxHash?: string;
  attestation?: { message: string; attestation: string };
  error?: string;
};

export function useCctpBridge() {
  const [state, setState] = useState<BridgeState>({ step: "idle" });
  const { writeContractAsync } = useWriteContract();

  async function bridge(
    amountWei: bigint,
    recipientAddress: `0x${string}`,
    destination: DestinationChain
  ) {
    try {
      // Step 1: Approve USDC spend
      setState({ step: "approving" });
      await writeContractAsync({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [CCTP.tokenMessenger, amountWei],
      });

      // Step 2: Burn (depositForBurn)
      setState({ step: "burning" });
      const destinationDomain = DOMAINS[destination];
      const mintRecipient = addressToBytes32(recipientAddress);

      const burnHash = await writeContractAsync({
        address: CCTP.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: "depositForBurn",
        args: [
          amountWei,
          destinationDomain,
          mintRecipient,
          ARC_USDC_ADDRESS,
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          BigInt(0),
          0,
        ],
      });

      setState({ step: "attesting", burnTxHash: burnHash });

      // Step 3: Wait for attestation
      const attestation = await waitForAttestation(DOMAINS.arc, burnHash);
      setState({ step: "done", burnTxHash: burnHash, attestation });

      return { burnHash, attestation };
    } catch (e: any) {
      setState({ step: "error", error: e.message });
      throw e;
    }
  }

  function reset() {
    setState({ step: "idle" });
  }

  return { bridge, state, reset };
}
