# Remaining Work — Prioritized Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining work across the three original plans (WC Pay integration, salary advance, on-chain settlement) and address gaps found during audit.

**Architecture:** Most backend + core features are done. Remaining work is: (1) demo-critical UI polish (landing page), (2) WC Pay payment sync to close the loop, (3) public developer API for the SDK story, (4) on-chain settlement hooks (CCTP bridge, AdvanceEscrow), and (5) multi-network support for real WC Pay eligibility.

**Tech Stack:** Convex, Next.js 16, Wagmi/Viem, WalletConnect Pay, Circle CCTP V2

---

## Audit Summary

### Fully Done (on main)

Everything from the **Salary Advance Plan** is complete and merged:
- Advance schema, settings, requests, payroll forecast, cron, employee portal, payroll dashboard

Core backend from the **WC Pay Plan** is done:
- WC Pay client with mock mode, ConvexClientProvider, companies, customerPayments, balances, crons, API routes (`/api/pay/create`, `/api/pay/status`, `/api/pay/webhook`), checkout page (`/checkout/[slug]`), checkout links CRUD, products page redesign with SDK tab

### In Open PRs (not yet on main)

| PR | What it adds | Conflicts with main? |
|----|-------------|---------------------|
| #6 `feat/wcpay-implementation` | apiKeys, convex/http.ts, developer page, QR helper, payment status hook | YES — main now has `/api/pay/` routes and checkout. PR has duplicate `/api/wcpay/` routes. |
| #7 `feat/menu-cleanup` | Sidebar reorganization | YES — main sidebar differs |
| #8 `feat/onchain-settlement-v2` | CCTP bridge, AdvanceEscrow hooks, treasury wiring | MINOR — treasury page diverged |

### Still Missing (not anywhere)

| # | Feature | Priority | Why |
|---|---------|----------|-----|
| **1** | **Landing page** | P0 — DEMO | Judges see this first. Current page is a bare h1 + button. |
| **2** | **Multi-network AppKit config** | P0 — PRIZE | Need Arbitrum/Base in AppKit for real WC Pay. Currently Arc-only. |
| **3** | **WC Pay payment sync** | P1 — FLOW | When WC Pay payment succeeds, auto-mark customerPayment as paid + credit balance. Currently no sync. |
| **4** | **Public developer API (convex/http.ts)** | P1 — DEMO | Public REST API for companies to create payments programmatically. In PR #6 but conflicted. |
| **5** | **API key management** | P1 — DEMO | apiKeys table + functions + developer page. In PR #6 but conflicted. |
| **6** | **CCTP bridge + AdvanceEscrow hooks** | P2 — PRIZE | On-chain settlement for Arc prize. In PR #8 but needs rebase. |
| **7** | **Payment status polling hook** | P2 — UX | Client-side hook for live checkout status. In PR #6. |
| **8** | **QR code generation** | P2 — UX | QR codes for checkout links. In PR #6. |
| **9** | **Sidebar cleanup** | P3 — POLISH | Rename/reorganize nav items. In PR #7. |

---

## Priority Order

### P0 — Must-have for demo and prizes

### Task 1: Landing Page

**Files:**
- Modify: `revamp/app/page.tsx`
- Modify: `revamp/app/globals.css`

The current landing page is a bare centered h1 + login button. Replace with a full product landing page showing: hero tagline, B2B/B2C product lanes, privacy state badges, console preview with mock metrics, settlement flow steps, and sponsor stack.

- [ ] **Step 1: Install lucide-react for icons**

```bash
npm install lucide-react
```

- [ ] **Step 2: Add brand CSS tokens to globals.css**

Add inside the `:root` block:

```css
--tone-paper: oklch(0.97 0.012 95);
--tone-linen: oklch(0.94 0.014 95);
--tone-carbon: oklch(0.26 0.01 85);
--tone-ink: oklch(0.18 0.01 85);
--tone-green: oklch(0.58 0.07 165);
--tone-copper: oklch(0.67 0.09 55);
--tone-border: oklch(0.88 0.005 90);
--tone-muted: oklch(0.55 0.01 90);
```

- [ ] **Step 3: Replace app/page.tsx with full landing page**

Build sections: nav bar (AC monogram + wordmark + login), hero ("Quiet infrastructure for real-time money movement"), product lanes (B2B payroll/invoicing + B2C usage billing), privacy badges, console preview (mock dashboard with metrics/outbound/inbound desks), settlement flow (3 steps), sponsor stack, footer CTA.

Use brand tokens for warm paper background, ink text, verdigris green accents. Content adapted from `arc-counting` repo's landing page data (see AGENTS.md brand system).

- [ ] **Step 4: Verify and commit**

```bash
npm run dev  # check http://localhost:3000
git add app/page.tsx app/globals.css package.json package-lock.json
git commit -m "feat: full product landing page with brand tokens"
```

---

### Task 2: Multi-Network AppKit Config

**Files:**
- Modify: `revamp/config/index.ts`

Currently only Arc Testnet is configured. Add Arbitrum Sepolia and Base Sepolia so WC Pay can work for real on a supported chain.

- [ ] **Step 1: Read current config/index.ts**

The file defines `arcTestnet` with `defineChain()` and exports `networks: [arcTestnet]`.

- [ ] **Step 2: Add Arbitrum Sepolia and Base Sepolia**

Import and add the chains. The Reown AppKit `defineChain` or Wagmi's built-in chain definitions can be used.

```typescript
import { arbitrumSepolia, baseSepolia } from "viem/chains";

// ... after arcTestnet definition ...

export const networks = [arcTestnet, arbitrumSepolia, baseSepolia] as const;
```

If `viem/chains` doesn't export testnet chains with the right format for AppKit, use `defineChain()` with the correct chain IDs (421614 for Arbitrum Sepolia, 84532 for Base Sepolia).

- [ ] **Step 3: Verify wallet can switch networks**

```bash
npm run dev
```

Open the app, connect wallet, check that network switcher shows Arc Testnet, Arbitrum Sepolia, and Base Sepolia.

- [ ] **Step 4: Commit**

```bash
git add config/index.ts
git commit -m "feat: add Arbitrum Sepolia and Base Sepolia to AppKit networks"
```

---

### P1 — Important for complete flow

### Task 3: WC Pay Payment Sync Action

**Files:**
- Create: `revamp/convex/wcpaySync.ts`
- Modify: `revamp/convex/crons.ts`

When a customer pays via WC Pay checkout, the customerPayment in Convex doesn't auto-update. This creates a sync action that polls WC Pay for completed payments and marks them paid in Convex.

Note: The existing checkout flow (`convex/checkout.ts`) has `confirmPayment` mutation that can be called when WC Pay confirms. But there's no automatic polling — the webhook route at `/api/pay/webhook` exists but may not be receiving callbacks. This sync action is the fallback.

- [ ] **Step 1: Create convex/wcpaySync.ts**

A Convex action that:
1. Queries all customerPayments with status "pending" that have a `wcPaymentId`
2. For each, calls WC Pay `GET /v1/merchants/payment/{id}/status`
3. If succeeded → call `updateStatus("paid")` which credits balance
4. If failed/expired → mark accordingly

```typescript
import { action, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

const WC_PAY_API_URL = process.env.WC_PAY_API_URL ?? "https://api.pay.walletconnect.com";
const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY ?? "";
const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID ?? "";
const IS_MOCK = process.env.WC_PAY_MOCK === "true";

export const getPendingWcPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all pending customerPayments that have a wcPaymentId
    const pending = await ctx.db
      .query("customerPayments")
      .take(200);
    return pending.filter(
      (p) => p.status === "pending" && p.wcPaymentId
    );
  },
});

export const syncPaymentStatuses = action({
  args: {},
  handler: async (ctx) => {
    if (IS_MOCK) return { synced: 0, message: "Mock mode — skipping sync" };

    const pending = await ctx.runQuery(internal.wcpaySync.getPendingWcPayments, {});
    let synced = 0;

    for (const payment of pending) {
      if (!payment.wcPaymentId) continue;

      try {
        const res = await fetch(
          `${WC_PAY_API_URL}/v1/merchants/payment/${payment.wcPaymentId}/status`,
          {
            headers: {
              "Api-Key": WC_PAY_API_KEY,
              "Merchant-Id": WC_PAY_MERCHANT_ID,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) continue;

        const data = await res.json() as { status: string; isFinal: boolean };

        if (data.status === "succeeded") {
          await ctx.runMutation(api.customerPayments.updateStatus, {
            id: payment._id,
            status: "paid",
            paidAt: Date.now(),
          });
          synced++;
        } else if (data.isFinal && (data.status === "failed" || data.status === "expired")) {
          await ctx.runMutation(api.customerPayments.updateStatus, {
            id: payment._id,
            status: "cancelled",
          });
        }
      } catch {
        // Skip failures, retry next cycle
      }
    }

    return { synced };
  },
});
```

- [ ] **Step 2: Add sync to crons.ts**

Read existing `convex/crons.ts`. Add a new cron interval after the existing advance threshold check:

```typescript
crons.interval(
  "sync wcpay payment statuses",
  { minutes: 2 },
  internal.wcpaySync.syncPaymentStatuses,
  {}
);
```

- [ ] **Step 3: Set WC Pay env vars on Convex**

```bash
npx convex env set WC_PAY_API_URL "https://api.pay.walletconnect.com"
npx convex env set WC_PAY_API_KEY "your-api-key"
npx convex env set WC_PAY_MERCHANT_ID "4d6f0d16ee5b0a714096bac81465e3e4"
npx convex env set WC_PAY_MOCK "true"
```

- [ ] **Step 4: Deploy and commit**

```bash
npx convex dev --once
git add convex/wcpaySync.ts convex/crons.ts
git commit -m "feat: add WC Pay payment sync cron (polls pending payments every 2 min)"
```

---

### Task 4: Public Developer API + API Keys

**Files:**
- Modify: `revamp/convex/schema.ts` (add apiKeys table)
- Create: `revamp/convex/apiKeys.ts`
- Create: `revamp/convex/http.ts`
- Create: `revamp/app/dashboard/developer/page.tsx`
- Modify: `revamp/components/app-sidebar.tsx` (add Developer nav item)

This is the same as PR #6's content but rebased cleanly onto current main. The public API lets companies create payments, list transactions, and check balances programmatically via `X-Api-Key` auth at `<convex-site>/api/v1/*`.

- [ ] **Step 1: Add apiKeys table to schema**

After the `checkoutLinks` table in `convex/schema.ts`, add:

```typescript
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
```

- [ ] **Step 2: Create convex/apiKeys.ts**

Functions: `listByCompany`, `create`, `revoke`, `validateKeyHash` (internal), `touchLastUsed` (internal).

- [ ] **Step 3: Create convex/http.ts**

Convex HTTP router with endpoints:
- `POST /api/v1/payments` — create customer payment
- `GET /api/v1/payments` — list payments
- `GET /api/v1/balance` — get balance

All authenticated via `X-Api-Key` header → SHA-256 hash → Convex lookup.

- [ ] **Step 4: Create developer dashboard page**

`app/dashboard/developer/page.tsx` with two tabs: API Keys (generate, revoke) and Documentation (endpoint docs, curl examples).

- [ ] **Step 5: Add Developer to sidebar**

Add nav item between Products and Treasury.

- [ ] **Step 6: Deploy and commit**

```bash
npx convex dev --once
git add convex/schema.ts convex/apiKeys.ts convex/http.ts app/dashboard/developer/page.tsx components/app-sidebar.tsx
git commit -m "feat: public API, API key management, developer docs page"
```

---

### Task 5: Payment Status Hook + QR Codes

**Files:**
- Create: `revamp/hooks/use-payment-status.ts`
- Create: `revamp/lib/qr.ts`

These are small utilities needed by the checkout flow for live status polling and QR code display.

- [ ] **Step 1: Install qrcode**

```bash
npm install qrcode @types/qrcode
```

- [ ] **Step 2: Create hooks/use-payment-status.ts**

Polls `/api/pay/status` with the payment's WC Pay ID. Respects `pollInMs` from response. Stops when `isFinal`.

- [ ] **Step 3: Create lib/qr.ts**

```typescript
import QRCode from "qrcode";
export async function generateQrDataUrl(url: string, width = 256): Promise<string> {
  return QRCode.toDataURL(url, { width, margin: 2, color: { dark: "#2b2924", light: "#f5f1e8" } });
}
```

- [ ] **Step 4: Commit**

```bash
git add hooks/use-payment-status.ts lib/qr.ts package.json package-lock.json
git commit -m "feat: payment status polling hook and QR code helper"
```

---

### P2 — Prize-targeting features

### Task 6: CCTP Bridge + AdvanceEscrow Hooks

**Files:**
- Create: `revamp/lib/cctp.ts`
- Create: `revamp/lib/contracts.ts`
- Create: `revamp/hooks/use-cctp-bridge.ts`
- Create: `revamp/hooks/use-advance-escrow.ts`
- Modify: `revamp/app/dashboard/treasury/page.tsx`

Cherry-pick the clean content from PR #8. Adds CCTP V2 bridge (Arc → Arbitrum/Base) and AdvanceEscrow Wagmi hooks to the treasury page.

- [ ] **Step 1: Create lib/cctp.ts** — CCTP V2 addresses, domain IDs, attestation poller
- [ ] **Step 2: Create lib/contracts.ts** — AdvanceEscrow ABI + USDC conversion helpers
- [ ] **Step 3: Create hooks/use-cctp-bridge.ts** — approve → burn → attest flow
- [ ] **Step 4: Create hooks/use-advance-escrow.ts** — createAdvance, releaseAdvance
- [ ] **Step 5: Add CCTP bridge card to treasury page**
- [ ] **Step 6: Commit**

```bash
git add lib/cctp.ts lib/contracts.ts hooks/use-cctp-bridge.ts hooks/use-advance-escrow.ts app/dashboard/treasury/page.tsx
git commit -m "feat: CCTP bridge + AdvanceEscrow hooks + treasury wiring"
```

---

### P3 — Polish

### Task 7: Sidebar Cleanup

**Files:**
- Modify: `revamp/components/app-sidebar.tsx`

Rename: Employee Payments → Payroll, Customer Payments → Receivables, Products & SDK → Products. Remove non-functional Search/Support. Add Developer link.

- [ ] **Step 1: Update navItems array**
- [ ] **Step 2: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "refactor: reorganize sidebar navigation"
```

---

## Summary

| Priority | Task | What | Impact |
|----------|------|------|--------|
| **P0** | 1. Landing page | Full product landing with brand tokens | Judges see this first |
| **P0** | 2. Multi-network | Add Arbitrum/Base to AppKit | Required for real WC Pay |
| **P1** | 3. WC Pay sync | Auto-mark payments paid when WC Pay confirms | Closes the payment loop |
| **P1** | 4. Public API + keys | REST API + developer page | SDK story for demo |
| **P1** | 5. Status hook + QR | Live checkout polling + QR codes | Checkout UX |
| **P2** | 6. CCTP + escrow | Bridge + on-chain advance hooks | Arc/Chainlink prizes |
| **P3** | 7. Sidebar cleanup | Nav reorganization | Polish |

### What about the open PRs?

PRs #6, #7, #8 are all stale — main has diverged significantly (teammate added checkout, products redesign, schema changes). Rather than trying to rebase them, implement the remaining tasks fresh on a new branch from current main. The PRs can be closed.

### What's fully complete (no work needed)

- Salary advance system (schema, requests, settings, cron, employee portal, payroll dashboard)
- Core web2 backend (companies, employees, customers, products, payments, balances)
- Checkout page + checkout links + WC Pay API routes
- Employee management + compensation lines
- Onboarding wizard + business profiles
- On-chain payroll contract balance reading
- All existing tests
