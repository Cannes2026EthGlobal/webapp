# On-Chain Settlement & CCTP Bridge Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Payroll.sol smart contract to the Arc Counting dashboard for on-chain salary settlements, extend it with advance escrow logic (interest on-chain), and add CCTP V2 bridging so employees on Arbitrum/Base can receive USDC bridged from Arc.

**Architecture:** Three layers: (1) Wagmi/Viem hooks that call Payroll.sol's `deposit()` and `pay()` from the dashboard, (2) a new `AdvanceEscrow.sol` contract that holds advances with on-chain interest logic, and (3) a CCTP V2 bridge helper that burns USDC on Arc and mints on Arbitrum/Base for cross-chain employee payouts. All contracts live in the `arc-counting` repo's `arc/` Foundry project but are called from the `revamp` frontend via Wagmi.

**Tech Stack:** Solidity 0.8.26, Foundry (build/test/deploy), Wagmi 3.x + Viem 2.x (frontend contract calls), Circle CCTP V2 (cross-chain USDC), Arc Testnet (chainId 5042002)

---

## Existing Context

**Payroll.sol** (`arc-counting/arc/src/Payroll.sol`):
- `deposit()` — fund contract with native USDC (msg.value)
- `pay(address recipient, uint256 amount)` — owner sends USDC to recipient
- `contractBalance()` — view current balance
- Owner-controlled, reentrancy-guarded
- Arc uses native USDC (no ERC20, 1 USDC = 1e18 wei)

**CCTP V2 contracts** (same addresses on all testnets):
- TokenMessengerV2: `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- MessageTransmitterV2: `0xE737e5cEBEBa77EFE34D4aa090756590b1CE275`
- Arc domain: 26, Arbitrum domain: 3, Base domain: 6

**CCTP flow**: approve → depositForBurn (source) → poll attestation API → receiveMessage (destination)

**Frontend**: Wagmi 3.x with Arc Testnet configured, `useWriteContract` / `useReadContract` hooks available.

---

## File Structure

```
revamp/
├── lib/
│   ├── contracts.ts                    # CREATE: ABI + addresses for Payroll + AdvanceEscrow
│   ├── cctp.ts                         # CREATE: CCTP V2 addresses, domain IDs, attestation polling
│   └── wcpay-client.ts                 # EXISTS (from salary advance plan)
├── hooks/
│   ├── use-payroll-contract.ts         # CREATE: deposit, pay, balance hooks
│   ├── use-advance-escrow.ts           # CREATE: createAdvance, releaseAdvance hooks
│   └── use-cctp-bridge.ts             # CREATE: bridge USDC from Arc to Arbitrum/Base
├── app/
│   └── dashboard/
│       └── treasury/
│           └── page.tsx                # MODIFY: add on-chain deposit/pay actions + CCTP bridge
└── convex/
    └── employeePayments.ts             # MODIFY: record txHash on settlement

arc-counting/
└── arc/
    ├── src/
    │   ├── Payroll.sol                 # EXISTS
    │   └── AdvanceEscrow.sol           # CREATE: on-chain advance with interest
    ├── test/
    │   └── AdvanceEscrow.t.sol         # CREATE: Foundry tests
    └── script/
        └── Deploy.s.sol                # MODIFY: deploy AdvanceEscrow too
```

---

### Task 1: Contract ABIs and Addresses

**Files:**
- Create: `revamp/lib/contracts.ts`

- [ ] **Step 1: Create contract constants file**

Create `lib/contracts.ts`:

```typescript
export const PAYROLL_ADDRESS = process.env.NEXT_PUBLIC_PAYROLL_ADDRESS as `0x${string}` | undefined;

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
    name: "pay",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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
```

- [ ] **Step 2: Add contract address env vars**

Append to `.env`:

```
# On-chain contracts (Arc Testnet)
NEXT_PUBLIC_PAYROLL_ADDRESS=0x_DEPLOY_AND_FILL_IN
NEXT_PUBLIC_ADVANCE_ESCROW_ADDRESS=0x_DEPLOY_AND_FILL_IN
```

- [ ] **Step 3: Commit**

```bash
git add lib/contracts.ts .env
git commit -m "feat: add Payroll + AdvanceEscrow ABIs and address constants"
```

---

### Task 2: CCTP Bridge Helper

**Files:**
- Create: `revamp/lib/cctp.ts`

- [ ] **Step 1: Create CCTP constants and attestation poller**

Create `lib/cctp.ts`:

```typescript
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

// On Arc, USDC is native — but CCTP burns an ERC20 USDC token.
// Arc Testnet USDC ERC20 address for CCTP (check Circle docs for exact address):
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/cctp.ts
git commit -m "feat: add CCTP V2 constants, ABI, and attestation poller"
```

---

### Task 3: Payroll Contract Hooks

**Files:**
- Create: `revamp/hooks/use-payroll-contract.ts`

- [ ] **Step 1: Create Wagmi hooks for Payroll.sol**

Create `hooks/use-payroll-contract.ts`:

```typescript
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

export function usePayrollPay() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function pay(recipient: `0x${string}`, amountCents: number) {
    if (!PAYROLL_ADDRESS) throw new Error("Payroll contract address not set");
    writeContract({
      address: PAYROLL_ADDRESS,
      abi: PAYROLL_ABI,
      functionName: "pay",
      args: [recipient, centsToWei(amountCents)],
    });
  }

  return { pay, hash, isPending, isConfirming, isSuccess, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-payroll-contract.ts
git commit -m "feat: add Wagmi hooks for Payroll.sol (deposit, pay, balance)"
```

---

### Task 4: CCTP Bridge Hook

**Files:**
- Create: `revamp/hooks/use-cctp-bridge.ts`

- [ ] **Step 1: Create CCTP bridge hook**

Create `hooks/use-cctp-bridge.ts`:

```typescript
"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
  step: "idle" | "approving" | "burning" | "attesting" | "minting" | "done" | "error";
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
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // permissionless
          BigInt(0), // maxFee (0 = standard)
          0, // minFinalityThreshold (0 = fast)
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
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-cctp-bridge.ts
git commit -m "feat: add CCTP V2 bridge hook (Arc → Arbitrum/Base)"
```

---

### Task 5: AdvanceEscrow Smart Contract

**Files:**
- Create: `arc-counting/arc/src/AdvanceEscrow.sol`
- Create: `arc-counting/arc/test/AdvanceEscrow.t.sol`

- [ ] **Step 1: Create AdvanceEscrow contract**

Create `arc-counting/arc/src/AdvanceEscrow.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title AdvanceEscrow
 * @notice On-chain salary advance escrow with interest for ARC network.
 *
 *         The employer deposits USDC (native on ARC) into an advance.
 *         Interest is calculated and held in the contract.
 *         The net amount (gross - interest) is released to the employee.
 *         On payday, the employee's full advance amount is deducted (repaid).
 *
 *         Interest stays in the contract as employer revenue.
 */
contract AdvanceEscrow {
    struct Advance {
        address employee;
        uint256 grossAmount;
        uint256 interestAmount;
        uint256 netAmount;
        uint256 repayByTimestamp;
        bool released;
        bool repaid;
    }

    address public owner;
    uint256 private _locked = 1;
    uint256 public advanceCount;
    mapping(uint256 => Advance) public advances;

    event AdvanceCreated(
        uint256 indexed advanceId,
        address indexed employee,
        uint256 grossAmount,
        uint256 interestAmount,
        uint256 netAmount
    );
    event AdvanceReleased(
        uint256 indexed advanceId,
        address indexed employee,
        uint256 netAmount
    );
    event AdvanceRepaid(uint256 indexed advanceId, uint256 grossAmount);
    event InterestWithdrawn(address indexed to, uint256 amount);

    error Unauthorized();
    error Reentrancy();
    error ZeroAmount();
    error ZeroAddress();
    error InvalidInterest();
    error AlreadyReleased();
    error AlreadyRepaid();
    error NotReleased();
    error InsufficientValue();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    /**
     * @notice Create a new advance. Employer sends grossAmount as msg.value.
     * @param employee     Recipient of the advance.
     * @param grossAmount  Total advance amount (interest included).
     * @param interestBps  Interest rate in basis points (e.g. 200 = 2%).
     * @param repayByTimestamp  Unix timestamp by which the advance should be repaid.
     * @return advanceId   The ID of the created advance.
     */
    function createAdvance(
        address employee,
        uint256 grossAmount,
        uint256 interestBps,
        uint256 repayByTimestamp
    ) external payable onlyOwner returns (uint256 advanceId) {
        if (employee == address(0)) revert ZeroAddress();
        if (grossAmount == 0) revert ZeroAmount();
        if (msg.value < grossAmount) revert InsufficientValue();
        if (interestBps > 5000) revert InvalidInterest(); // max 50%

        uint256 interestAmount = (grossAmount * interestBps) / 10000;
        uint256 netAmount = grossAmount - interestAmount;

        advanceId = advanceCount++;
        advances[advanceId] = Advance({
            employee: employee,
            grossAmount: grossAmount,
            interestAmount: interestAmount,
            netAmount: netAmount,
            repayByTimestamp: repayByTimestamp,
            released: false,
            repaid: false
        });

        emit AdvanceCreated(advanceId, employee, grossAmount, interestAmount, netAmount);
    }

    /**
     * @notice Release the net amount to the employee.
     */
    function releaseAdvance(uint256 advanceId) external onlyOwner nonReentrant {
        Advance storage adv = advances[advanceId];
        if (adv.released) revert AlreadyReleased();

        adv.released = true;
        emit AdvanceReleased(advanceId, adv.employee, adv.netAmount);

        (bool success, ) = adv.employee.call{value: adv.netAmount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Repay the advance (deducted from paycheck). Anyone can call
     *         (allows the payroll contract to repay on behalf of the employee).
     */
    function repayAdvance(uint256 advanceId) external payable nonReentrant {
        Advance storage adv = advances[advanceId];
        if (!adv.released) revert NotReleased();
        if (adv.repaid) revert AlreadyRepaid();
        if (msg.value < adv.grossAmount) revert InsufficientValue();

        adv.repaid = true;
        emit AdvanceRepaid(advanceId, adv.grossAmount);

        // Refund excess
        uint256 excess = msg.value - adv.grossAmount;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            if (!success) revert TransferFailed();
        }
    }

    /**
     * @notice Withdraw accumulated interest to the owner.
     */
    function withdrawInterest(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();

        emit InterestWithdrawn(owner, amount);

        (bool success, ) = owner.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function getAdvance(uint256 advanceId) external view returns (Advance memory) {
        return advances[advanceId];
    }
}
```

- [ ] **Step 2: Create Foundry tests**

Create `arc-counting/arc/test/AdvanceEscrow.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/AdvanceEscrow.sol";

contract AdvanceEscrowTest is Test {
    AdvanceEscrow escrow;
    address employee = makeAddr("employee");
    address employer;

    function setUp() public {
        employer = address(this);
        escrow = new AdvanceEscrow();
        // Fund the test contract
        vm.deal(address(this), 100 ether);
    }

    function test_createAdvance() public {
        uint256 id = escrow.createAdvance{value: 10 ether}(
            employee,
            10 ether,
            200, // 2%
            block.timestamp + 30 days
        );
        assertEq(id, 0);

        AdvanceEscrow.Advance memory adv = escrow.getAdvance(0);
        assertEq(adv.employee, employee);
        assertEq(adv.grossAmount, 10 ether);
        assertEq(adv.interestAmount, 0.2 ether); // 2% of 10
        assertEq(adv.netAmount, 9.8 ether);
        assertFalse(adv.released);
        assertFalse(adv.repaid);
    }

    function test_releaseAdvance() public {
        escrow.createAdvance{value: 10 ether}(employee, 10 ether, 200, block.timestamp + 30 days);

        uint256 balBefore = employee.balance;
        escrow.releaseAdvance(0);
        uint256 balAfter = employee.balance;

        assertEq(balAfter - balBefore, 9.8 ether);

        AdvanceEscrow.Advance memory adv = escrow.getAdvance(0);
        assertTrue(adv.released);
    }

    function test_repayAdvance() public {
        escrow.createAdvance{value: 10 ether}(employee, 10 ether, 200, block.timestamp + 30 days);
        escrow.releaseAdvance(0);

        // Repay from a different address (simulating payroll contract)
        address payer = makeAddr("payer");
        vm.deal(payer, 20 ether);
        vm.prank(payer);
        escrow.repayAdvance{value: 10 ether}(0);

        AdvanceEscrow.Advance memory adv = escrow.getAdvance(0);
        assertTrue(adv.repaid);
    }

    function test_cannotReleaseUnauthorized() public {
        escrow.createAdvance{value: 10 ether}(employee, 10 ether, 200, block.timestamp + 30 days);

        vm.prank(employee);
        vm.expectRevert(AdvanceEscrow.Unauthorized.selector);
        escrow.releaseAdvance(0);
    }

    function test_cannotReleaseTwice() public {
        escrow.createAdvance{value: 10 ether}(employee, 10 ether, 200, block.timestamp + 30 days);
        escrow.releaseAdvance(0);

        vm.expectRevert(AdvanceEscrow.AlreadyReleased.selector);
        escrow.releaseAdvance(0);
    }

    function test_cannotRepayBeforeRelease() public {
        escrow.createAdvance{value: 10 ether}(employee, 10 ether, 200, block.timestamp + 30 days);

        vm.expectRevert(AdvanceEscrow.NotReleased.selector);
        escrow.repayAdvance{value: 10 ether}(0);
    }

    function testFuzz_interestCalculation(uint256 amount, uint256 bps) public {
        amount = bound(amount, 1 ether, 50 ether);
        bps = bound(bps, 1, 5000);
        vm.deal(address(this), amount);

        escrow.createAdvance{value: amount}(employee, amount, bps, block.timestamp + 30 days);

        AdvanceEscrow.Advance memory adv = escrow.getAdvance(0);
        assertEq(adv.interestAmount, (amount * bps) / 10000);
        assertEq(adv.netAmount, amount - adv.interestAmount);
    }

    receive() external payable {}
}
```

- [ ] **Step 3: Run Foundry tests**

```bash
cd /home/locallegend/Code/ethglobal_2026/arc-counting/arc && forge test -vv
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/AdvanceEscrow.sol test/AdvanceEscrow.t.sol
git commit -m "feat: add AdvanceEscrow contract with on-chain interest logic"
```

---

### Task 6: Advance Escrow Hook

**Files:**
- Create: `revamp/hooks/use-advance-escrow.ts`

- [ ] **Step 1: Create Wagmi hooks for AdvanceEscrow**

Create `hooks/use-advance-escrow.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-advance-escrow.ts
git commit -m "feat: add Wagmi hooks for AdvanceEscrow contract"
```

---

### Task 7: Wire Treasury Page with On-Chain Actions

**Files:**
- Modify: `revamp/app/dashboard/treasury/page.tsx`

This adds a "Deposit to Payroll Contract" button and a "Bridge USDC" panel to the existing treasury page.

- [ ] **Step 1: Read the current treasury page**

Read `app/dashboard/treasury/page.tsx` to understand the existing structure. The page currently shows balance cards and ledger entries.

- [ ] **Step 2: Add on-chain deposit and bridge sections**

Add two new cards to the treasury page after the existing content:

1. **Payroll Contract card** — shows on-chain balance, deposit form, and pay form
2. **CCTP Bridge card** — bridge USDC from Arc to Arbitrum/Base

Import and use the hooks:

```tsx
import { usePayrollBalance, usePayrollDeposit, usePayrollPay } from "@/hooks/use-payroll-contract";
import { useCctpBridge } from "@/hooks/use-cctp-bridge";
import { centsToWei } from "@/lib/contracts";
```

Add a `PayrollContractCard` component:

```tsx
function PayrollContractCard() {
  const { balanceCents, isLoading, refetch } = usePayrollBalance();
  const { deposit, isPending: isDepositing, isSuccess: depositSuccess } = usePayrollDeposit();
  const { pay, isPending: isPaying, isSuccess: paySuccess } = usePayrollPay();
  const [depositAmount, setDepositAmount] = useState("");
  const [payAddress, setPayAddress] = useState("");
  const [payAmount, setPayAmount] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Payroll Contract (On-Chain)</CardTitle>
        <CardDescription>
          Native USDC balance on Arc — {isLoading ? "..." : formatCents(balanceCents)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount (USD)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Button
            onClick={() => {
              const cents = Math.round(parseFloat(depositAmount) * 100);
              deposit(cents);
            }}
            disabled={isDepositing || !depositAmount}
          >
            {isDepositing ? "Depositing..." : "Deposit"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Recipient 0x..."
            value={payAddress}
            onChange={(e) => setPayAddress(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Amount (USD)"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <Button
            onClick={() => {
              const cents = Math.round(parseFloat(payAmount) * 100);
              pay(payAddress as `0x${string}`, cents);
            }}
            disabled={isPaying || !payAddress || !payAmount}
          >
            {isPaying ? "Paying..." : "Pay"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

Add a `CctpBridgeCard` component:

```tsx
function CctpBridgeCard() {
  const { bridge, state, reset } = useCctpBridge();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [destination, setDestination] = useState<"arbitrum" | "base">("arbitrum");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">CCTP Bridge (Arc → {destination})</CardTitle>
        <CardDescription>Bridge USDC to employee on another chain</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={destination} onValueChange={(v) => setDestination(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Recipient 0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <Input type="number" placeholder="USDC amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            const wei = centsToWei(Math.round(parseFloat(amount) * 100));
            bridge(wei, recipient as `0x${string}`, destination);
          }}
          disabled={state.step !== "idle" && state.step !== "done" && state.step !== "error"}
        >
          {state.step === "idle" ? "Bridge USDC" : state.step}
        </Button>
        {state.step === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
        {state.step === "done" && (
          <p className="text-xs text-green-600">
            Bridge complete! Burn tx: {state.burnTxHash?.slice(0, 10)}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify page renders**

```bash
npm run dev
```

Open `/dashboard/treasury`. Confirm the Payroll Contract and CCTP Bridge cards appear (they'll show "address not set" until contracts are deployed).

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/treasury/page.tsx
git commit -m "feat: add on-chain payroll deposit/pay and CCTP bridge to treasury page"
```

---

## Summary

| # | Task | What it builds |
|---|------|---------------|
| 1 | Contract ABIs | `lib/contracts.ts` — Payroll + AdvanceEscrow ABIs, address constants, wei/cents converters |
| 2 | CCTP helper | `lib/cctp.ts` — CCTP V2 addresses, domain IDs, attestation poller |
| 3 | Payroll hooks | `hooks/use-payroll-contract.ts` — deposit, pay, balance via Wagmi |
| 4 | CCTP bridge hook | `hooks/use-cctp-bridge.ts` — approve → burn → attest → mint flow |
| 5 | **AdvanceEscrow.sol** | On-chain advance escrow with interest (Arc prize target) + Foundry tests |
| 6 | Escrow hooks | `hooks/use-advance-escrow.ts` — createAdvance, releaseAdvance via Wagmi |
| 7 | Treasury page | Wire deposit/pay/bridge UI into existing treasury dashboard |

### On-Chain Flow

```
Salary Settlement:
  Operator → Payroll.sol.deposit(value: 10000 USDC)
  Operator → Payroll.sol.pay(employee, 10000 USDC)
  If employee on Arc: done
  If employee on Arbitrum/Base: CCTP bridge instead

Advance (On-Chain):
  Operator → AdvanceEscrow.createAdvance{value: 5000 USDC}(employee, 5000, 200bps, repayBy)
  → interest: 100 USDC held in contract
  → net: 4900 USDC escrowed
  Operator → AdvanceEscrow.releaseAdvance(id) → 4900 USDC sent to employee
  On payday → AdvanceEscrow.repayAdvance{value: 5000 USDC}(id) → marks repaid
  → 100 USDC interest stays in contract → owner can withdrawInterest()

CCTP Bridge (Arc → Arbitrum):
  1. approve(TokenMessenger, amount) on Arc
  2. depositForBurn(amount, domain=3, recipient, USDC) on Arc → burns USDC
  3. Poll iris-api-sandbox.circle.com until attestation complete
  4. receiveMessage(message, attestation) on Arbitrum → mints USDC to recipient
```
