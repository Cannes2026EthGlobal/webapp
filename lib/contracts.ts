// CRE-compatible Payroll contract (deployed on Arc Testnet)
// Payments are triggered by Chainlink CRE via KeystoneForwarder → onReport() ��� _processReport()
// The webapp can only deposit() funds and read contractBalance(). It cannot call pay() directly.
export const PAYROLL_ADDRESS = (process.env.NEXT_PUBLIC_PAYROLL_ADDRESS ?? "0xb2C0CBFc616199509AA0a890782c81772Bf632E1") as `0x${string}`;

export const PAYROLL_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "contractBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getForwarderAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FundsDeposited",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentSent",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

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

// Arc native USDC: 1 USDC = 1e18 wei (like ETH)
export function usdcToWei(usdcAmount: number): bigint {
  return BigInt(Math.round(usdcAmount * 1e18));
}

export function weiToUsdc(wei: bigint): number {
  return Number(wei) / 1e18;
}

// Convert dollar cents to wei (1 cent = 0.01 USDC = 1e16 wei)
export function centsToWei(cents: number): bigint {
  return BigInt(cents) * BigInt(1e16);
}

export function weiToCents(wei: bigint): number {
  return Number(wei / BigInt(1e16));
}
