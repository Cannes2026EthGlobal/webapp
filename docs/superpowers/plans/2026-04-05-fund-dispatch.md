# Fund Dispatch Plan — WC Pay → Arc Counting → Companies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When WalletConnect Pay collects customer payments, the USDC arrives on Arbitrum or Base at Arc Counting's master wallet. This plan implements the dispatch mechanism that splits and forwards those funds to each company's settlement address (or custom per-link recipient), handling referral commissions, and tracking everything in the Convex ledger.

**Architecture:** WC Pay sends all funds to one Arc Counting wallet on Arbitrum/Base. A Convex action ("dispatch") reads all `paid` customer payments that haven't been dispatched yet, groups them by company, calculates referral cuts, and creates `dispatchRecords` with the amounts + destination addresses. The operator then triggers on-chain USDC transfers from the treasury page (or a future cron automates it). Each dispatch is recorded in the balance ledger as a debit.

**Tech Stack:** Convex (dispatch logic + ledger), Wagmi/Viem (on-chain USDC transfers on Arbitrum/Base), existing CCTP bridge (for cross-chain if needed)

---

## The Problem

```
Customer pays $100 via WC Pay checkout link
         ↓
USDC arrives at Arc Counting's wallet on Arbitrum (or Base)
         ↓
NOW WHAT?
         ↓
Need to send:
  - $85 to company's settlement address (company keeps 85%)
  - $15 to referrer wallet (15% referral commission)
  OR
  - $100 to custom recipient address (if set on checkout link)
  OR
  - $100 to company's default settlement address (no referral)
```

## What exists today

- `customerPayments` records with `status: "paid"` and `amountCents`
- `checkoutLinkId` on each payment → links to referral config + custom recipient
- Company `settlementAddress` in schema (where company wants funds)
- `companyBalances` ledger (tracks credits/debits)
- CCTP bridge helper (`lib/cctp.ts`) for cross-chain transfers
- Treasury page with deposit UI

## What's missing

- No record of which payments have been dispatched vs pending
- No mechanism to calculate dispatch amounts per company
- No UI to trigger dispatches
- No on-chain transfer execution from the master wallet

---

## File Structure

```
convex/
├── schema.ts                    # MODIFY: add dispatchRecords table
├── dispatch.ts                  # CREATE: calculate + record dispatches
├── crons.ts                     # MODIFY: optional auto-dispatch cron

app/(wallet)/dashboard/treasury/
└── page.tsx                     # MODIFY: add dispatch section

lib/
└── cctp.ts                      # EXISTS: CCTP bridge (used if cross-chain needed)
```

---

### Task 1: Add dispatchRecords Table + dispatched Flag

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `dispatched` flag to customerPayments**

In `convex/schema.ts`, add to the `customerPayments` table (after `checkoutLinkId`):

```typescript
    dispatched: v.optional(v.boolean()),          // true once funds have been sent
    dispatchedAt: v.optional(v.number()),
```

- [ ] **Step 2: Add dispatchRecords table**

Add after the `customerPayments` table:

```typescript
  // ─── Dispatch Records (tracking fund transfers to companies) ───
  dispatchRecords: defineTable({
    companyId: v.id("companies"),
    totalAmountCents: v.number(),
    companyAmountCents: v.number(),          // amount going to company
    referralAmountCents: v.number(),          // total referral cuts
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    destinationAddress: v.string(),           // company settlement address
    destinationNetwork: v.string(),           // arbitrum, base, arc
    status: v.union(
      v.literal("pending"),                   // calculated, waiting for on-chain transfer
      v.literal("sent"),                      // on-chain tx submitted
      v.literal("confirmed"),                 // on-chain tx confirmed
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    paymentIds: v.array(v.id("customerPayments")),  // which payments are included
    referralPayments: v.optional(v.array(v.object({
      name: v.string(),
      walletAddress: v.string(),
      amountCents: v.number(),
      paymentId: v.id("customerPayments"),
    }))),
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

### Task 2: Dispatch Calculation Logic

**Files:**
- Create: `convex/dispatch.ts`

- [ ] **Step 1: Create dispatch functions**

Create `convex/dispatch.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { debitBalance } from "./balances";
import type { Id } from "./_generated/dataModel";

/**
 * Get all paid-but-not-dispatched payments grouped by company,
 * with calculated dispatch amounts.
 */
export const getPendingDispatches = query({
  args: {},
  handler: async (ctx) => {
    // Get all paid, undispatched payments
    const allPaid = await ctx.db
      .query("customerPayments")
      .take(500);
    const undispatched = allPaid.filter(
      (p) => p.status === "paid" && !p.dispatched
    );

    // Group by company
    const byCompany = new Map<string, typeof undispatched>();
    for (const p of undispatched) {
      const existing = byCompany.get(p.companyId) ?? [];
      existing.push(p);
      byCompany.set(p.companyId, existing);
    }

    // Calculate dispatch amounts per company
    const dispatches = [];
    for (const [companyId, payments] of byCompany) {
      const company = await ctx.db.get(companyId as Id<"companies">);
      if (!company) continue;

      let totalCents = 0;
      let referralCents = 0;
      const referralPayments: Array<{
        name: string;
        walletAddress: string;
        amountCents: number;
        paymentId: Id<"customerPayments">;
      }> = [];

      for (const payment of payments) {
        totalCents += payment.amountCents;

        // Check for referral commission on checkout link
        if (payment.checkoutLinkId) {
          const link = await ctx.db.get(payment.checkoutLinkId);
          if (link?.referralPercentage && link.referralPercentage > 0 && link.referralName && link.referralWalletAddress) {
            const commission = Math.round(
              (payment.amountCents * link.referralPercentage) / 100
            );
            referralCents += commission;
            referralPayments.push({
              name: link.referralName,
              walletAddress: link.referralWalletAddress,
              amountCents: commission,
              paymentId: payment._id,
            });
          }
        }
      }

      const companyCents = totalCents - referralCents;

      dispatches.push({
        companyId,
        companyName: company.name,
        destinationAddress: company.settlementAddress ?? "Not configured",
        destinationNetwork: company.settlementNetwork ?? "arbitrum",
        totalAmountCents: totalCents,
        companyAmountCents: companyCents,
        referralAmountCents: referralCents,
        referralPayments,
        paymentCount: payments.length,
        paymentIds: payments.map((p) => p._id),
        currency: "USD" as const,
      });
    }

    return dispatches;
  },
});

/**
 * Create a dispatch record and mark payments as dispatched.
 * Called when operator confirms a dispatch from the treasury page.
 */
export const createDispatch = mutation({
  args: {
    companyId: v.id("companies"),
    totalAmountCents: v.number(),
    companyAmountCents: v.number(),
    referralAmountCents: v.number(),
    destinationAddress: v.string(),
    destinationNetwork: v.string(),
    paymentIds: v.array(v.id("customerPayments")),
    referralPayments: v.optional(v.array(v.object({
      name: v.string(),
      walletAddress: v.string(),
      amountCents: v.number(),
      paymentId: v.id("customerPayments"),
    }))),
  },
  handler: async (ctx, args) => {
    // Create dispatch record
    const dispatchId = await ctx.db.insert("dispatchRecords", {
      companyId: args.companyId,
      totalAmountCents: args.totalAmountCents,
      companyAmountCents: args.companyAmountCents,
      referralAmountCents: args.referralAmountCents,
      currency: "USD",
      destinationAddress: args.destinationAddress,
      destinationNetwork: args.destinationNetwork,
      status: "pending",
      paymentIds: args.paymentIds,
      referralPayments: args.referralPayments,
    });

    // Mark all payments as dispatched
    const now = Date.now();
    for (const paymentId of args.paymentIds) {
      await ctx.db.patch(paymentId, {
        dispatched: true,
        dispatchedAt: now,
      });
    }

    // Debit the company balance (funds leaving Arc Counting's custody)
    await debitBalance(ctx, {
      companyId: args.companyId,
      amountCents: args.totalAmountCents,
      currency: "USD",
      reason: `Fund dispatch — ${args.paymentIds.length} payment(s) to ${args.destinationAddress.slice(0, 10)}...`,
    });

    return { dispatchId };
  },
});

/**
 * Mark a dispatch as sent (on-chain tx submitted).
 */
export const markSent = mutation({
  args: {
    dispatchId: v.id("dispatchRecords"),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dispatchId, {
      status: "sent",
      txHash: args.txHash,
    });
  },
});

/**
 * Mark a dispatch as confirmed (on-chain tx confirmed).
 */
export const markConfirmed = mutation({
  args: { dispatchId: v.id("dispatchRecords") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dispatchId, { status: "confirmed" });
  },
});

/**
 * List dispatch history for a company.
 */
export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dispatchRecords")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
  },
});

/**
 * List all pending dispatches (admin view).
 */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dispatchRecords")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(50);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/dispatch.ts
git commit -m "feat: add dispatch calculation and record creation logic"
```

---

### Task 3: Dispatch UI on Treasury Page

**Files:**
- Modify: `app/(wallet)/dashboard/treasury/page.tsx`

- [ ] **Step 1: Add dispatch section to treasury page**

After the Ledger Entries card, add a "Fund Dispatch" section that:
1. Shows pending dispatches (undispatched paid payments grouped by company)
2. For each company: total amount, company cut, referral cuts, destination address
3. "Dispatch" button that creates the dispatch record and marks payments
4. Dispatch history table

The dispatch section uses:
- `useQuery(api.dispatch.getPendingDispatches)` for pending
- `useQuery(api.dispatch.listByCompany, { companyId })` for history
- `useMutation(api.dispatch.createDispatch)` for the dispatch action
- After creating dispatch, operator triggers the on-chain transfer manually (sends USDC from master wallet to the destination)

Key UI elements:
- Card titled "Fund Dispatch"
- Table: Company, Total, Company Cut, Referral Cut, Destination, Network, Action
- "Dispatch" button per company → creates record, debits ledger
- After dispatch: shows as "Pending" → operator sends USDC on-chain → marks "Sent"
- Dispatch history table below

- [ ] **Step 2: Commit**

```bash
git add "app/(wallet)/dashboard/treasury/page.tsx"
git commit -m "feat: add fund dispatch UI to treasury page"
```

---

### Task 4: On-Chain Transfer Integration

**Files:**
- Modify: `app/(wallet)/dashboard/treasury/page.tsx`

- [ ] **Step 1: Add USDC transfer for dispatches**

For each pending dispatch, add a "Send USDC" button that:
1. Calls `sendTransactionAsync` to transfer USDC from the master wallet
2. On Arbitrum/Base: direct ERC20 transfer (USDC.transfer(destination, amount))
3. On Arc: native USDC transfer (send ETH-like tx)
4. After tx confirms: call `dispatch.markSent({ dispatchId, txHash })`

Since Arc Counting receives funds on Arbitrum or Base (the chains WC Pay supports), the transfer is a simple ERC20 `transfer()` call on the same chain — no CCTP bridge needed for dispatch.

USDC addresses:
- Arbitrum Sepolia: `0xaf88d065e77c8cc2239327c5edb3a432268e5831`
- Base Sepolia: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

- [ ] **Step 2: Commit**

```bash
git add "app/(wallet)/dashboard/treasury/page.tsx"
git commit -m "feat: add on-chain USDC transfer for fund dispatches"
```

---

## Summary

| Task | What |
|------|------|
| 1 | Schema: `dispatchRecords` table + `dispatched` flag on `customerPayments` |
| 2 | `convex/dispatch.ts`: calculate pending dispatches, create records, mark payments |
| 3 | Treasury UI: dispatch section showing pending + history |
| 4 | On-chain USDC transfer execution |

### Flow

```
1. Customer pays via WC Pay checkout link
   → USDC arrives at Arc Counting's wallet on Arbitrum/Base
   → customerPayment marked "paid", treasury credited

2. Operator opens Treasury → Fund Dispatch section
   → Sees: "Company X has $500 in undispatched funds"
   → Breakdown: $425 to company, $75 to referrers

3. Operator clicks "Dispatch"
   → dispatchRecord created (status: pending)
   → Payments marked dispatched: true
   → Treasury debited (funds leaving custody)

4. Operator clicks "Send USDC"
   → On-chain USDC transfer on Arbitrum/Base
   → dispatchRecord updated: status: sent, txHash
   → After confirmation: status: confirmed

Referral commissions:
   → Already handled: confirmPayment creates draft freelance payments
   → Referral payouts tracked on dispatch record for visibility
   → Actual referral transfer is a separate tx to referrer's wallet
```
