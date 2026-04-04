# Arc Counting — Feature Enhancement Plan

## Context

Arc Counting is a SaaS accounting platform for private payroll, invoicing, and real-time usage settlement on blockchain. This plan covers the next wave of features to transform it from a functional accounting tool into the accounting backbone for autonomous economies.

**Phases 1 and 2 are the immediate priority.**

---

## Phase 1: Complete the Core

Fill stubbed pages so every sidebar link works.

### 1A. Employee Payments Page
- Replace redirect at `app/(wallet)/dashboard/employee-payments/page.tsx` with a full outbound settlement desk
- Table with status filter tabs (draft/approved/queued/settled/failed), batch approve, inline status transitions
- Backend already complete in `convex/employeePayments.ts`

### 1B. Customer Payments Page
- Replace redirect at `app/(wallet)/dashboard/customer-payments/page.tsx` with inbound payments desk
- Mode filter (usage/invoice/one-time/checkout), WC Pay gateway links, inline actions
- Backend already complete in `convex/customerPayments.ts`

### 1C. Settings Page (make editable)
- Add edit forms to `app/(wallet)/dashboard/settings/page.tsx`
- Company details, settlement config, webhook URL, branding
- `convex/companies.ts` `update` mutation already supports all fields

### 1D. Member Management UI
- Add `companyMembers` queries/mutations (listByCompany, addMember, removeMember, updateRole)
- Members section in settings page — schema already has owner/admin/member roles

---

## Phase 2: Agentic Economy + Nanopayments

**Target:** Arc Track 2 (Agentic Economy with Nanopayments)

### 2A. Agent Billing System
New tables in `convex/schema.ts`:
- `agentApiKeys`: `{ companyId, customerId, apiKey, label, rateLimit, isActive, lastUsedAt }`
- `agentSessions`: `{ companyId, customerId, sessionId, startedAt, endedAt, totalUnits, totalCents, status }`

New backend `convex/agentBilling.ts`:
- `startSession` — agent presents API key, starts metered session (creates usage tab)
- `recordEvent` — increments usage within session (sub-cent granularity)
- `endSession` — closes session, triggers billing
- `settleSession` — auto-settlement for pre-authorized agent wallets

New API routes:
- `POST /api/agent/session` — start/record/end sessions
- `POST /api/agent/settle` — autonomous settlement

Frontend: "Agents" tab on Products & SDK page with active sessions, per-agent revenue, API key management.

### 2B. Nanopayment Precision
- Add optional `amountMicroCents` field (1 microCent = 0.0001 cents) to `customerPayments`, `usageEntries`, `usageTabs`
- Keep `amountCents` as rounded display value; settlement logic uses micro-cent precision
- Update `convex/usageTabs.ts` `recordUsage` for `microCentsPerUnit` from product config

### 2C. Agent-to-Agent Settlement
- `agentSettlements` table for direct agent-to-agent transfers
- Platform acts as clearing house with `initiate`, `confirm`, `dispute` mutations
- Strongest differentiator: Arc Counting as the accounting backbone for multi-agent economies

---

## Future Phases (Planned)

### Phase 3: Chainlink CRE Integration
- Programmable payment routing, privacy workflows, threshold triggers, CRE dashboard

### Phase 4: Developer Experience
- SDK playground, webhook delivery logs, API key management

### Phase 5: Advanced Payment Flows
- Recurring billing/subscriptions, escrow, multi-party splits

### Phase 6: Analytics & Reporting
- Revenue dashboards, usage analytics, cash flow forecast

### Phase 7: Cross-Chain & CCTP
- Bridge UI in treasury, multi-chain balance view

### Phase 8: Polish & Demo
- Agent demo page, invoice PDF export, notifications
