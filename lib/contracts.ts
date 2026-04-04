// AdvanceEscrow contract ABI + helpers
// Payroll ABI lives in lib/payroll-contract.ts

export const ADVANCE_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ADVANCE_ESCROW_ADDRESS as `0x${string}` | undefined;

export const ADVANCE_ESCROW_ABI = [
  {
    type: "function",
    name: "createAdvance",
    inputs: [
      { name: "employee", type: "address" },
      { name: "grossAmount", type: "uint256" },
      { name: "interestBps", type: "uint256" },
      { name: "repayByTimestamp", type: "uint256" },
    ],
    outputs: [{ name: "advanceId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "releaseAdvance",
    inputs: [{ name: "advanceId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayAdvance",
    inputs: [{ name: "advanceId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getAdvance",
    inputs: [{ name: "advanceId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "employee", type: "address" },
          { name: "grossAmount", type: "uint256" },
          { name: "interestAmount", type: "uint256" },
          { name: "netAmount", type: "uint256" },
          { name: "repayByTimestamp", type: "uint256" },
          { name: "released", type: "bool" },
          { name: "repaid", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "advanceCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AdvanceCreated",
    inputs: [
      { name: "advanceId", type: "uint256", indexed: true },
      { name: "employee", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "interestAmount", type: "uint256", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdvanceReleased",
    inputs: [
      { name: "advanceId", type: "uint256", indexed: true },
      { name: "employee", type: "address", indexed: true },
      { name: "netAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdvanceRepaid",
    inputs: [
      { name: "advanceId", type: "uint256", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

// Arc native USDC: 1 USDC = 1e18 wei
export function usdcToWei(usdcAmount: number): bigint {
  return BigInt(Math.round(usdcAmount * 1e18));
}

export function weiToUsdc(wei: bigint): number {
  return Number(wei) / 1e18;
}

export function centsToWei(cents: number): bigint {
  return BigInt(cents) * BigInt(1e16);
}

export function weiToCents(wei: bigint): number {
  return Number(wei / BigInt(1e16));
}
