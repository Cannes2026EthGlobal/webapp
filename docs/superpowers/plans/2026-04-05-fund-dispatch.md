# Fund Dispatch — Automated Payout to Companies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically dispatch funds from Arc Counting's master wallet to each company's settlement address (or custom per-link recipient) after WalletConnect Pay collects customer payments on Arbitrum/Base. Uses a private key in the backend to sign and send ERC20 USDC transfers.

**Architecture:** WC Pay sends all USDC to Arc Counting's wallet on Arbitrum or Base. A Convex action reads undispatched paid payments, groups by destination (company settlement address or custom recipient), calculates referral cuts, then uses viem + the backend private key to send ERC20 transfers. Each dispatch is recorded and the treasury ledger is debited.

**Tech Stack:** Convex (actions with `"use node"`), viem (wallet client from private key), USDC ERC20 transfers on Arbitrum Sepolia / Base Sepolia

---

## The Flow

```
Customer pays $100 via WC Pay
    ↓
USDC arrives at Arc Counting's wallet on Arbitrum (or Base)
    ↓
Convex dispatch action runs (triggered by operator or cron):
    1. Query all paid + undispatched customerPayments
    2. For each payment, resolve destination:
       - If checkout link has recipientAddress → use that
       - Else → use company.settlementAddress
    3. Calculate referral cuts (if link has referralPercentage)
    4. Group transfers by destination address
    5. For each transfer:
       - Sign USDC ERC20 transfer with private key
       - Send tx on Arbitrum/Base
       - Record txHash
    6. Mark payments as dispatched
    7. Debit company balance in ledger
```

## Env Vars Needed

```
# Arc Counting master wallet private key (NEVER expose client-side)
DISPATCH_PRIVATE_KEY=0x...

# Which chain Arc Counting receives WC Pay funds on
DISPATCH_CHAIN=arbitrum  # or "base"
DISPATCH_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# USDC contract on the dispatch chain
DISPATCH_USDC_ADDRESS=0xaf88d065e77c8cc2239327c5edb3a432268e5831
```

Set these on Convex too:
```bash
npx convex env set DISPATCH_PRIVATE_KEY "0x..."
npx convex env set DISPATCH_CHAIN "arbitrum"
npx convex env set DISPATCH_RPC_URL "https://sepolia-rollup.arbitrum.io/rpc"
npx convex env set DISPATCH_USDC_ADDRESS "0xaf88d065e77c8cc2239327c5edb3a432268e5831"
```

---

## File Structure

```
convex/
├── schema.ts              # MODIFY: add dispatched flag + dispatchRecords table
├── dispatch.ts            # CREATE: dispatch logic + on-chain transfer via private key
├── crons.ts               # MODIFY: optional auto-dispatch cron
app/(wallet)/dashboard/
└── treasury/page.tsx      # MODIFY: add dispatch section to treasury
```

---

### Task 1: Schema Changes

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add dispatched flag to customerPayments**

After `checkoutLinkId` in the customerPayments table, add:

```typescript
    dispatched: v.optional(v.boolean()),
    dispatchedAt: v.optional(v.number()),
```

- [ ] **Step 2: Add dispatchRecords table**

After the customerPayments table, add:

```typescript
  // ─── Dispatch Records (fund transfers from Arc Counting to companies) ───
  dispatchRecords: defineTable({
    companyId: v.id("companies"),
    destinationAddress: v.string(),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    chain: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("confirmed"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    paymentIds: v.array(v.id("customerPayments")),
    isReferral: v.optional(v.boolean()),
    referralName: v.optional(v.string()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_status", ["status"]),
```

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add dispatchRecords table and dispatched flag on customerPayments"
```

---

### Task 2: Dispatch Action (Backend with Private Key)

**Files:**
- Create: `convex/dispatch.ts`

This file uses `"use node"` because it needs viem to sign transactions with the private key. Actions in Convex can use Node.js built-ins.

- [ ] **Step 1: Create `convex/dispatch.ts`**

```typescript
"use node";

import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createWalletClient, http, parseUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, baseSepolia } from "viem/chains";

// ─── Config from env ───

const PRIVATE_KEY = process.env.DISPATCH_PRIVATE_KEY as `0x${string}` | undefined;
const CHAIN = process.env.DISPATCH_CHAIN ?? "arbitrum";
const RPC_URL = process.env.DISPATCH_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const USDC_ADDRESS = (process.env.DISPATCH_USDC_ADDRESS ?? "0xaf88d065e77c8cc2239327c5edb3a432268e5831") as `0x${string}`;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// ─── Internal queries/mutations ───

export const getUndispatchedPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allPaid = await ctx.db.query("customerPayments").take(500);
    return allPaid.filter((p) => p.status === "paid" && !p.dispatched);
  },
});

export const markDispatched = internalMutation({
  args: {
    paymentIds: v.array(v.id("customerPayments")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.paymentIds) {
      await ctx.db.patch(id, { dispatched: true, dispatchedAt: now });
    }
  },
});

export const createDispatchRecord = internalMutation({
  args: {
    companyId: v.id("companies"),
    destinationAddress: v.string(),
    amountCents: v.number(),
    chain: v.string(),
    paymentIds: v.array(v.id("customerPayments")),
    txHash: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    isReferral: v.optional(v.boolean()),
    referralName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dispatchRecords", {
      companyId: args.companyId,
      destinationAddress: args.destinationAddress,
      amountCents: args.amountCents,
      currency: "USD",
      chain: args.chain,
      status: args.status,
      txHash: args.txHash,
      errorMessage: args.errorMessage,
      paymentIds: args.paymentIds,
      isReferral: args.isReferral,
      referralName: args.referralName,
    });
  },
});

export const getCompany = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.companyId);
  },
});

export const getCheckoutLink = internalQuery({
  args: { linkId: v.id("checkoutLinks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.linkId);
  },
});

// ─── Send USDC ERC20 transfer ───

async function sendUsdc(
  to: string,
  amountCents: number
): Promise<{ txHash: string } | { error: string }> {
  if (!PRIVATE_KEY) return { error: "DISPATCH_PRIVATE_KEY not configured" };

  try {
    const account = privateKeyToAccount(PRIVATE_KEY);
    const chain = CHAIN === "base" ? baseSepolia : arbitrumSepolia;

    const client = createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });

    // USDC has 6 decimals on Arbitrum/Base
    const amount = parseUnits(String(amountCents / 100), 6);

    const txHash = await client.sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, amount],
      }),
    });

    return { txHash };
  } catch (e: any) {
    return { error: e.message?.slice(0, 200) ?? "Transfer failed" };
  }
}

// ─── Main dispatch action ───

export const dispatchAll = action({
  args: {},
  handler: async (ctx): Promise<{
    dispatched: number;
    failed: number;
    transfers: Array<{ to: string; amountCents: number; txHash?: string; error?: string }>;
  }> => {
    if (!PRIVATE_KEY) {
      return { dispatched: 0, failed: 0, transfers: [{ to: "", amountCents: 0, error: "DISPATCH_PRIVATE_KEY not set" }] };
    }

    const payments = await ctx.runQuery(internal.dispatch.getUndispatchedPayments, {});
    if (payments.length === 0) {
      return { dispatched: 0, failed: 0, transfers: [] };
    }

    // Build transfer map: destinationAddress → { amountCents, paymentIds, companyId }
    type Transfer = {
      destinationAddress: string;
      amountCents: number;
      companyId: string;
      paymentIds: string[];
      isReferral?: boolean;
      referralName?: string;
    };
    const transfers = new Map<string, Transfer>();

    for (const payment of payments) {
      let destination: string | undefined;
      let referralDestination: string | undefined;
      let referralCut = 0;
      let referralName: string | undefined;

      // Check checkout link for custom recipient + referral
      if (payment.checkoutLinkId) {
        const link = await ctx.runQuery(internal.dispatch.getCheckoutLink, {
          linkId: payment.checkoutLinkId,
        });
        if (link?.recipientAddress) {
          destination = link.recipientAddress;
        }
        if (link?.referralPercentage && link.referralPercentage > 0 && link.referralWalletAddress) {
          referralCut = Math.round((payment.amountCents * link.referralPercentage) / 100);
          referralDestination = link.referralWalletAddress;
          referralName = link.referralName ?? "Referrer";
        }
      }

      // Fall back to company settlement address
      if (!destination) {
        const company = await ctx.runQuery(internal.dispatch.getCompany, {
          companyId: payment.companyId,
        });
        destination = company?.settlementAddress;
      }

      if (!destination) continue; // skip if no destination configured

      // Main transfer (minus referral cut)
      const mainAmount = payment.amountCents - referralCut;
      const mainKey = `${payment.companyId}::${destination}`;
      const existing = transfers.get(mainKey);
      if (existing) {
        existing.amountCents += mainAmount;
        existing.paymentIds.push(payment._id);
      } else {
        transfers.set(mainKey, {
          destinationAddress: destination,
          amountCents: mainAmount,
          companyId: payment.companyId,
          paymentIds: [payment._id],
        });
      }

      // Referral transfer
      if (referralDestination && referralCut > 0) {
        const refKey = `${payment.companyId}::ref::${referralDestination}`;
        const existingRef = transfers.get(refKey);
        if (existingRef) {
          existingRef.amountCents += referralCut;
          existingRef.paymentIds.push(payment._id);
        } else {
          transfers.set(refKey, {
            destinationAddress: referralDestination,
            amountCents: referralCut,
            companyId: payment.companyId,
            paymentIds: [payment._id],
            isReferral: true,
            referralName,
          });
        }
      }
    }

    // Execute transfers
    let dispatched = 0;
    let failed = 0;
    const results: Array<{ to: string; amountCents: number; txHash?: string; error?: string }> = [];

    for (const transfer of transfers.values()) {
      if (transfer.amountCents <= 0) continue;

      const result = await sendUsdc(transfer.destinationAddress, transfer.amountCents);

      if ("txHash" in result) {
        await ctx.runMutation(internal.dispatch.createDispatchRecord, {
          companyId: transfer.companyId as any,
          destinationAddress: transfer.destinationAddress,
          amountCents: transfer.amountCents,
          chain: CHAIN,
          paymentIds: transfer.paymentIds as any[],
          txHash: result.txHash,
          status: "sent",
          isReferral: transfer.isReferral,
          referralName: transfer.referralName,
        });
        dispatched++;
        results.push({ to: transfer.destinationAddress, amountCents: transfer.amountCents, txHash: result.txHash });
      } else {
        await ctx.runMutation(internal.dispatch.createDispatchRecord, {
          companyId: transfer.companyId as any,
          destinationAddress: transfer.destinationAddress,
          amountCents: transfer.amountCents,
          chain: CHAIN,
          paymentIds: transfer.paymentIds as any[],
          status: "failed",
          errorMessage: result.error,
        });
        failed++;
        results.push({ to: transfer.destinationAddress, amountCents: transfer.amountCents, error: result.error });
      }
    }

    // Mark all source payments as dispatched
    const allPaymentIds = payments.map((p) => p._id);
    await ctx.runMutation(internal.dispatch.markDispatched, { paymentIds: allPaymentIds as any[] });

    return { dispatched, failed, transfers: results };
  },
});

// ─── Query dispatch history ───

export const listRecent = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dispatchRecords").order("desc").take(50);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/dispatch.ts
git commit -m "feat: automated fund dispatch with private key signing

Convex action that:
1. Reads undispatched paid payments
2. Resolves destination per payment (custom recipient > company settlement)
3. Calculates referral splits
4. Signs & sends ERC20 USDC transfers via private key
5. Records dispatch + marks payments dispatched"
```

---

### Task 3: Dispatch Button on Treasury Page

**Files:**
- Modify: `app/(wallet)/dashboard/treasury/page.tsx`

- [ ] **Step 1: Add dispatch section**

After the Ledger Entries card, add a "Fund Dispatch" card with:
- A "Dispatch All" button that calls `api.dispatch.dispatchAll` via `useAction`
- Shows result: how many dispatched, how many failed, tx hashes
- Note: this calls the Convex action which signs and sends on-chain — no wallet popup needed

```tsx
// In TreasuryContent, add:
const dispatchAll = useAction(api.dispatch.dispatchAll);
const [isDispatching, setIsDispatching] = useState(false);
const [dispatchResult, setDispatchResult] = useState<any>(null);

// Add card:
<Card>
  <CardHeader>
    <CardTitle>Fund Dispatch</CardTitle>
    <CardDescription>
      Send collected USDC to companies and referrers
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    <Button
      onClick={async () => {
        setIsDispatching(true);
        try {
          const result = await dispatchAll({});
          setDispatchResult(result);
          toast.success(`Dispatched ${result.dispatched} transfer(s)`);
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setIsDispatching(false);
        }
      }}
      disabled={isDispatching}
    >
      {isDispatching ? "Dispatching..." : "Dispatch All Pending"}
    </Button>
    {dispatchResult && (
      <div className="text-sm space-y-1">
        <p>Dispatched: {dispatchResult.dispatched}, Failed: {dispatchResult.failed}</p>
        {dispatchResult.transfers.map((t, i) => (
          <p key={i} className="font-mono text-xs">
            {t.to.slice(0, 10)}... → ${(t.amountCents / 100).toFixed(2)}
            {t.txHash ? ` ✓ ${t.txHash.slice(0, 14)}...` : ` ✗ ${t.error}`}
          </p>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 2: Commit**

```bash
git add "app/(wallet)/dashboard/treasury/page.tsx"
git commit -m "feat: add Dispatch All button to treasury page"
```

---

### Task 4: Optional Auto-Dispatch Cron

**Files:**
- Modify: `convex/crons.ts`

- [ ] **Step 1: Add auto-dispatch cron (optional)**

Add to the cron schedule in `convex/crons.ts`:

```typescript
crons.interval(
  "auto-dispatch funds to companies",
  { hours: 1 },
  internal.dispatch.dispatchAll,
  {}
);
```

This automatically dispatches every hour. Can be removed if manual dispatch is preferred.

- [ ] **Step 2: Commit**

```bash
git add convex/crons.ts
git commit -m "feat: add optional hourly auto-dispatch cron"
```

---

## Summary

| Task | What |
|------|------|
| 1 | Schema: `dispatchRecords` table + `dispatched` flag |
| 2 | `convex/dispatch.ts`: private key signing, ERC20 transfers, referral splits |
| 3 | Treasury page: "Dispatch All" button |
| 4 | Optional auto-dispatch cron |

### Key Design Decisions

- **Private key in Convex env** — `"use node"` action signs txs server-side. No wallet popup.
- **USDC has 6 decimals** on Arbitrum/Base (not 18 like Arc). `parseUnits(amount, 6)`.
- **Custom recipient address** is now wired: checkout link `recipientAddress` takes priority over company `settlementAddress`.
- **Referral splits** are separate transfers — referrer gets their cut directly.
- **No CCTP needed** — funds are already on Arbitrum/Base (where WC Pay sends them). Dispatch is a same-chain ERC20 transfer.
