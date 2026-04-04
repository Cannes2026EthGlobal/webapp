// CCTP V2 contract addresses (same on all testnets)
export const CCTP = {
  tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
  messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
};

export const DOMAINS = {
  arc: 26,
  arbitrum: 3,
  base: 6,
} as const;

export type DestinationChain = "arbitrum" | "base";

export const DESTINATION_CHAIN_IDS: Record<DestinationChain, number> = {
  arbitrum: 421614, // Arbitrum Sepolia
  base: 84532, // Base Sepolia
};

// Arc Testnet USDC ERC20 address for CCTP (placeholder — confirm with Circle docs)
export const ARC_USDC_ADDRESS = "0x_ARC_USDC_ERC20_FOR_CCTP" as `0x${string}`;

export const TOKEN_MESSENGER_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const MESSAGE_TRANSMITTER_ABI = [
  {
    type: "function",
    name: "receiveMessage",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Convert an address to bytes32 (left-padded with zeros).
 * Required by CCTP for mintRecipient.
 */
export function addressToBytes32(address: string): `0x${string}` {
  return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
}

/**
 * Poll Circle's attestation API until the message is signed.
 * Returns { message, attestation } for use in receiveMessage.
 */
export async function waitForAttestation(
  sourceDomain: number,
  txHash: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<{ message: string; attestation: string }> {
  const baseUrl = "https://iris-api-sandbox.circle.com"; // testnet

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${txHash}`
    );

    if (res.ok) {
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        const msg = data.messages[0];
        if (msg.status === "complete") {
          return {
            message: msg.message,
            attestation: msg.attestation,
          };
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Attestation timeout — message not signed after max attempts");
}
