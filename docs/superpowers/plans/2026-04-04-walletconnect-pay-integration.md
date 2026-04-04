# WalletConnect Pay Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate WalletConnect Pay as the payment rail for Arc Counting — a single WC Pay merchant account handles all payments, while Convex segregates data per company, and a settlement layer redistributes funds.

**Architecture:** Arc Counting registers as a single WC Pay merchant. All payment requests across all companies go through this one merchant account. The `referenceId` on each payment (`arc_{companyId}_{invoiceId}`) is the routing key. A Convex cron syncs payments from WC Pay, parses the `referenceId` to fan out to the correct company, and marks invoices paid. A `companyBalances` ledger tracks what Arc Counting owes each company. Companies access their data via a public API authenticated with per-company API keys, or through the operator dashboard.

**Tech Stack:** Convex (DB + crons + actions), Next.js 16 App Router, WalletConnect Pay Merchant REST API (single merchant), `qrcode` npm package, Wagmi/Viem (on-chain settlement on Arc)

---

## Key Design Decision: Single Merchant

```
WalletConnect Pay
  └── 1 merchant: "Arc Counting"
        └── Api-Key: WC_PAY_API_KEY (env)
        └── Merchant-Id: WC_PAY_MERCHANT_ID (env)
        └── Transit wallet: receives ALL funds
        └── ALL payments from ALL companies land here

Arc Counting (Convex)
  └── N companies, each with:
        └── Their own API key (arc_live_...)
        └── Their own invoices
        └── Their own payment view (filtered by companyId)
        └── Their own balance (credited on payment, debited on payout)

Segregation method:
  └── referenceId = "arc_{companyId}_{invoiceId}"
  └── Convex parses this to route payments to the correct company
```

---

## File Structure

```
revamp/
├── convex/
│   ├── schema.ts                    # DB schema: companies, invoices, wcpayPayments, apiKeys, companyBalances
│   ├── companies.ts                 # Company CRUD
│   ├── invoices.ts                  # Invoice CRUD + WC Pay linking
│   ├── apiKeys.ts                   # Company API key management
│   ├── wcpay.ts                     # WC Pay sync action (single merchant → fan out by referenceId)
│   ├── wcpayPayments.ts             # Per-company payment queries + stats
│   ├── balances.ts                  # Company balance ledger (credit/debit/query)
│   ├── crons.ts                     # Cron: payment sync every 2 min
│   ├── http.ts                      # Public API endpoints (company-facing REST)
│   └── schema.test.ts              # Tests
├── app/
│   ├── api/wcpay/
│   │   ├── payments/route.ts        # Internal: create payment, list payments
│   │   └── payments/[paymentId]/status/route.ts  # Internal: poll status
│   ├── ConvexClientProvider.tsx      # "use client" Convex provider
│   ├── page.tsx                     # Landing page (replace placeholder)
│   └── dashboard/
│       ├── invoices/page.tsx        # Invoice list + create + QR
│       └── api-keys/page.tsx        # API key management (Products & SDK)
├── lib/
│   ├── wcpay-client.ts             # Server-side WC Pay API wrapper (single merchant)
│   ├── qr.ts                       # QR code generation
│   └── api-key.ts                  # API key generation + hashing
├── hooks/
│   └── use-payment-status.ts       # Client-side payment status poller
└── vitest.config.ts                # Test config
```

---

### Task 1: Environment Variables & WC Pay Client

**Files:**
- Modify: `revamp/.env`
- Create: `revamp/lib/wcpay-client.ts`

- [ ] **Step 1: Add WC Pay env vars to `.env`**

Append to the existing `.env`:

```
# WalletConnect Pay — single merchant (server-side only)
WC_PAY_API_URL=https://api.pay.walletconnect.com
WC_PAY_API_KEY=your-api-key-here
WC_PAY_MERCHANT_ID=your-merchant-id-here
```

- [ ] **Step 2: Create the WC Pay client**

Create `lib/wcpay-client.ts`. This uses the single merchant ID from env for every call:

```typescript
const API_URL = process.env.WC_PAY_API_URL!;
const API_KEY = process.env.WC_PAY_API_KEY!;
const MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID!;

function headers(): HeadersInit {
  return {
    "Api-Key": API_KEY,
    "Merchant-Id": MERCHANT_ID,
    "Content-Type": "application/json",
  };
}

export type CreatePaymentResponse = {
  paymentId: string;
  gatewayUrl: string;
  expiresAt: number | null;
};

export type PaymentStatus = {
  status:
    | "requires_action"
    | "processing"
    | "succeeded"
    | "failed"
    | "expired"
    | "cancelled";
  isFinal: boolean;
  pollInMs: number;
};

export type PaymentRecord = {
  paymentId: string;
  referenceId: string;
  status: string;
  isTerminal: boolean;
  fiatAmount: {
    value: string;
    unit: string;
    display: { formatted: string; assetSymbol: string };
  };
  tokenAmount?: {
    value: string;
    unit: string;
    display: {
      formatted: string;
      assetSymbol: string;
      decimals: number;
      networkName: string;
    };
  };
  buyer?: {
    accountCaip10: string;
    accountProviderName: string;
    accountProviderIcon: string;
  };
  transaction?: { networkId: string; hash: string; nonce: number };
  settlement?: { status: string; txHash: string };
  fees?: { total: string; fixed: string; percentage: string };
  createdAt: string;
  lastUpdatedAt: string;
  settledAt?: string;
};

export type ListPaymentsResponse = {
  data: PaymentRecord[];
  nextCursor: string | null;
  stats?: {
    totalRevenue: { value: string; unit: string }[];
    totalTransactions: number;
    totalCustomers: number;
  };
};

export async function createPayment(
  referenceId: string,
  amountCents: number,
  currency: "USD" | "EUR" = "USD"
): Promise<CreatePaymentResponse> {
  const res = await fetch(`${API_URL}/merchant/payment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      referenceId,
      amount: {
        value: String(amountCents),
        unit: `iso4217/${currency}`,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `WC Pay createPayment failed: ${res.status} ${(err as { message?: string }).message ?? ""}`
    );
  }
  return res.json();
}

export async function getPaymentStatus(
  paymentId: string
): Promise<PaymentStatus> {
  const res = await fetch(
    `${API_URL}/merchant/payment/${paymentId}/status`,
    { method: "GET", headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`WC Pay getPaymentStatus failed: ${res.status}`);
  }
  return res.json();
}

export async function listAllPayments(
  params?: {
    status?: string;
    limit?: number;
    cursor?: string;
    startTs?: string;
    endTs?: string;
    sortBy?: "date" | "amount";
    sortDir?: "asc" | "desc";
  }
): Promise<ListPaymentsResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.startTs) qs.set("startTs", params.startTs);
  if (params?.endTs) qs.set("endTs", params.endTs);
  if (params?.sortBy) qs.set("sortBy", params.sortBy);
  if (params?.sortDir) qs.set("sortDir", params.sortDir);

  const res = await fetch(
    `${API_URL}/merchants/payments?${qs.toString()}`,
    { method: "GET", headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`WC Pay listAllPayments failed: ${res.status}`);
  }
  return res.json();
}

export async function cancelPayment(paymentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/payments/${paymentId}/cancel`, {
    method: "POST",
    headers: headers(),
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`WC Pay cancelPayment failed: ${res.status}`);
  }
}

/**
 * Parse a referenceId to extract companyId and invoiceId.
 * Format: "arc_{companyId}_{invoiceId}"
 */
export function parseReferenceId(
  referenceId: string
): { companyId: string; invoiceId: string } | null {
  const match = referenceId.match(/^arc_([^_]+)_(.+)$/);
  if (!match) return null;
  return { companyId: match[1], invoiceId: match[2] };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/wcpay-client.ts .env
git commit -m "feat: add WC Pay client library (single merchant model)"
```

---

### Task 2: QR Code Helper

**Files:**
- Create: `revamp/lib/qr.ts`

- [ ] **Step 1: Install qrcode**

```bash
npm install qrcode @types/qrcode
```

- [ ] **Step 2: Create QR helper**

Create `lib/qr.ts`:

```typescript
import QRCode from "qrcode";

export async function generateQrDataUrl(
  url: string,
  width = 256
): Promise<string> {
  return QRCode.toDataURL(url, {
    width,
    margin: 2,
    color: { dark: "#2b2924", light: "#f5f1e8" },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/qr.ts package.json package-lock.json
git commit -m "feat: add QR code generation helper"
```

---

### Task 3: API Key Utilities

**Files:**
- Create: `revamp/lib/api-key.ts`

- [ ] **Step 1: Create API key utility**

Create `lib/api-key.ts`:

```typescript
import { randomBytes, createHash } from "crypto";

const PREFIX = "arc_live_";

export function generateApiKey(): { plaintext: string; hash: string } {
  const secret = randomBytes(32).toString("hex");
  const plaintext = `${PREFIX}${secret}`;
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api-key.ts
git commit -m "feat: add API key generation and hashing utility"
```

---

### Task 4: Convex Schema

**Files:**
- Create: `revamp/convex/schema.ts`

- [ ] **Step 1: Define the full schema**

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Companies ───
  companies: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerWallet: v.string(),
    treasuryAddress: v.optional(v.string()),
  })
    .index("by_ownerWallet", ["ownerWallet"])
    .index("by_slug", ["slug"]),

  // ─── Customers ───
  customers: defineTable({
    companyId: v.id("companies"),
    displayName: v.string(),
    customerType: v.union(
      v.literal("company"),
      v.literal("app"),
      v.literal("agent"),
      v.literal("buyer")
    ),
    walletAddress: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_companyId", ["companyId"]),

  // ─── Invoices ───
  invoices: defineTable({
    companyId: v.id("companies"),
    customerId: v.optional(v.id("customers")),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    wcPaymentId: v.optional(v.string()),
    gatewayUrl: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_wcPaymentId", ["wcPaymentId"])
    .index("by_referenceId", ["referenceId"]),

  // ─── WC Pay Synced Payments (all land under single merchant, segregated by companyId) ───
  wcpayPayments: defineTable({
    companyId: v.id("companies"),
    wcPaymentId: v.string(),
    referenceId: v.string(),
    invoiceId: v.optional(v.id("invoices")),
    status: v.string(),
    isFinal: v.boolean(),
    fiatValue: v.string(),
    fiatUnit: v.string(),
    fiatDisplay: v.optional(v.string()),
    tokenValue: v.optional(v.string()),
    tokenAsset: v.optional(v.string()),
    tokenNetwork: v.optional(v.string()),
    buyerAddress: v.optional(v.string()),
    buyerProvider: v.optional(v.string()),
    txHash: v.optional(v.string()),
    settlementStatus: v.optional(v.string()),
    settlementTxHash: v.optional(v.string()),
    feesTotal: v.optional(v.string()),
    wcCreatedAt: v.string(),
    wcSettledAt: v.optional(v.string()),
    lastSyncedAt: v.number(),
  })
    .index("by_companyId", ["companyId"])
    .index("by_wcPaymentId", ["wcPaymentId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_invoiceId", ["invoiceId"]),

  // ─── Company API Keys ───
  apiKeys: defineTable({
    companyId: v.id("companies"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    label: v.string(),
    isActive: v.boolean(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_companyId", ["companyId"]),

  // ─── Company Balance Ledger ───
  // Tracks what Arc Counting owes each company from WC Pay collections.
  // Credited when a payment succeeds, debited when funds are paid out.
  companyBalances: defineTable({
    companyId: v.id("companies"),
    // Running totals (in cents)
    totalCreditedCents: v.number(),
    totalDebitedCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_currency", ["companyId", "currency"]),

  // ─── Balance Ledger Entries (audit trail) ───
  balanceEntries: defineTable({
    companyId: v.id("companies"),
    type: v.union(v.literal("credit"), v.literal("debit")),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    wcPaymentId: v.optional(v.string()),
    payoutTxHash: v.optional(v.string()),
  }).index("by_companyId", ["companyId"]),
});
```

- [ ] **Step 2: Push schema to Convex**

```bash
npx convex dev --once
```

Expected: Schema deploys, `_generated/` files update.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: Convex schema — companies, invoices, wcpayPayments, apiKeys, balances"
```

---

### Task 5: Convex Provider in Next.js

**Files:**
- Create: `revamp/app/ConvexClientProvider.tsx`
- Modify: `revamp/app/layout.tsx`

- [ ] **Step 1: Create ConvexClientProvider**

Create `app/ConvexClientProvider.tsx`:

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

- [ ] **Step 2: Wrap layout**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import ContextProvider from "@/context";
import { ConvexClientProvider } from "./ConvexClientProvider";

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Arc Counting",
  description: "Powered by Reown",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const cookies = headersList.get("cookie");

  return (
    <html lang="en" suppressHydrationWarning className={fontSans.variable}>
      <body className="antialiased">
        <ConvexClientProvider>
          <ContextProvider cookies={cookies}>
            <ThemeProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ThemeProvider>
          </ContextProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify app loads**

```bash
npm run dev
```

Open `http://localhost:3000`. Confirm landing page renders, no Convex errors in console.

- [ ] **Step 4: Commit**

```bash
git add app/ConvexClientProvider.tsx app/layout.tsx
git commit -m "feat: wire ConvexClientProvider into root layout"
```

---

### Task 6: Company Convex Functions

**Files:**
- Create: `revamp/convex/companies.ts`

- [ ] **Step 1: Create company queries and mutations**

Create `convex/companies.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByWallet = query({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_ownerWallet", (q) => q.eq("ownerWallet", args.wallet))
      .take(20);
  },
});

export const getById = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    ownerWallet: v.string(),
    treasuryAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("companies", {
      name: args.name,
      slug: args.slug,
      ownerWallet: args.ownerWallet,
      treasuryAddress: args.treasuryAddress,
    });
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/companies.ts
git commit -m "feat: add company Convex queries and mutations"
```

---

### Task 7: Invoice Convex Functions

**Files:**
- Create: `revamp/convex/invoices.ts`

- [ ] **Step 1: Create invoice functions**

Create `convex/invoices.ts`:

```typescript
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("pending"),
        v.literal("paid"),
        v.literal("overdue"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("invoices")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("invoices")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const getById = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    customerId: v.optional(v.id("customers")),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    description: v.string(),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoices", {
      companyId: args.companyId,
      customerId: args.customerId,
      amountCents: args.amountCents,
      currency: args.currency,
      description: args.description,
      status: "draft",
      dueDate: args.dueDate,
    });
  },
});

export const linkWcPayment = mutation({
  args: {
    invoiceId: v.id("invoices"),
    wcPaymentId: v.string(),
    gatewayUrl: v.string(),
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      wcPaymentId: args.wcPaymentId,
      gatewayUrl: args.gatewayUrl,
      referenceId: args.referenceId,
      status: "sent",
    });
  },
});

export const markPaid = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    paidAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: args.paidAt,
    });
  },
});

export const markCancelled = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, { status: "cancelled" });
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/invoices.ts
git commit -m "feat: add invoice Convex functions with WC Pay linking"
```

---

### Task 8: Balance Ledger Functions

**Files:**
- Create: `revamp/convex/balances.ts`

This tracks what Arc Counting owes each company. When a WC Pay payment succeeds, the company gets credited. When Arc Counting pays out to the company's treasury wallet, the company gets debited.

- [ ] **Step 1: Create balance functions**

Create `convex/balances.ts`:

```typescript
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getForCompany = query({
  args: {
    companyId: v.id("companies"),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
  },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (!balance) {
      return { availableCents: 0, totalCreditedCents: 0, totalDebitedCents: 0 };
    }

    return {
      availableCents: balance.totalCreditedCents - balance.totalDebitedCents,
      totalCreditedCents: balance.totalCreditedCents,
      totalDebitedCents: balance.totalDebitedCents,
    };
  },
});

export const getEntriesForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("balanceEntries")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const credit = internalMutation({
  args: {
    companyId: v.id("companies"),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    wcPaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Upsert the running total
    const existing = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalCreditedCents: existing.totalCreditedCents + args.amountCents,
      });
    } else {
      await ctx.db.insert("companyBalances", {
        companyId: args.companyId,
        totalCreditedCents: args.amountCents,
        totalDebitedCents: 0,
        currency: args.currency,
      });
    }

    // Write audit entry
    await ctx.db.insert("balanceEntries", {
      companyId: args.companyId,
      type: "credit",
      amountCents: args.amountCents,
      currency: args.currency,
      reason: args.reason,
      wcPaymentId: args.wcPaymentId,
    });
  },
});

export const debit = internalMutation({
  args: {
    companyId: v.id("companies"),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    payoutTxHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (!existing) throw new Error("No balance record to debit");
    const available = existing.totalCreditedCents - existing.totalDebitedCents;
    if (args.amountCents > available) throw new Error("Insufficient balance");

    await ctx.db.patch(existing._id, {
      totalDebitedCents: existing.totalDebitedCents + args.amountCents,
    });

    await ctx.db.insert("balanceEntries", {
      companyId: args.companyId,
      type: "debit",
      amountCents: args.amountCents,
      currency: args.currency,
      reason: args.reason,
      payoutTxHash: args.payoutTxHash,
    });
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/balances.ts
git commit -m "feat: add company balance ledger (credit/debit/audit trail)"
```

---

### Task 9: WC Pay Sync Action (Translation Layer)

**Files:**
- Create: `revamp/convex/wcpay.ts`

This is the core: one call to WC Pay fetches ALL payments for the single merchant, then parses each `referenceId` to route payments to the correct company. On status change to `succeeded`, it marks the invoice paid and credits the company balance.

- [ ] **Step 1: Create sync action**

Create `convex/wcpay.ts`:

```typescript
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const WC_PAY_API_URL = process.env.WC_PAY_API_URL!;
const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY!;
const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID!;

function wcHeaders(): HeadersInit {
  return {
    "Api-Key": WC_PAY_API_KEY,
    "Merchant-Id": WC_PAY_MERCHANT_ID,
    "Content-Type": "application/json",
  };
}

// ─── Parse referenceId → companyId + invoiceId ───

function parseRef(referenceId: string): { companyId: string; invoiceId: string } | null {
  const match = referenceId.match(/^arc_([^_]+)_(.+)$/);
  if (!match) return null;
  return { companyId: match[1], invoiceId: match[2] };
}

// ─── Internal: upsert a single payment ───

export const upsertPayment = internalMutation({
  args: {
    companyId: v.id("companies"),
    wcPaymentId: v.string(),
    referenceId: v.string(),
    invoiceId: v.optional(v.id("invoices")),
    status: v.string(),
    isFinal: v.boolean(),
    fiatValue: v.string(),
    fiatUnit: v.string(),
    fiatDisplay: v.optional(v.string()),
    tokenValue: v.optional(v.string()),
    tokenAsset: v.optional(v.string()),
    tokenNetwork: v.optional(v.string()),
    buyerAddress: v.optional(v.string()),
    buyerProvider: v.optional(v.string()),
    txHash: v.optional(v.string()),
    settlementStatus: v.optional(v.string()),
    settlementTxHash: v.optional(v.string()),
    feesTotal: v.optional(v.string()),
    wcCreatedAt: v.string(),
    wcSettledAt: v.optional(v.string()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wcpayPayments")
      .withIndex("by_wcPaymentId", (q) => q.eq("wcPaymentId", args.wcPaymentId))
      .unique();

    if (existing) {
      const wasNotFinal = !existing.isFinal;
      await ctx.db.patch(existing._id, {
        status: args.status,
        isFinal: args.isFinal,
        buyerAddress: args.buyerAddress,
        buyerProvider: args.buyerProvider,
        txHash: args.txHash,
        tokenValue: args.tokenValue,
        tokenAsset: args.tokenAsset,
        tokenNetwork: args.tokenNetwork,
        settlementStatus: args.settlementStatus,
        settlementTxHash: args.settlementTxHash,
        feesTotal: args.feesTotal,
        wcSettledAt: args.wcSettledAt,
        lastSyncedAt: args.lastSyncedAt,
      });

      // Payment just succeeded → mark invoice paid + credit balance
      if (wasNotFinal && args.status === "succeeded") {
        if (existing.invoiceId) {
          await ctx.runMutation(internal.invoices.markPaid, {
            invoiceId: existing.invoiceId,
            paidAt: args.lastSyncedAt,
          });
        }
        // Credit the company balance
        const fiatCurrency = args.fiatUnit.includes("EUR") ? "EUR" as const : "USD" as const;
        await ctx.runMutation(internal.balances.credit, {
          companyId: args.companyId,
          amountCents: parseInt(args.fiatValue, 10) || 0,
          currency: fiatCurrency,
          reason: `WC Pay payment ${args.wcPaymentId}`,
          wcPaymentId: args.wcPaymentId,
        });
      }
    } else {
      // Find linked invoice by referenceId
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_referenceId", (q) => q.eq("referenceId", args.referenceId))
        .unique();

      await ctx.db.insert("wcpayPayments", {
        ...args,
        invoiceId: invoice?._id,
      });

      // If already succeeded on first sync
      if (args.status === "succeeded") {
        if (invoice) {
          await ctx.runMutation(internal.invoices.markPaid, {
            invoiceId: invoice._id,
            paidAt: args.lastSyncedAt,
          });
        }
        const fiatCurrency = args.fiatUnit.includes("EUR") ? "EUR" as const : "USD" as const;
        await ctx.runMutation(internal.balances.credit, {
          companyId: args.companyId,
          amountCents: parseInt(args.fiatValue, 10) || 0,
          currency: fiatCurrency,
          reason: `WC Pay payment ${args.wcPaymentId}`,
          wcPaymentId: args.wcPaymentId,
        });
      }
    }
  },
});

// ─── Internal: resolve companyId from a Convex ID string ───

export const resolveCompany = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.companyId);
  },
});

// ─── Main sync: fetch ALL payments from single merchant, fan out by referenceId ───

export const syncAllPayments = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalSynced = 0;
    let unroutable = 0;

    do {
      const qs = new URLSearchParams({ limit: "200" });
      if (cursor) qs.set("cursor", cursor);

      const res = await fetch(
        `${WC_PAY_API_URL}/merchants/payments?${qs.toString()}`,
        { method: "GET", headers: wcHeaders() }
      );

      if (!res.ok) throw new Error(`WC Pay sync failed: ${res.status}`);

      const body = (await res.json()) as {
        data: Array<{
          paymentId: string;
          referenceId: string;
          status: string;
          isTerminal: boolean;
          fiatAmount: { value: string; unit: string; display: { formatted: string } };
          tokenAmount?: { value: string; unit: string; display: { assetSymbol: string; decimals: number; networkName: string } };
          buyer?: { accountCaip10: string; accountProviderName: string };
          transaction?: { networkId: string; hash: string; nonce: number };
          settlement?: { status: string; txHash: string };
          fees?: { total: string };
          createdAt: string;
          settledAt?: string;
        }>;
        nextCursor: string | null;
      };

      const now = Date.now();

      for (const p of body.data) {
        const parsed = parseRef(p.referenceId);
        if (!parsed) {
          unroutable++;
          continue;
        }

        // Verify company exists
        const company = await ctx.runQuery(internal.wcpay.resolveCompany, {
          companyId: parsed.companyId as Id<"companies">,
        });
        if (!company) {
          unroutable++;
          continue;
        }

        await ctx.runMutation(internal.wcpay.upsertPayment, {
          companyId: parsed.companyId as Id<"companies">,
          wcPaymentId: p.paymentId,
          referenceId: p.referenceId,
          status: p.status,
          isFinal: p.isTerminal,
          fiatValue: p.fiatAmount.value,
          fiatUnit: p.fiatAmount.unit,
          fiatDisplay: p.fiatAmount.display?.formatted,
          tokenValue: p.tokenAmount?.value,
          tokenAsset: p.tokenAmount?.display?.assetSymbol,
          tokenNetwork: p.tokenAmount?.display?.networkName,
          buyerAddress: p.buyer?.accountCaip10,
          buyerProvider: p.buyer?.accountProviderName,
          txHash: p.transaction?.hash,
          settlementStatus: p.settlement?.status,
          settlementTxHash: p.settlement?.txHash,
          feesTotal: p.fees?.total,
          wcCreatedAt: p.createdAt,
          wcSettledAt: p.settledAt,
          lastSyncedAt: now,
        });
        totalSynced++;
      }

      cursor = body.nextCursor;
    } while (cursor);

    return { synced: totalSynced, unroutable };
  },
});
```

- [ ] **Step 2: Set WC Pay env vars on Convex deployment**

```bash
npx convex env set WC_PAY_API_URL "https://api.pay.walletconnect.com"
npx convex env set WC_PAY_API_KEY "your-api-key-here"
npx convex env set WC_PAY_MERCHANT_ID "your-merchant-id-here"
```

- [ ] **Step 3: Deploy and commit**

```bash
npx convex dev --once
git add convex/wcpay.ts
git commit -m "feat: WC Pay sync — single merchant, fan out by referenceId, credit balances"
```

---

### Task 10: Cron Job

**Files:**
- Create: `revamp/convex/crons.ts`

- [ ] **Step 1: Create cron**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync wcpay payments",
  { minutes: 2 },
  internal.wcpay.syncAllPayments,
  {}
);

export default crons;
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/crons.ts
git commit -m "feat: add cron — sync WC Pay payments every 2 min"
```

---

### Task 11: Per-Company Payment Queries

**Files:**
- Create: `revamp/convex/wcpayPayments.ts`

- [ ] **Step 1: Create dashboard queries**

Create `convex/wcpayPayments.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("wcpayPayments")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("wcpayPayments")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const getByInvoice = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wcpayPayments")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", args.invoiceId))
      .unique();
  },
});

export const statsForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("wcpayPayments")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(500);

    let totalRevenueCents = 0;
    let succeeded = 0;
    let pending = 0;
    let failed = 0;
    const uniqueBuyers = new Set<string>();

    for (const p of payments) {
      if (p.status === "succeeded") {
        totalRevenueCents += parseInt(p.fiatValue, 10) || 0;
        succeeded++;
      } else if (p.status === "requires_action" || p.status === "processing") {
        pending++;
      } else if (p.status === "failed" || p.status === "expired") {
        failed++;
      }
      if (p.buyerAddress) uniqueBuyers.add(p.buyerAddress);
    }

    return {
      totalRevenueCents,
      succeededCount: succeeded,
      pendingCount: pending,
      failedCount: failed,
      uniqueCustomers: uniqueBuyers.size,
    };
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/wcpayPayments.ts
git commit -m "feat: per-company payment queries and stats"
```

---

### Task 12: Next.js API Routes (Internal)

**Files:**
- Create: `revamp/app/api/wcpay/payments/route.ts`
- Create: `revamp/app/api/wcpay/payments/[paymentId]/status/route.ts`

- [ ] **Step 1: Create payment creation endpoint**

Create `app/api/wcpay/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/wcpay-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { referenceId, amountCents, currency } = body;

  if (!referenceId || !amountCents) {
    return NextResponse.json(
      { error: "Missing referenceId or amountCents" },
      { status: 400 }
    );
  }

  const result = await createPayment(referenceId, amountCents, currency);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create status polling endpoint**

Create `app/api/wcpay/payments/[paymentId]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/wcpay-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const result = await getPaymentStatus(paymentId);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/wcpay/
git commit -m "feat: internal API routes for WC Pay payment creation and status"
```

---

### Task 13: Payment Status Hook

**Files:**
- Create: `revamp/hooks/use-payment-status.ts`

- [ ] **Step 1: Create polling hook**

Create `hooks/use-payment-status.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

type PaymentStatusState = {
  status:
    | "requires_action"
    | "processing"
    | "succeeded"
    | "failed"
    | "expired"
    | "cancelled"
    | null;
  isFinal: boolean;
  isLoading: boolean;
  error: string | null;
};

export function usePaymentStatus(
  paymentId: string | null
): PaymentStatusState {
  const [state, setState] = useState<PaymentStatusState>({
    status: null,
    isFinal: false,
    isLoading: false,
    error: null,
  });

  const poll = useCallback(async () => {
    if (!paymentId) return null;

    setState((s) => ({ ...s, isLoading: true }));

    const res = await fetch(`/api/wcpay/payments/${paymentId}/status`);

    if (!res.ok) {
      setState((s) => ({ ...s, isLoading: false, error: `Poll failed: ${res.status}` }));
      return null;
    }

    const data = await res.json();
    setState({
      status: data.status,
      isFinal: data.isFinal,
      isLoading: false,
      error: null,
    });
    return data;
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function loop() {
      const data = await poll();
      if (cancelled || !data) return;
      if (!data.isFinal) {
        timeoutId = setTimeout(loop, data.pollInMs ?? 3000);
      }
    }

    loop();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [paymentId, poll]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-payment-status.ts
git commit -m "feat: usePaymentStatus polling hook"
```

---

### Task 14: API Key Convex Functions

**Files:**
- Create: `revamp/convex/apiKeys.ts`

- [ ] **Step 1: Create API key functions**

Create `convex/apiKeys.ts`:

```typescript
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(20);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      companyId: args.companyId,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      label: args.label,
      isActive: true,
    });
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

export const validateKeyHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();

    if (!apiKey || !apiKey.isActive) return null;

    const company = await ctx.db.get(apiKey.companyId);
    if (!company) return null;

    return {
      apiKeyId: apiKey._id,
      companyId: apiKey.companyId,
      companyName: company.name,
    };
  },
});

export const touchLastUsed = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/apiKeys.ts
git commit -m "feat: API key Convex functions (create, revoke, validate)"
```

---

### Task 15: Public API via Convex HTTP Actions (Middleware)

**Files:**
- Create: `revamp/convex/http.ts`

Companies call `POST <convex-site>/api/v1/payments` with `X-Api-Key`. Arc Counting validates key → creates invoice → calls WC Pay (single merchant) → returns `gatewayUrl`. Company never touches WC Pay.

- [ ] **Step 1: Create HTTP router**

Create `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

// ─── Helpers ───

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── CORS preflight ───

http.route({
  pathPrefix: "/api/v1/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

// ─── POST /api/v1/payments ───

http.route({
  path: "/api/v1/payments",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    await ctx.runMutation(internal.apiKeys.touchLastUsed, { id: auth.apiKeyId });

    const body = await req.json();
    const { amount, currency, description } = body as {
      amount: number;
      currency?: string;
      description?: string;
    };

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return err("amount must be a positive number (in dollars)", 400);
    }

    const amountCents = Math.round(amount * 100);
    const cur = currency === "EUR" ? "EUR" as const : "USD" as const;

    // Create invoice in Convex
    const invoiceId: Id<"invoices"> = await ctx.runMutation(api.invoices.create, {
      companyId: auth.companyId,
      amountCents,
      currency: cur,
      description: description ?? "Payment request",
    });

    const referenceId = `arc_${auth.companyId}_${invoiceId}`;

    // Call WC Pay (single merchant)
    const WC_PAY_API_URL = process.env.WC_PAY_API_URL!;
    const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY!;
    const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID!;

    const wcRes = await fetch(`${WC_PAY_API_URL}/merchant/payment`, {
      method: "POST",
      headers: {
        "Api-Key": WC_PAY_API_KEY,
        "Merchant-Id": WC_PAY_MERCHANT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceId,
        amount: { value: String(amountCents), unit: `iso4217/${cur}` },
      }),
    });

    if (!wcRes.ok) {
      const e = await wcRes.json().catch(() => ({}));
      return err(`Payment creation failed: ${(e as { message?: string }).message ?? wcRes.status}`, 502);
    }

    const { paymentId, gatewayUrl, expiresAt } = (await wcRes.json()) as {
      paymentId: string;
      gatewayUrl: string;
      expiresAt: number | null;
    };

    // Link back to invoice
    await ctx.runMutation(api.invoices.linkWcPayment, {
      invoiceId,
      wcPaymentId: paymentId,
      gatewayUrl,
      referenceId,
    });

    return json({
      paymentId,
      invoiceId,
      gatewayUrl,
      expiresAt,
      status: "requires_action",
    }, 201);
  }),
});

// ─── GET /api/v1/payments ───

http.route({
  path: "/api/v1/payments",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;

    const payments = await ctx.runQuery(api.wcpayPayments.listByCompany, {
      companyId: auth.companyId,
      status,
    });

    return json({ data: payments });
  }),
});

// ─── GET /api/v1/payments/:id/status ───

http.route({
  pathPrefix: "/api/v1/payments/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const paymentId = pathParts[4];

    if (!paymentId) return err("Missing paymentId", 400);

    if (pathParts[5] === "status") {
      const WC_PAY_API_URL = process.env.WC_PAY_API_URL!;
      const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY!;
      const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID!;

      const wcRes = await fetch(
        `${WC_PAY_API_URL}/merchant/payment/${paymentId}/status`,
        { headers: { "Api-Key": WC_PAY_API_KEY, "Merchant-Id": WC_PAY_MERCHANT_ID, "Content-Type": "application/json" } }
      );
      if (!wcRes.ok) return err(`Status check failed: ${wcRes.status}`, 502);
      return json(await wcRes.json());
    }

    if (pathParts[5] === "cancel") return err("Use POST for cancel", 405);

    return err("Not found", 404);
  }),
});

// ─── POST /api/v1/payments/:id/cancel ───

http.route({
  pathPrefix: "/api/v1/payments/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const paymentId = pathParts[4];

    if (!paymentId || pathParts[5] !== "cancel") return err("Invalid path", 400);

    const WC_PAY_API_URL = process.env.WC_PAY_API_URL!;
    const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY!;
    const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID!;

    const wcRes = await fetch(`${WC_PAY_API_URL}/payments/${paymentId}/cancel`, {
      method: "POST",
      headers: { "Api-Key": WC_PAY_API_KEY, "Merchant-Id": WC_PAY_MERCHANT_ID, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!wcRes.ok) return err(`Cancel failed: ${wcRes.status}`, 502);

    return json({ cancelled: true });
  }),
});

// ─── GET /api/v1/stats ───

http.route({
  path: "/api/v1/stats",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const stats = await ctx.runQuery(api.wcpayPayments.statsForCompany, {
      companyId: auth.companyId,
    });

    return json(stats);
  }),
});

// ─── GET /api/v1/balance ───

http.route({
  path: "/api/v1/balance",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") === "EUR" ? "EUR" as const : "USD" as const;

    const balance = await ctx.runQuery(api.balances.getForCompany, {
      companyId: auth.companyId,
      currency,
    });

    return json(balance);
  }),
});

export default http;
```

- [ ] **Step 2: Deploy and smoke test**

```bash
npx convex dev --once
```

Test route exists:

```bash
curl -s -X POST https://handsome-toucan-582.eu-west-1.convex.site/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: arc_live_fake" \
  -d '{"amount": 5.00}'
```

Expected: `{"error":"Invalid or revoked API key"}` with 401.

- [ ] **Step 3: Commit**

```bash
git add convex/http.ts
git commit -m "feat: public API middleware — single merchant, company isolation via API keys"
```

---

### Task 16: Invoices Dashboard Page

**Files:**
- Create: `revamp/app/dashboard/invoices/page.tsx`

- [ ] **Step 1: Create invoices page**

Create `app/dashboard/invoices/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateQrDataUrl } from "@/lib/qr";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function InvoicesPage() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const companyId = params.get("companyId") as Id<"companies"> | null;

  if (!companyId) {
    return (
      <div className="p-6 text-muted-foreground">
        No company selected. Add ?companyId=... to the URL.
      </div>
    );
  }

  return <InvoicesDashboard companyId={companyId} />;
}

function InvoicesDashboard({ companyId }: { companyId: Id<"companies"> }) {
  const invoices = useQuery(api.invoices.listByCompany, { companyId });
  const stats = useQuery(api.wcpayPayments.statsForCompany, { companyId });
  const balance = useQuery(api.balances.getForCompany, { companyId, currency: "USD" });
  const createInvoice = useMutation(api.invoices.create);
  const linkPayment = useMutation(api.invoices.linkWcPayment);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [activeQr, setActiveQr] = useState<{
    qrDataUrl: string;
    paymentId: string;
  } | null>(null);

  const handleCreate = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    const invoiceId = await createInvoice({
      companyId,
      amountCents: cents,
      currency: "USD",
      description: description || "Invoice",
    });

    const referenceId = `arc_${companyId}_${invoiceId}`;

    const res = await fetch("/api/wcpay/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceId, amountCents: cents, currency: "USD" }),
    });

    if (!res.ok) {
      alert("Failed to create WC Pay payment");
      return;
    }

    const { paymentId, gatewayUrl } = await res.json();

    await linkPayment({ invoiceId, wcPaymentId: paymentId, gatewayUrl, referenceId });

    const qrDataUrl = await generateQrDataUrl(gatewayUrl);
    setActiveQr({ qrDataUrl, paymentId });
    setAmount("");
    setDescription("");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Revenue" value={stats ? `$${(stats.totalRevenueCents / 100).toFixed(2)}` : "..."} />
        <StatCard label="Succeeded" value={stats ? String(stats.succeededCount) : "..."} />
        <StatCard label="Pending" value={stats ? String(stats.pendingCount) : "..."} />
        <StatCard label="Customers" value={stats ? String(stats.uniqueCustomers) : "..."} />
        <StatCard label="Balance" value={balance ? `$${(balance.availableCents / 100).toFixed(2)}` : "..."} />
      </div>

      {/* Create */}
      <div className="flex items-end gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Amount (USD)</label>
          <Input type="number" step="0.01" min="0.01" placeholder="5.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Description</label>
          <Input placeholder="Invoice description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button onClick={handleCreate}>Create Invoice & QR</Button>
      </div>

      {/* Active QR */}
      {activeQr && <ActivePaymentCard qrDataUrl={activeQr.qrDataUrl} paymentId={activeQr.paymentId} />}

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Description</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Payment ID</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => (
              <tr key={inv._id} className="border-b">
                <td className="p-3">{inv.description}</td>
                <td className="p-3">${(inv.amountCents / 100).toFixed(2)} {inv.currency}</td>
                <td className="p-3"><StatusBadge status={inv.status} /></td>
                <td className="p-3 font-mono text-xs">{inv.wcPaymentId ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(inv._creationTime).toLocaleDateString()}</td>
              </tr>
            ))}
            {invoices?.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivePaymentCard({ qrDataUrl, paymentId }: { qrDataUrl: string; paymentId: string }) {
  const status = usePaymentStatus(paymentId);
  return (
    <div className="flex items-center gap-6 rounded-md border p-4">
      <img src={qrDataUrl} alt="Payment QR" className="h-40 w-40" />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Scan to pay</p>
        <p className="font-mono text-xs text-muted-foreground">{paymentId}</p>
        {status.status && <StatusBadge status={status.status} />}
        {status.isFinal && status.status === "succeeded" && (
          <p className="text-sm font-medium text-green-600">Payment confirmed</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "paid" || status === "succeeded" ? "default"
    : status === "failed" || status === "expired" || status === "cancelled" ? "destructive"
    : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/invoices/
git commit -m "feat: invoices dashboard — create, QR code, live status, balance display"
```

---

### Task 17: API Keys Dashboard Page

**Files:**
- Create: `revamp/app/dashboard/api-keys/page.tsx`

- [ ] **Step 1: Create API keys page**

Create `app/dashboard/api-keys/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ApiKeysPage() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const companyId = params.get("companyId") as Id<"companies"> | null;

  if (!companyId) {
    return <div className="p-6 text-muted-foreground">No company selected.</div>;
  }

  return <ApiKeysDashboard companyId={companyId} />;
}

function ApiKeysDashboard({ companyId }: { companyId: Id<"companies"> }) {
  const keys = useQuery(api.apiKeys.listByCompany, { companyId });
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [label, setLabel] = useState("");
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);

  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

  const handleCreate = async () => {
    if (!label.trim()) return;

    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const plaintext = `arc_live_${secret}`;

    const data = new TextEncoder().encode(plaintext);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await createKey({
      companyId,
      keyHash,
      keyPrefix: plaintext.slice(0, 16) + "...",
      label: label.trim(),
    });

    setNewKeyPlaintext(plaintext);
    setLabel("");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground">Create payment requests from your application.</p>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="mb-2 text-sm font-medium">Your API endpoint</h3>
        <code className="block rounded bg-muted px-3 py-2 font-mono text-xs">
          POST {siteUrl}/api/v1/payments
        </code>
        <pre className="mt-3 rounded bg-muted p-3 font-mono text-xs leading-relaxed">
{`curl -X POST ${siteUrl}/api/v1/payments \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_API_KEY" \\
  -d '{"amount": 5.00, "currency": "USD", "description": "Order #123"}'`}
        </pre>
      </div>

      <div className="flex items-end gap-3 rounded-md border p-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input placeholder="e.g. Production POS" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button onClick={handleCreate}>Generate Key</Button>
      </div>

      {newKeyPlaintext && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="mb-2 text-sm font-medium">Copy this key now — it won't be shown again.</p>
          <code className="block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-black">{newKeyPlaintext}</code>
          <Button variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(newKeyPlaintext)}>
            Copy to clipboard
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Label</th>
              <th className="p-3">Key</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Used</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys?.map((k) => (
              <tr key={k._id} className="border-b">
                <td className="p-3">{k.label}</td>
                <td className="p-3 font-mono text-xs">{k.keyPrefix}</td>
                <td className="p-3"><Badge variant={k.isActive ? "default" : "destructive"}>{k.isActive ? "Active" : "Revoked"}</Badge></td>
                <td className="p-3 text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                <td className="p-3">
                  {k.isActive && <Button variant="outline" size="sm" onClick={() => revokeKey({ id: k._id })}>Revoke</Button>}
                </td>
              </tr>
            ))}
            {keys?.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No API keys yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/api-keys/
git commit -m "feat: API key management page with endpoint docs and curl example"
```

---

### Task 18: Landing Page

**Files:**
- Modify: `revamp/app/page.tsx`
- Modify: `revamp/app/globals.css`

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 2: Add brand tokens to globals.css**

Add inside the `:root` block in `app/globals.css`, after the existing Shadcn variables:

```css
/* Arc Counting brand tokens */
--tone-paper: oklch(0.97 0.012 95);
--tone-linen: oklch(0.94 0.014 95);
--tone-carbon: oklch(0.26 0.01 85);
--tone-ink: oklch(0.18 0.01 85);
--tone-green: oklch(0.58 0.07 165);
--tone-moss: oklch(0.46 0.06 165);
--tone-copper: oklch(0.67 0.09 55);
--tone-oxide: oklch(0.58 0.12 35);
--tone-fog: oklch(0.79 0.015 240);
--tone-border: oklch(0.88 0.005 90);
--tone-muted: oklch(0.55 0.01 90);
```

- [ ] **Step 3: Replace the landing page**

Replace `app/page.tsx` with the full product landing page containing:
1. Nav bar — AC monogram + wordmark + section links + `LandingAuthButton`
2. Hero — "Quiet infrastructure for real-time money movement." + subtitle + CTA
3. Product lanes — B2B (payroll/invoicing) and B2C (usage billing) cards with bullet points
4. Privacy state badges — Shielded, Pseudonymous, Verified, Multi-wallet
5. Console preview — mock dashboard with metrics ($482k treasury, $31k payroll due, $18k receivables, $2.4k usage), outbound desk (payroll batch, vendor invoice, bonus run), inbound desk (API usage, checkout link, B2B invoice)
6. Settlement flow — 3 steps: Create the payable → Route with intent → Close the ledger
7. Sponsor stack — Arc, Chainlink CRE, WalletConnect Pay, ENS, Uniswap v4, Hedera HTS
8. Footer CTA

All styled with brand tokens (paper background, ink text, verdigris green accents, warm editorial aesthetic). Content adapted from `arc-counting/app/components/landing-page.tsx`.

```tsx
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  FingerprintIcon,
  ReceiptText,
  Workflow,
} from "lucide-react";
import { LandingAuthButton } from "@/components/landing-auth-button";

const navLinks = [
  { name: "Overview", href: "#overview" },
  { name: "Model", href: "#model" },
  { name: "Console", href: "#console" },
  { name: "Settlement", href: "#settlement" },
];

const productLanes = [
  {
    id: "B2B layer",
    title: "Private ops for payroll and invoices.",
    description: "Run payroll, vendor payouts, and invoice settlement from one control desk.",
    icon: BriefcaseBusiness,
    points: ["Private payroll batches on Arc", "Receivables with optional liquidity paths", "Treasury-aware approvals and routing"],
  },
  {
    id: "B2C layer",
    title: "Usage billing for AI products.",
    description: "Meter usage, collect payment at the moment value is created.",
    icon: Bot,
    points: ["WalletConnect Pay for live checkout", "Usage, invoices, one-time payments, and reusable links", "Programmable settlement logic for software-native revenue"],
  },
];

const privacyStates = ["Shielded routes", "Pseudonymous employees", "Verified wallets", "Multi-wallet customers"];
const workspaceNav = ["Overview", "Employees", "Customers", "Employee Payments", "Customer Payments", "Products & SDK", "Treasury", "Settings"];
const overviewMetrics = [
  { label: "Treasury available", value: "$482k" },
  { label: "Payroll due", value: "$31k" },
  { label: "Pending receivables", value: "$18k" },
  { label: "Usage revenue today", value: "$2.4k" },
];
const outboundRows = [
  { name: "Payroll batch / Shielded", status: "Approved", amount: "$18.4k" },
  { name: "Vendor invoice / Verified", status: "Queued", amount: "$7.2k" },
  { name: "Bonus run / Pseudonymous", status: "Draft", amount: "$4.1k" },
];
const inboundRows = [
  { name: "API usage / Multi-wallet", status: "Streaming", amount: "$146" },
  { name: "Checkout link / Verified", status: "Settled", amount: "$2.1k" },
  { name: "B2B invoice / Company", status: "Pending", amount: "$9.8k" },
];
const settlementSteps = [
  { title: "Create the payable", description: "A payroll run, invoice event, or metered call becomes a visible money event.", icon: ReceiptText },
  { title: "Route with intent", description: "Approve, shield, meter, or collect without losing the operator view.", icon: FingerprintIcon },
  { title: "Close the ledger", description: "Arc settles, WalletConnect Pay captures, records land back in one room.", icon: Workflow },
];
const sponsorStack = ["Arc", "Chainlink CRE", "WalletConnect Pay", "ENS", "Uniswap v4", "Hedera HTS"];

export default function Page() {
  return (
    <div className="min-h-screen" style={{ background: "var(--tone-paper)", color: "var(--tone-ink)" }}>
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-full border font-mono text-xs tracking-widest" style={{ borderColor: "var(--tone-border)", background: "var(--tone-ink)", color: "var(--tone-paper)" }}>AC</div>
          <span className="text-sm font-semibold tracking-tight">Arc Counting</span>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (<a key={l.name} href={l.href} className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>{l.name}</a>))}
          <LandingAuthButton />
        </div>
        <div className="md:hidden"><LandingAuthButton /></div>
      </nav>

      {/* Hero */}
      <section id="overview" className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center md:pt-24">
        <h1 className="text-4xl font-light leading-tight tracking-tight md:text-5xl">Quiet infrastructure for<br />real-time money movement.</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: "var(--tone-muted)" }}>Private payroll, invoicing, and pay-as-you-go billing on Arc. One accounting surface for outbound operations and inbound revenue.</p>
        <div className="mt-8 flex justify-center"><LandingAuthButton /></div>
      </section>

      {/* Product Lanes */}
      <section id="model" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {productLanes.map((lane) => (
            <div key={lane.id} className="rounded-lg border p-6" style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}>
              <div className="mb-3 flex items-center gap-3">
                <lane.icon className="size-5" style={{ color: "var(--tone-green)" }} />
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--tone-muted)" }}>{lane.id}</span>
              </div>
              <h3 className="text-lg font-semibold">{lane.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--tone-muted)" }}>{lane.description}</p>
              <ul className="mt-4 space-y-1.5">
                {lane.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm" style={{ color: "var(--tone-carbon)" }}>
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--tone-green)" }} />{pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {privacyStates.map((s) => (<span key={s} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--tone-border)", color: "var(--tone-muted)" }}>{s}</span>))}
        </div>
      </section>

      {/* Console Preview */}
      <section id="console" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 text-center text-2xl font-light tracking-tight">One room for every money event.</h2>
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}>
          <div className="flex gap-1 overflow-x-auto border-b px-4 py-2" style={{ borderColor: "var(--tone-border)" }}>
            {workspaceNav.map((item, i) => (<span key={item} className="shrink-0 rounded px-2.5 py-1 text-xs" style={{ background: i === 0 ? "var(--tone-paper)" : "transparent", color: i === 0 ? "var(--tone-ink)" : "var(--tone-muted)", fontWeight: i === 0 ? 600 : 400 }}>{item}</span>))}
          </div>
          <div className="grid grid-cols-2 gap-px border-b md:grid-cols-4" style={{ borderColor: "var(--tone-border)", background: "var(--tone-border)" }}>
            {overviewMetrics.map((m) => (<div key={m.label} className="px-4 py-3" style={{ background: "var(--tone-linen)" }}><p className="text-xs" style={{ color: "var(--tone-muted)" }}>{m.label}</p><p className="mt-0.5 text-lg font-semibold">{m.value}</p></div>))}
          </div>
          <div className="grid md:grid-cols-2">
            <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "var(--tone-border)" }}>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--tone-muted)" }}>Outbound desk</p>
              <div className="space-y-2">
                {outboundRows.map((r) => (<div key={r.name} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ background: "var(--tone-paper)" }}><span>{r.name}</span><div className="flex items-center gap-3"><span className="text-xs" style={{ color: "var(--tone-muted)" }}>{r.status}</span><span className="font-medium">{r.amount}</span></div></div>))}
              </div>
            </div>
            <div className="p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--tone-muted)" }}>Inbound desk</p>
              <div className="space-y-2">
                {inboundRows.map((r) => (<div key={r.name} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ background: "var(--tone-paper)" }}><span>{r.name}</span><div className="flex items-center gap-3"><span className="text-xs" style={{ color: "var(--tone-muted)" }}>{r.status}</span><span className="font-medium">{r.amount}</span></div></div>))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Settlement Flow */}
      <section id="settlement" className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="mb-8 text-center text-2xl font-light tracking-tight">Three moves to close any money event.</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {settlementSteps.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-full border" style={{ borderColor: "var(--tone-border)", color: "var(--tone-green)" }}><step.icon className="size-5" /></div>
              <p className="mb-1 text-xs" style={{ color: "var(--tone-muted)" }}>Step {i + 1}</p>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--tone-muted)" }}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sponsors */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest" style={{ color: "var(--tone-muted)" }}>Built with</p>
        <div className="flex flex-wrap justify-center gap-3">
          {sponsorStack.map((s) => (<span key={s} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--tone-border)", color: "var(--tone-carbon)" }}>{s}</span>))}
        </div>
      </section>

      <footer className="pb-16 text-center"><LandingAuthButton /></footer>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Confirm warm paper background, hero, product lanes, console preview, sponsors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/globals.css package.json package-lock.json
git commit -m "feat: full product landing page with brand tokens"
```

---

### Task 19: Tests

**Files:**
- Create: `revamp/vitest.config.ts`
- Create: `revamp/convex/schema.test.ts`

- [ ] **Step 1: Install test deps**

```bash
npm install -D vitest convex-test @edge-runtime/vm
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Create tests**

Create `convex/schema.test.ts`:

```typescript
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("companies", () => {
  test("create and retrieve by wallet", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.companies.create, {
      name: "Test Corp",
      slug: "test-corp",
      ownerWallet: "0xABC123",
    });
    const companies = await t.query(api.companies.getByWallet, { wallet: "0xABC123" });
    expect(companies).toHaveLength(1);
    expect(companies[0]._id).toBe(id);
  });
});

describe("invoices", () => {
  test("create and list by company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Inv Co",
      slug: "inv-co",
      ownerWallet: "0x111",
    });
    await t.mutation(api.invoices.create, {
      companyId,
      amountCents: 5000,
      currency: "USD",
      description: "Test",
    });
    const invoices = await t.query(api.invoices.listByCompany, { companyId });
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("draft");
  });

  test("link WC payment changes status to sent", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Link Co",
      slug: "link-co",
      ownerWallet: "0x222",
    });
    const invoiceId = await t.mutation(api.invoices.create, {
      companyId,
      amountCents: 1000,
      currency: "USD",
      description: "Linked",
    });
    await t.mutation(api.invoices.linkWcPayment, {
      invoiceId,
      wcPaymentId: "pay_test",
      gatewayUrl: "https://pay.walletconnect.com/?pid=pay_test",
      referenceId: `arc_${companyId}_${invoiceId}`,
    });
    const inv = await t.query(api.invoices.getById, { id: invoiceId });
    expect(inv?.status).toBe("sent");
    expect(inv?.wcPaymentId).toBe("pay_test");
  });
});

describe("apiKeys", () => {
  test("create and list", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "API Co",
      slug: "api-co",
      ownerWallet: "0x333",
    });
    await t.mutation(api.apiKeys.create, {
      companyId,
      keyHash: "fakehash",
      keyPrefix: "arc_live_abc...",
      label: "Test Key",
    });
    const keys = await t.query(api.apiKeys.listByCompany, { companyId });
    expect(keys).toHaveLength(1);
    expect(keys[0].isActive).toBe(true);
  });

  test("revoke", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Rev Co",
      slug: "rev-co",
      ownerWallet: "0x444",
    });
    const keyId = await t.mutation(api.apiKeys.create, {
      companyId,
      keyHash: "hash2",
      keyPrefix: "arc_live_def...",
      label: "Temp",
    });
    await t.mutation(api.apiKeys.revoke, { id: keyId });
    const keys = await t.query(api.apiKeys.listByCompany, { companyId });
    expect(keys[0].isActive).toBe(false);
  });
});

describe("balances", () => {
  test("query returns zero for new company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Bal Co",
      slug: "bal-co",
      ownerWallet: "0x555",
    });
    const bal = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(bal.availableCents).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.test.ts vitest.config.ts package.json package-lock.json
git commit -m "test: Convex function tests for companies, invoices, API keys, balances"
```

---

## Summary

| # | Task | What it builds |
|---|------|---------------|
| 1 | WC Pay client | `lib/wcpay-client.ts` — single merchant, `parseReferenceId()` |
| 2 | QR helper | `lib/qr.ts` — branded QR data URLs |
| 3 | API key utils | `lib/api-key.ts` — generate + hash |
| 4 | Convex schema | 7 tables: companies, customers, invoices, wcpayPayments, apiKeys, companyBalances, balanceEntries |
| 5 | Convex provider | Wire into Next.js layout |
| 6 | Companies | CRUD queries/mutations |
| 7 | Invoices | CRUD + WC Pay linking + markPaid |
| 8 | **Balance ledger** | Credit on payment success, debit on payout, audit trail |
| 9 | **Sync action** | Single WC Pay call → parse referenceId → fan out to companies → credit balances |
| 10 | Cron | Sync every 2 min |
| 11 | Payment queries | Per-company filtered views + stats |
| 12 | Internal API routes | Next.js proxy to WC Pay (keys server-side) |
| 13 | Status hook | `usePaymentStatus(paymentId)` polling |
| 14 | API key functions | Create, revoke, validate (hash lookup) |
| 15 | **Public API** | Convex HTTP middleware — companies call us, we call WC Pay |
| 16 | Invoices page | Create → QR → poll → balance display |
| 17 | API keys page | Generate, revoke, curl examples |
| 18 | Landing page | Full product landing with brand tokens |
| 19 | Tests | Companies, invoices, API keys, balances |

### Flow

```
Company's App → POST /api/v1/payments (X-Api-Key: arc_live_...)
  │
  ▼
Arc Counting middleware (Convex HTTP):
  1. Hash key → lookup apiKeys → get companyId
  2. Create invoice in Convex (draft)
  3. Build referenceId = "arc_{companyId}_{invoiceId}"
  4. POST /merchant/payment to WC Pay (SINGLE merchant)
  5. Link paymentId + gatewayUrl to invoice (sent)
  6. Return { paymentId, gatewayUrl, expiresAt }
  │
  ▼
Customer scans QR → pays via wallet → WC Pay processes
  │
  ▼
Cron (every 2 min):
  GET /merchants/payments (ONE call, all payments)
  For each payment:
    Parse referenceId → extract companyId
    Upsert into wcpayPayments (tagged with companyId)
    If succeeded → invoice.markPaid() + balances.credit()
  │
  ▼
Company Dashboard: only sees their own payments (filtered by companyId)
Balance ledger: shows what Arc Counting owes them
Payout: operator triggers on-chain transfer to company treasury
```
