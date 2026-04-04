# Salary Advance System & WalletConnect Pay Mock Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an employee salary advance system (employees request early paycheck access against interest, companies manage approvals with auto-disable on low treasury) and add WalletConnect Pay mock mode for Arc Testnet development.

**Architecture:** Two independent subsystems sharing the existing Convex schema. The salary advance system adds `advanceRequests` and `advanceSettings` tables, Convex functions for request/approve/deny/auto-deduct, an employee portal page, and a company payroll forecast page. The WC Pay mock adds `lib/wcpay-client.ts` with a mock/real toggle controlled by `WC_PAY_MOCK` env var. Both build on the existing `employees`, `employeePayments`, `companyBalances`, and `balanceEntries` tables.

**Tech Stack:** Convex (schema extension + functions + cron), Next.js 16 App Router (pages), existing Shadcn/ui components, WalletConnect Pay Merchant REST API

---

## Existing Codebase Context

The teammate already built:
- **Schema**: 9 tables (companies, employees, customers, products, employeePayments, customerPayments, companyBalances, balanceEntries) in `convex/schema.ts`
- **Employee payments**: Full state machine (draft→approved→queued→settled) with treasury debit on settle in `convex/employeePayments.ts`
- **Balance ledger**: `creditBalance()` and `debitBalance()` helpers in `convex/balances.ts`
- **Dashboard**: 7 pages including employee-payments with approve/queue/settle actions
- **Sidebar**: `components/app-sidebar.tsx` with 7 nav items + settings
- **Company hook**: `hooks/use-company.ts` gives `companyId` + `company` to all pages
- **Seed data**: 7 employees with varied compensation models, 9 payments including one advance

---

## File Structure

```
revamp/
├── convex/
│   ├── schema.ts                          # MODIFY: add advanceRequests + advanceSettings tables
│   ├── advanceRequests.ts                 # CREATE: request, approve, deny, list, auto-deduct
│   ├── advanceSettings.ts                 # CREATE: get/update settings per company
│   ├── payrollForecast.ts                 # CREATE: upcoming salary schedule + advance impact
│   └── crons.ts                           # CREATE: auto-disable advances on low treasury
├── app/
│   ├── employee-portal/
│   │   ├── layout.tsx                     # CREATE: employee portal layout (wallet auth, no sidebar)
│   │   └── page.tsx                       # CREATE: employee view — salary info + advance request
│   └── dashboard/
│       └── payroll/
│           └── page.tsx                   # CREATE: company payroll forecast + advance management
├── components/
│   └── app-sidebar.tsx                    # MODIFY: add Payroll nav item
├── lib/
│   └── wcpay-client.ts                   # CREATE: WC Pay client with mock mode
└── .env                                   # MODIFY: add WC Pay env vars
```

---

### Task 1: WalletConnect Pay Client with Mock Mode

**Files:**
- Modify: `revamp/.env`
- Create: `revamp/lib/wcpay-client.ts`

- [ ] **Step 1: Add WC Pay env vars to `.env`**

Append to the existing `.env` file (after the Convex vars):

```
# WalletConnect Pay — single merchant (server-side only)
WC_PAY_API_URL=https://api.pay.walletconnect.com
WC_PAY_API_KEY=your-api-key-here
WC_PAY_MERCHANT_ID=your-merchant-id-here
# Set to "true" for Arc Testnet (WC Pay doesn't support Arc).
# Set to "false" when using Arbitrum or Base for real WC Pay eligibility.
WC_PAY_MOCK=true
```

- [ ] **Step 2: Create the WC Pay client with mock mode**

Create `lib/wcpay-client.ts`:

```typescript
const API_URL = process.env.WC_PAY_API_URL ?? "https://api.pay.walletconnect.com";
const API_KEY = process.env.WC_PAY_API_KEY ?? "";
const MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID ?? "";
const IS_MOCK = process.env.WC_PAY_MOCK === "true";

function headers(): HeadersInit {
  return {
    "Api-Key": API_KEY,
    "Merchant-Id": MERCHANT_ID,
    "Content-Type": "application/json",
  };
}

// ─── Types ───

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

// ─── Real implementations ───

async function realCreatePayment(
  referenceId: string,
  amountCents: number,
  currency: "USD" | "EUR" = "USD"
): Promise<CreatePaymentResponse> {
  const res = await fetch(`${API_URL}/v1/merchants/payment`, {
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

async function realGetPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const res = await fetch(
    `${API_URL}/v1/merchants/payment/${paymentId}/status`,
    { method: "GET", headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`WC Pay getPaymentStatus failed: ${res.status}`);
  }
  return res.json();
}

async function realListAllPayments(
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
    `${API_URL}/v1/merchants/payments?${qs.toString()}`,
    { method: "GET", headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`WC Pay listAllPayments failed: ${res.status}`);
  }
  return res.json();
}

async function realCancelPayment(paymentId: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/payments/${paymentId}/cancel`, {
    method: "POST",
    headers: headers(),
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`WC Pay cancelPayment failed: ${res.status}`);
  }
}

// ─── Mock implementations (Arc Testnet) ───

let mockCounter = 0;

function mockCreatePayment(
  referenceId: string,
  _amountCents: number,
  _currency: "USD" | "EUR"
): CreatePaymentResponse {
  mockCounter++;
  const id = `pay_mock_${Date.now()}_${mockCounter}`;
  return {
    paymentId: id,
    gatewayUrl: `https://pay.walletconnect.com/?pid=${id}&mock=true`,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

function mockGetPaymentStatus(): PaymentStatus {
  return { status: "succeeded", isFinal: true, pollInMs: 0 };
}

function mockListAllPayments(): ListPaymentsResponse {
  return { data: [], nextCursor: null };
}

// ─── Exports (auto-switch based on WC_PAY_MOCK env var) ───

export const createPayment = IS_MOCK
  ? (ref: string, cents: number, cur: "USD" | "EUR" = "USD") =>
      Promise.resolve(mockCreatePayment(ref, cents, cur))
  : realCreatePayment;

export const getPaymentStatus = IS_MOCK
  ? (_id: string) => Promise.resolve(mockGetPaymentStatus())
  : realGetPaymentStatus;

export const listAllPayments = IS_MOCK
  ? (_p?: Parameters<typeof realListAllPayments>[0]) =>
      Promise.resolve(mockListAllPayments())
  : realListAllPayments;

export const cancelPayment = IS_MOCK
  ? (_id: string) => Promise.resolve()
  : realCancelPayment;

export const isMockMode = IS_MOCK;

/**
 * Parse a referenceId to extract companyId and invoiceId.
 * Format: "arc::{companyId}::{invoiceId}"
 */
export function parseReferenceId(
  referenceId: string
): { companyId: string; invoiceId: string } | null {
  const match = referenceId.match(/^arc::(.+?)::(.+)$/);
  if (!match) return null;
  return { companyId: match[1], invoiceId: match[2] };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/wcpay-client.ts .env
git commit -m "feat: add WC Pay client with mock mode for Arc Testnet"
```

---

### Task 2: Advance Schema Extension

**Files:**
- Modify: `revamp/convex/schema.ts`

Add two new tables to the existing schema. Do NOT modify existing tables.

- [ ] **Step 1: Add advanceSettings and advanceRequests tables**

Add these two tables inside the `defineSchema({})` call in `convex/schema.ts`, after the `balanceEntries` table:

```typescript
  // ─── Advance Settings (per company) ───
  advanceSettings: defineTable({
    companyId: v.id("companies"),
    enabled: v.boolean(),
    interestRateBps: v.number(), // basis points, e.g. 200 = 2%
    maxAdvancePercent: v.number(), // 0-100, max % of next paycheck
    autoDisableThresholdMonths: v.number(), // disable advances if treasury < N months of payroll
    autoDisabled: v.boolean(), // set by cron when threshold breached
  }).index("by_companyId", ["companyId"]),

  // ─── Advance Requests (employee → company) ───
  advanceRequests: defineTable({
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    requestedAmountCents: v.number(),
    interestAmountCents: v.number(), // calculated at request time
    netAmountCents: v.number(), // requestedAmountCents - interestAmountCents
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("settled"), // advance paid out
      v.literal("deducted"), // deducted from next paycheck
      v.literal("cancelled")
    ),
    reason: v.optional(v.string()),
    denyReason: v.optional(v.string()),
    // Links to the employeePayment created on approval
    advancePaymentId: v.optional(v.id("employeePayments")),
    // Links to the salary payment that deducted this advance
    deductedFromPaymentId: v.optional(v.id("employeePayments")),
    nextPaycheckDate: v.number(), // the paycheck this advance is against
    nextPaycheckAmountCents: v.number(), // employee's normal salary
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_employeeId", ["employeeId"])
    .index("by_employeeId_and_status", ["employeeId", "status"]),
```

- [ ] **Step 2: Push schema**

```bash
npx convex dev --once
```

Expected: Schema deploys with 11 tables total.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add advanceSettings and advanceRequests tables to schema"
```

---

### Task 3: Advance Settings Functions

**Files:**
- Create: `revamp/convex/advanceSettings.ts`

- [ ] **Step 1: Create advance settings functions**

Create `convex/advanceSettings.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS = {
  enabled: true,
  interestRateBps: 200, // 2%
  maxAdvancePercent: 80, // max 80% of next paycheck
  autoDisableThresholdMonths: 2, // disable if treasury < 2 months payroll
  autoDisabled: false,
};

export const getForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (!settings) return { ...DEFAULTS, companyId: args.companyId, _id: null };
    return settings;
  },
});

export const upsert = mutation({
  args: {
    companyId: v.id("companies"),
    enabled: v.optional(v.boolean()),
    interestRateBps: v.optional(v.number()),
    maxAdvancePercent: v.optional(v.number()),
    autoDisableThresholdMonths: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();

    const updates = {
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      ...(args.interestRateBps !== undefined && {
        interestRateBps: args.interestRateBps,
      }),
      ...(args.maxAdvancePercent !== undefined && {
        maxAdvancePercent: args.maxAdvancePercent,
      }),
      ...(args.autoDisableThresholdMonths !== undefined && {
        autoDisableThresholdMonths: args.autoDisableThresholdMonths,
      }),
    };

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("advanceSettings", {
      companyId: args.companyId,
      ...DEFAULTS,
      ...updates,
    });
  },
});

// Called by cron to auto-disable when treasury is low
export const setAutoDisabled = mutation({
  args: {
    companyId: v.id("companies"),
    autoDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { autoDisabled: args.autoDisabled });
    }
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/advanceSettings.ts
git commit -m "feat: add advance settings Convex functions"
```

---

### Task 4: Advance Request Functions

**Files:**
- Create: `revamp/convex/advanceRequests.ts`

- [ ] **Step 1: Create advance request functions**

Create `convex/advanceRequests.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { debitBalance } from "./balances";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("settled"),
  v.literal("deducted"),
  v.literal("cancelled")
);

// ─── Queries ───

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("advanceRequests")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(50);
  },
});

export const getActiveForEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    // Return any non-terminal advance (pending, approved, or settled but not yet deducted)
    const requests = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(10);
    return requests.filter(
      (r) => r.status === "pending" || r.status === "approved" || r.status === "settled"
    );
  },
});

// ─── Mutations ───

export const request = mutation({
  args: {
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    requestedAmountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate employee exists and belongs to company
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.companyId !== args.companyId) {
      throw new Error("Employee not found");
    }
    if (employee.status !== "active") {
      throw new Error("Only active employees can request advances");
    }

    // Check advance settings
    const settings = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();

    const enabled = settings?.enabled ?? true;
    const autoDisabled = settings?.autoDisabled ?? false;
    if (!enabled || autoDisabled) {
      throw new Error("Advance requests are currently disabled for this company");
    }

    const interestRateBps = settings?.interestRateBps ?? 200;
    const maxAdvancePercent = settings?.maxAdvancePercent ?? 80;

    // Check no existing active advance
    const existing = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId_and_status", (q) =>
        q.eq("employeeId", args.employeeId).eq("status", "pending")
      )
      .take(1);
    if (existing.length > 0) {
      throw new Error("You already have a pending advance request");
    }

    const settledAdvances = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId_and_status", (q) =>
        q.eq("employeeId", args.employeeId).eq("status", "settled")
      )
      .take(1);
    if (settledAdvances.length > 0) {
      throw new Error("You have an outstanding advance that hasn't been deducted yet");
    }

    // Validate amount against max % of next paycheck
    const maxAllowed = Math.floor(
      (employee.payoutAmountCents * maxAdvancePercent) / 100
    );
    if (args.requestedAmountCents > maxAllowed) {
      throw new Error(
        `Maximum advance is ${maxAdvancePercent}% of your paycheck ($${(maxAllowed / 100).toFixed(2)})`
      );
    }

    // Calculate interest
    const interestAmountCents = Math.ceil(
      (args.requestedAmountCents * interestRateBps) / 10000
    );
    const netAmountCents = args.requestedAmountCents - interestAmountCents;

    // Calculate next paycheck date (simple: next month 1st if monthly)
    const now = new Date();
    let nextPaycheckDate: number;
    if (employee.nextPaymentDate && employee.nextPaymentDate > now.getTime()) {
      nextPaycheckDate = employee.nextPaymentDate;
    } else {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextPaycheckDate = next.getTime();
    }

    return await ctx.db.insert("advanceRequests", {
      companyId: args.companyId,
      employeeId: args.employeeId,
      requestedAmountCents: args.requestedAmountCents,
      interestAmountCents,
      netAmountCents,
      currency: args.currency,
      status: "pending",
      reason: args.reason,
      nextPaycheckDate,
      nextPaycheckAmountCents: employee.payoutAmountCents,
    });
  },
});

export const approve = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only approve pending requests");
    }

    // Create an employee payment for the advance (net amount after interest)
    const paymentId = await ctx.db.insert("employeePayments", {
      companyId: request.companyId,
      employeeId: request.employeeId,
      type: "advance",
      amountCents: request.netAmountCents,
      currency: request.currency,
      status: "approved",
      description: `Salary advance (${request.interestAmountCents} interest deducted)`,
      scheduledDate: Date.now(),
    });

    await ctx.db.patch(args.id, {
      status: "approved",
      advancePaymentId: paymentId,
    });
  },
});

export const deny = mutation({
  args: {
    id: v.id("advanceRequests"),
    denyReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only deny pending requests");
    }
    await ctx.db.patch(args.id, {
      status: "denied",
      denyReason: args.denyReason,
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only cancel pending requests");
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});

// Called when the advance payment is settled (paid out to employee)
export const markSettled = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "approved") {
      throw new Error("Can only settle approved requests");
    }
    await ctx.db.patch(args.id, { status: "settled" });
  },
});

// Called when the advance is deducted from the next paycheck
export const markDeducted = mutation({
  args: {
    id: v.id("advanceRequests"),
    deductedFromPaymentId: v.id("employeePayments"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "settled") {
      throw new Error("Can only deduct settled advances");
    }
    await ctx.db.patch(args.id, {
      status: "deducted",
      deductedFromPaymentId: args.deductedFromPaymentId,
    });
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/advanceRequests.ts
git commit -m "feat: add advance request functions (request, approve, deny, settle, deduct)"
```

---

### Task 5: Payroll Forecast Functions

**Files:**
- Create: `revamp/convex/payrollForecast.ts`

- [ ] **Step 1: Create payroll forecast queries**

Create `convex/payrollForecast.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const upcoming = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .take(200);

    const now = Date.now();
    const months: Array<{
      month: string;
      totalSalaryCents: number;
      employeeCount: number;
      entries: Array<{
        employeeId: string;
        displayName: string;
        role: string;
        payoutAmountCents: number;
        frequency: string;
        hasActiveAdvance: boolean;
        advanceDeductionCents: number;
        netPayoutCents: number;
      }>;
    }> = [];

    // Generate 3 months of forecast
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      let totalSalaryCents = 0;
      const entries = [];

      for (const emp of employees) {
        // Only include salaried/monthly employees in forecast
        if (emp.compensationModel !== "salary" && emp.compensationModel !== "hourly") {
          continue;
        }

        // Check for outstanding advances
        const advances = await ctx.db
          .query("advanceRequests")
          .withIndex("by_employeeId_and_status", (q) =>
            q.eq("employeeId", emp._id).eq("status", "settled")
          )
          .take(1);

        const hasActiveAdvance = advances.length > 0;
        const advanceDeductionCents = hasActiveAdvance
          ? advances[0].requestedAmountCents // deduct full amount (interest already taken)
          : 0;
        const netPayoutCents = emp.payoutAmountCents - advanceDeductionCents;

        totalSalaryCents += netPayoutCents;

        entries.push({
          employeeId: emp._id,
          displayName: emp.displayName,
          role: emp.role,
          payoutAmountCents: emp.payoutAmountCents,
          frequency: emp.payoutFrequency,
          hasActiveAdvance,
          advanceDeductionCents,
          netPayoutCents,
        });
      }

      months.push({
        month: monthLabel,
        totalSalaryCents,
        employeeCount: entries.length,
        entries,
      });
    }

    return months;
  },
});

export const advanceSummary = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "pending")
      )
      .take(50);

    const settled = await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "settled")
      )
      .take(50);

    let pendingTotalCents = 0;
    for (const r of pending) pendingTotalCents += r.netAmountCents;

    let outstandingTotalCents = 0;
    for (const r of settled) outstandingTotalCents += r.requestedAmountCents;

    let totalInterestEarnedCents = 0;
    // Get all approved/settled/deducted to sum interest
    const all = await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(200);
    for (const r of all) {
      if (r.status === "approved" || r.status === "settled" || r.status === "deducted") {
        totalInterestEarnedCents += r.interestAmountCents;
      }
    }

    return {
      pendingCount: pending.length,
      pendingTotalCents,
      outstandingCount: settled.length,
      outstandingTotalCents,
      totalInterestEarnedCents,
    };
  },
});
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/payrollForecast.ts
git commit -m "feat: add payroll forecast queries (3-month schedule + advance summary)"
```

---

### Task 6: Auto-Disable Cron

**Files:**
- Create: `revamp/convex/crons.ts`

- [ ] **Step 1: Create cron for auto-disable check**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Check all companies: if treasury < N months of payroll, auto-disable advances
export const checkAdvanceThresholds = internalAction({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.runQuery(internal.crons.listAllCompanies, {});

    for (const company of companies) {
      const settings = await ctx.runQuery(
        internal.crons.getAdvanceSettingsInternal,
        { companyId: company._id }
      );
      if (!settings) continue;

      const balance = await ctx.runQuery(internal.crons.getBalanceInternal, {
        companyId: company._id,
      });

      const monthlyPayroll = await ctx.runQuery(
        internal.crons.getMonthlyPayrollInternal,
        { companyId: company._id }
      );

      const thresholdCents =
        monthlyPayroll * settings.autoDisableThresholdMonths;
      const shouldDisable = balance.availableCents < thresholdCents;

      if (shouldDisable !== settings.autoDisabled) {
        await ctx.runMutation(internal.crons.setAutoDisabledInternal, {
          companyId: company._id,
          autoDisabled: shouldDisable,
        });
      }
    }
  },
});

// ─── Internal helpers (queries/mutations called by the action) ───

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listAllCompanies = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").take(100);
  },
});

export const getAdvanceSettingsInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
  },
});

export const getBalanceInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", "USD")
      )
      .unique();
    return {
      availableCents: balance
        ? balance.totalCreditedCents - balance.totalDebitedCents
        : 0,
    };
  },
});

export const getMonthlyPayrollInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .take(200);
    let total = 0;
    for (const e of employees) {
      if (e.compensationModel === "salary") {
        total += e.payoutAmountCents;
      }
    }
    return total;
  },
});

export const setAutoDisabledInternal = internalMutation({
  args: {
    companyId: v.id("companies"),
    autoDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { autoDisabled: args.autoDisabled });
    }
  },
});

// ─── Cron schedule ───

const crons = cronJobs();

crons.interval(
  "check advance thresholds",
  { hours: 1 },
  internal.crons.checkAdvanceThresholds,
  {}
);

export default crons;
```

- [ ] **Step 2: Deploy and commit**

```bash
npx convex dev --once
git add convex/crons.ts
git commit -m "feat: add cron to auto-disable advances when treasury is low"
```

---

### Task 7: Employee Portal Page

**Files:**
- Create: `revamp/app/employee-portal/layout.tsx`
- Create: `revamp/app/employee-portal/page.tsx`

This is a separate route (not inside `/dashboard`). Employees connect their wallet, and the page shows them their salary info + advance request form. No sidebar — minimal UI.

- [ ] **Step 1: Create employee portal layout**

Create `app/employee-portal/layout.tsx`:

```tsx
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardAuthGuard } from "@/components/dashboard-auth-guard";

const AUTH_COOKIE = "arc-counting-auth";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  if (cookieStore.get(AUTH_COOKIE)?.value !== "1") {
    redirect("/");
  }

  return <DashboardAuthGuard>{children}</DashboardAuthGuard>;
}
```

- [ ] **Step 2: Create employee portal page**

Create `app/employee-portal/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "@/convex/_generated/api";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusColor(status: string) {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
    case "settled":
      return "default";
    case "denied":
    case "cancelled":
      return "destructive";
    case "deducted":
      return "outline";
    default:
      return "secondary";
  }
}

export default function EmployeePortalPage() {
  const { address } = useAppKitAccount();

  // Find all companies where this wallet is an employee
  const companies = useQuery(
    api.companies.list
  );

  // For MVP, we scan employees by wallet across all companies
  // In production, you'd have a proper employee auth system

  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Employee Portal</CardTitle>
            <CardDescription>
              Connect your wallet to view your salary information and request advances.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <EmployeePortalContent walletAddress={address} />;
}

function EmployeePortalContent({ walletAddress }: { walletAddress: string }) {
  // Find all companies (then filter for employee matching wallet)
  const companies = useQuery(api.companies.list);

  if (!companies) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // For each company, check if this wallet is an employee
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Employee Portal</h1>
        <p className="text-sm text-muted-foreground font-mono">{walletAddress}</p>
      </header>
      <div className="p-6 space-y-8">
        {companies.map((company) => (
          <EmployeeCompanySection
            key={company._id}
            companyId={company._id}
            companyName={company.name}
            walletAddress={walletAddress}
          />
        ))}
      </div>
    </div>
  );
}

function EmployeeCompanySection({
  companyId,
  companyName,
  walletAddress,
}: {
  companyId: string;
  companyName: string;
  walletAddress: string;
}) {
  const employees = useQuery(api.employees.listByCompany, {
    companyId: companyId as any,
    status: "active",
  });

  const employee = employees?.find(
    (e) => e.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!employee) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{companyName}</h2>
      <EmployeeSalaryCard employee={employee} companyId={companyId} />
    </div>
  );
}

function EmployeeSalaryCard({
  employee,
  companyId,
}: {
  employee: {
    _id: string;
    displayName: string;
    role: string;
    payoutAmountCents: number;
    payoutFrequency: string;
    compensationModel: string;
    nextPaymentDate?: number;
  };
  companyId: string;
}) {
  const settings = useQuery(api.advanceSettings.getForCompany, {
    companyId: companyId as any,
  });
  const activeAdvances = useQuery(api.advanceRequests.getActiveForEmployee, {
    employeeId: employee._id as any,
  });
  const advanceHistory = useQuery(api.advanceRequests.listByEmployee, {
    employeeId: employee._id as any,
  });
  const requestAdvance = useMutation(api.advanceRequests.request);
  const cancelAdvance = useMutation(api.advanceRequests.cancel);

  const [amount, setAmount] = useState("");

  const advancesEnabled =
    settings && settings.enabled && !settings.autoDisabled;
  const maxPercent = settings?.maxAdvancePercent ?? 80;
  const interestBps = settings?.interestRateBps ?? 200;
  const maxAmountCents = Math.floor(
    (employee.payoutAmountCents * maxPercent) / 100
  );
  const hasActiveAdvance = (activeAdvances?.length ?? 0) > 0;

  const handleRequest = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    try {
      await requestAdvance({
        companyId: companyId as any,
        employeeId: employee._id as any,
        requestedAmountCents: cents,
        currency: "USD",
      });
      toast.success("Advance request submitted");
      setAmount("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const interestPreview = amount
    ? Math.ceil((parseFloat(amount) * 100 * interestBps) / 10000)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Salary info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{employee.displayName}</CardTitle>
          <CardDescription>{employee.role}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Salary</span>
            <span className="font-medium">
              {formatCents(employee.payoutAmountCents)} / {employee.payoutFrequency}
            </span>
          </div>
          {employee.nextPaymentDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next paycheck</span>
              <span>{formatDate(employee.nextPaymentDate)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Advance eligible</span>
            <span>{advancesEnabled ? `Up to ${formatCents(maxAmountCents)}` : "Disabled"}</span>
          </div>
          {settings?.autoDisabled && (
            <p className="text-xs text-destructive">
              Advances temporarily disabled — company treasury is low.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Request advance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Request Advance</CardTitle>
          <CardDescription>
            {interestBps / 100}% interest deducted upfront. Repaid from next paycheck.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasActiveAdvance ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You have an active advance:
              </p>
              {activeAdvances?.map((adv) => (
                <div
                  key={adv._id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {formatCents(adv.requestedAmountCents)}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      (net {formatCents(adv.netAmountCents)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(adv.status) as any}>
                      {adv.status}
                    </Badge>
                    {adv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelAdvance({ id: adv._id as any })}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : advancesEnabled ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(maxAmountCents / 100).toFixed(2)}
                  placeholder={`Max ${(maxAmountCents / 100).toFixed(2)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div className="rounded bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Requested</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Interest ({interestBps / 100}%)</span>
                    <span>-${(interestPreview / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>You receive</span>
                    <span>
                      ${(parseFloat(amount) - interestPreview / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <Button onClick={handleRequest} className="w-full" disabled={!amount}>
                Request Advance
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Advance requests are currently disabled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {advanceHistory && advanceHistory.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Advance History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advanceHistory.map((adv) => (
                  <TableRow key={adv._id}>
                    <TableCell>{formatCents(adv.requestedAmountCents)}</TableCell>
                    <TableCell className="text-destructive">
                      -{formatCents(adv.interestAmountCents)}
                    </TableCell>
                    <TableCell>{formatCents(adv.netAmountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(adv.status) as any}>
                        {adv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(adv._creationTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify page renders**

```bash
npm run dev
```

Open `http://localhost:3000/employee-portal`. Connect wallet. If the wallet matches a seeded employee's address, salary info + advance form should appear.

- [ ] **Step 4: Commit**

```bash
git add app/employee-portal/
git commit -m "feat: employee portal — salary view, advance request with interest preview"
```

---

### Task 8: Company Payroll Forecast Page

**Files:**
- Create: `revamp/app/dashboard/payroll/page.tsx`

- [ ] **Step 1: Create payroll forecast page**

Create `app/dashboard/payroll/page.tsx`:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function PayrollContent() {
  const { companyId } = useCompany();
  const forecast = useQuery(
    api.payrollForecast.upcoming,
    companyId ? { companyId } : "skip"
  );
  const advanceSummary = useQuery(
    api.payrollForecast.advanceSummary,
    companyId ? { companyId } : "skip"
  );
  const settings = useQuery(
    api.advanceSettings.getForCompany,
    companyId ? { companyId } : "skip"
  );
  const pendingRequests = useQuery(
    api.advanceRequests.listByCompany,
    companyId ? { companyId, status: "pending" as const } : "skip"
  );
  const updateSettings = useMutation(api.advanceSettings.upsert);
  const approveRequest = useMutation(api.advanceRequests.approve);
  const denyRequest = useMutation(api.advanceRequests.deny);

  if (!companyId || !forecast || !settings) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const handleToggle = async (enabled: boolean) => {
    await updateSettings({ companyId, enabled });
    toast.success(enabled ? "Advances enabled" : "Advances disabled");
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRequest({ id: id as any });
      toast.success("Advance approved — payment created");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeny = async (id: string) => {
    await denyRequest({ id: id as any, denyReason: "Denied by operator" });
    toast.success("Advance denied");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{advanceSummary?.pendingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {formatCents(advanceSummary?.pendingTotalCents ?? 0)} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding Advances</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{advanceSummary?.outstandingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {formatCents(advanceSummary?.outstandingTotalCents ?? 0)} to deduct
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interest Earned</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCents(advanceSummary?.totalInterestEarnedCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">from advances</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Advance Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.enabled && !settings.autoDisabled}
                onCheckedChange={handleToggle}
                disabled={settings.autoDisabled}
              />
              <span className="text-sm">
                {settings.autoDisabled
                  ? "Auto-disabled (low treasury)"
                  : settings.enabled
                    ? "Enabled"
                    : "Disabled"}
              </span>
            </div>
            {settings.autoDisabled && (
              <p className="mt-1 text-xs text-destructive">
                Treasury below {settings.autoDisableThresholdMonths}-month payroll threshold
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advance Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={(settings.interestRateBps / 100).toFixed(1)}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    interestRateBps: Math.round(parseFloat(e.target.value) * 100),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Max Advance (% of paycheck)</Label>
              <Input
                type="number"
                min="10"
                max="100"
                value={settings.maxAdvancePercent}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    maxAdvancePercent: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Auto-disable threshold (months)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={settings.autoDisableThresholdMonths}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    autoDisableThresholdMonths: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending advance requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Advance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Net Payout</TableHead>
                  <TableHead>Against Paycheck</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <PendingRequestRow
                    key={req._id}
                    request={req}
                    onApprove={() => handleApprove(req._id)}
                    onDeny={() => handleDeny(req._id)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 3-month forecast */}
      {forecast.map((month) => (
        <Card key={month.month}>
          <CardHeader>
            <CardTitle className="text-sm">{month.month}</CardTitle>
            <CardDescription>
              {month.employeeCount} employees · {formatCents(month.totalSalaryCents)} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Advance Deduction</TableHead>
                  <TableHead>Net Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {month.entries.map((entry) => (
                  <TableRow key={entry.employeeId}>
                    <TableCell className="font-medium">{entry.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.role}</TableCell>
                    <TableCell>{formatCents(entry.payoutAmountCents)}</TableCell>
                    <TableCell>
                      {entry.hasActiveAdvance ? (
                        <span className="text-destructive">
                          -{formatCents(entry.advanceDeductionCents)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCents(entry.netPayoutCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PendingRequestRow({
  request,
  onApprove,
  onDeny,
}: {
  request: any;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const employee = useQuery(api.employees.getById, {
    id: request.employeeId,
  });

  return (
    <TableRow>
      <TableCell className="font-medium">
        {employee?.displayName ?? "..."}
      </TableCell>
      <TableCell>{formatCents(request.requestedAmountCents)}</TableCell>
      <TableCell className="text-destructive">
        -{formatCents(request.interestAmountCents)}
      </TableCell>
      <TableCell>{formatCents(request.netAmountCents)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatCents(request.nextPaycheckAmountCents)} on{" "}
        {formatDate(request.nextPaycheckDate)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onDeny}>
            Deny
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PayrollPage() {
  return (
    <CompanyGuard>
      <PageHeader title="Payroll Forecast" description="Upcoming salaries, advance requests, and deduction schedule" />
      <PayrollContent />
    </CompanyGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/payroll/
git commit -m "feat: payroll forecast page — 3-month schedule, advance management, auto-disable"
```

---

### Task 9: Wire Sidebar Navigation

**Files:**
- Modify: `revamp/components/app-sidebar.tsx`

- [ ] **Step 1: Add Payroll nav item to sidebar**

In `components/app-sidebar.tsx`, add a "Payroll" entry to the `navItems` array after "Employee Payments":

```typescript
  {
    title: "Payroll",
    url: "/dashboard/payroll",
    icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
  },
```

The full `navItems` array should become (adding after line 66, the Employee Payments entry):

```typescript
const navItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
  },
  {
    title: "Employees",
    url: "/dashboard/employees",
    icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
  },
  {
    title: "Customers",
    url: "/dashboard/customers",
    icon: <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />,
  },
  {
    title: "Employee Payments",
    url: "/dashboard/employee-payments",
    icon: <HugeiconsIcon icon={ChartHistogramIcon} strokeWidth={2} />,
  },
  {
    title: "Payroll",
    url: "/dashboard/payroll",
    icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
  },
  {
    title: "Customer Payments",
    url: "/dashboard/customer-payments",
    icon: <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />,
  },
  {
    title: "Products & SDK",
    url: "/dashboard/products",
    icon: <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />,
  },
  {
    title: "Treasury",
    url: "/dashboard/treasury",
    icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
  },
];
```

Note: `Analytics01Icon` is already imported. We reuse it for Payroll since it fits the financial forecast context.

- [ ] **Step 2: Verify navigation**

```bash
npm run dev
```

Click "Payroll" in the sidebar. Confirm it navigates to `/dashboard/payroll`.

- [ ] **Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat: add Payroll to sidebar navigation"
```

---

### Task 10: Tests

**Files:**
- Create: `revamp/convex/advanceRequests.test.ts`

- [ ] **Step 1: Create tests for advance request flow**

Create `convex/advanceRequests.test.ts`:

```typescript
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupCompanyAndEmployee(t: ReturnType<typeof convexTest>) {
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Co",
    slug: "test-co",
    ownerWallet: "0xTEST",
  });

  const employeeId = await t.mutation(api.employees.create, {
    companyId,
    displayName: "Alice",
    role: "Engineer",
    employmentType: "full-time",
    compensationModel: "salary",
    payoutAsset: "USDC",
    payoutAmountCents: 1000000, // $10,000/month
    payoutFrequency: "monthly",
    walletVerified: true,
    privacyLevel: "verified",
    status: "active",
  });

  // Seed treasury so advances can be paid
  await t.mutation(api.balances.credit, {
    companyId,
    amountCents: 5000000, // $50,000
    currency: "USD",
    reason: "Initial treasury",
  });

  return { companyId, employeeId };
}

describe("advanceRequests", () => {
  test("employee can request an advance", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000, // $5,000
      currency: "USD",
    });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
    expect(requests[0].requestedAmountCents).toBe(500000);
    // 2% interest = $100
    expect(requests[0].interestAmountCents).toBe(10000);
    expect(requests[0].netAmountCents).toBe(490000);
  });

  test("cannot request more than max % of paycheck", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    await expect(
      t.mutation(api.advanceRequests.request, {
        companyId,
        employeeId,
        requestedAmountCents: 900000, // $9,000 = 90% of $10,000
        currency: "USD",
      })
    ).rejects.toThrow("Maximum advance");
  });

  test("cannot have two pending requests", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 300000,
      currency: "USD",
    });

    await expect(
      t.mutation(api.advanceRequests.request, {
        companyId,
        employeeId,
        requestedAmountCents: 200000,
        currency: "USD",
      })
    ).rejects.toThrow("already have a pending");
  });

  test("approve creates an employee payment", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000,
      currency: "USD",
    });

    await t.mutation(api.advanceRequests.approve, { id: requestId });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests[0].status).toBe("approved");
    expect(requests[0].advancePaymentId).toBeTruthy();

    // Verify the employee payment was created
    const payments = await t.query(api.employeePayments.listByEmployee, {
      employeeId,
    });
    const advancePayment = payments.find((p) => p.type === "advance");
    expect(advancePayment).toBeTruthy();
    expect(advancePayment!.amountCents).toBe(490000); // net after interest
    expect(advancePayment!.status).toBe("approved");
  });

  test("deny sets status and reason", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000,
      currency: "USD",
    });

    await t.mutation(api.advanceRequests.deny, {
      id: requestId,
      denyReason: "Budget constraints",
    });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests[0].status).toBe("denied");
    expect(requests[0].denyReason).toBe("Budget constraints");
  });
});

describe("advanceSettings", () => {
  test("returns defaults when no settings exist", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Default Co",
      slug: "default-co",
      ownerWallet: "0xDEF",
    });

    const settings = await t.query(api.advanceSettings.getForCompany, {
      companyId,
    });
    expect(settings.enabled).toBe(true);
    expect(settings.interestRateBps).toBe(200);
    expect(settings.maxAdvancePercent).toBe(80);
  });

  test("upsert creates and updates settings", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Settings Co",
      slug: "settings-co",
      ownerWallet: "0xSET",
    });

    await t.mutation(api.advanceSettings.upsert, {
      companyId,
      interestRateBps: 500,
    });

    const settings = await t.query(api.advanceSettings.getForCompany, {
      companyId,
    });
    expect(settings.interestRateBps).toBe(500);
    expect(settings.enabled).toBe(true); // default preserved
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run convex/advanceRequests.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add convex/advanceRequests.test.ts
git commit -m "test: advance request and settings tests"
```

---

## Summary

| # | Task | What it builds |
|---|------|---------------|
| 1 | **WC Pay client + mock** | `lib/wcpay-client.ts` — single merchant, auto-mock on Arc Testnet, real on Arbitrum/Base |
| 2 | **Schema extension** | `advanceRequests` + `advanceSettings` tables (11 tables total) |
| 3 | **Advance settings** | `convex/advanceSettings.ts` — defaults, upsert, auto-disable flag |
| 4 | **Advance requests** | `convex/advanceRequests.ts` — request with interest calc, approve (creates payment), deny, cancel, settle, deduct |
| 5 | **Payroll forecast** | `convex/payrollForecast.ts` — 3-month salary schedule with advance deductions, advance summary stats |
| 6 | **Auto-disable cron** | `convex/crons.ts` — hourly check: if treasury < N months payroll, auto-disable advances |
| 7 | **Employee portal** | `/employee-portal` — wallet-based employee view, salary info, advance request with interest preview, history |
| 8 | **Payroll dashboard** | `/dashboard/payroll` — 3-month forecast, pending request inbox (approve/deny), advance settings, auto-disable warning |
| 9 | **Sidebar nav** | Add "Payroll" to AppSidebar |
| 10 | **Tests** | Advance request lifecycle, settings defaults, max % validation, double-request prevention |

### Advance Flow

```
Employee Portal:
  Employee sees: salary $10,000/mo, next paycheck May 1, eligible up to $8,000
  Employee requests: $5,000 advance
  System calculates: 2% interest = $100, net payout = $4,900
  Status: pending
       │
       ▼
Company Payroll Dashboard:
  Operator sees pending request: Alice, $5,000, interest $100, net $4,900
  Operator clicks "Approve"
       │
       ▼
  System creates employeePayment: type=advance, amount=$4,900, status=approved
  Advance request status: approved → settled (when payment goes through)
       │
       ▼
  On next payday (May 1):
  Normal salary: $10,000
  Advance deduction: -$5,000 (full amount, interest already taken)
  Net payout: $5,000
  Advance request status: deducted

Auto-disable:
  Cron (hourly): treasury ($50k) < 2 × monthly payroll ($51.5k)?
  If yes: autoDisabled = true → employees see "Advances temporarily disabled"
  If treasury replenished: autoDisabled = false → re-enabled automatically
```
