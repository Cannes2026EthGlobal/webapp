# Arc Counting

Private payroll, invoicing, and pay-as-you-go billing on Arc.

Arc Counting is a SaaS accounting platform where businesses manage employees, customers, payroll, invoices, treasury, and real-time usage-based payments from a single operator workspace. Employees can request salary advances against their next paycheck, with configurable interest rates and automatic treasury protection.

## ETHGlobal Cannes 2026 Hackathon

**Target prizes:**
- Arc — Best Smart Contracts with Advanced Stablecoin Logic (programmable payroll/vesting in USDC)
- Arc — Best Agentic Economy with Nanopayments
- Chainlink — Best Workflow with CRE + Best Privacy Standard
- WalletConnect — Best Use of WalletConnect Pay

## Quick Start

```bash
# Install dependencies
npm install

# Start Convex backend (keep running in a terminal)
npx convex dev

# Start Next.js frontend
npm run dev
```

Open http://localhost:3000, connect your wallet, and click "Create demo workspace" to seed a basic workspace (employees, customers, products — no fake payments).

### Clean Up Data

To clear all data for a wallet and start fresh:

```bash
npx convex run cleanup:clearAllData '{"wallet": "YOUR_WALLET_ADDRESS"}'
```

To delete stale legacy documents after schema migration:

```bash
npx convex run cleanup:deleteStaleDocuments
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Reown AppKit (wallet connection)
NEXT_PUBLIC_PROJECT_ID=your-reown-project-id

# Convex deployment
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

# WalletConnect Pay — single merchant account (server-side only)
WC_PAY_API_URL=https://api.pay.walletconnect.com
WC_PAY_API_KEY=your-api-key-from-dashboard.walletconnect.com
WC_PAY_MERCHANT_ID=your-merchant-id-from-dashboard.walletconnect.com

# WC Pay Mock Mode
# Arc Testnet is NOT supported by WalletConnect Pay.
# Set to "true" when developing on Arc Testnet — all WC Pay API calls
# return mock responses (fake payment IDs, instant "succeeded" status).
# Set to "false" when connected to Arbitrum or Base for real WC Pay
# integration (required for WalletConnect Pay prize eligibility).
WC_PAY_MOCK=true

# On-chain contracts (Arc Testnet) — fill after deploying
NEXT_PUBLIC_PAYROLL_ADDRESS=0x_DEPLOY_AND_FILL_IN
NEXT_PUBLIC_ADVANCE_ESCROW_ADDRESS=0x_DEPLOY_AND_FILL_IN
```

**Important:** `WC_PAY_*` vars (without `NEXT_PUBLIC_` prefix) are server-side only and never exposed to the browser. The `WC_PAY_MOCK` flag controls whether `lib/wcpay-client.ts` makes real HTTP calls or returns simulated data.

### Convex Environment Variables

The WC Pay keys also need to be set on the Convex deployment for server-side actions:

```bash
npx convex env set WC_PAY_API_URL "https://api.pay.walletconnect.com"
npx convex env set WC_PAY_API_KEY "your-api-key"
npx convex env set WC_PAY_MERCHANT_ID "your-merchant-id"
npx convex env set WC_PAY_MOCK "true"
```

## User Flow

### Public Pages

**Landing Page** (`/`)
- Product overview: payroll & advances, invoicing & checkout
- Stats: USDC settlement, up to 100% salary advance, custom per-invoice parameters, any CCTP chain
- Live dashboard preview with mock data
- "How it works" steps and tech stack cards
- Login → connects wallet via Reown AppKit

**Checkout Page** (`/checkout/[slug]`)
- Public payment page for any product
- Customer enters: quantity, wallet address, name, email, country
- Pays via WalletConnect Pay → polls status → shows confirmation
- Customizable per checkout link: colors, heading, button text, celebration effect (confetti/fireworks/snow/bubbles)
- Custom recipient address per link (overrides company default)

### Operator Dashboard

After login, the operator sees a sidebar with these sections:

**Overview** (`/dashboard`)
- 8 KPI cards in two rows:
  - Treasury (with Deposit button), Payroll due, Receivables, Revenue today
  - Total collected, Total paid out, Overdue, Advance requests
- Recent activity feed (latest 12 inbound + outbound payments)

**Employees** (`/dashboard/employees`)
- Employee roster table: name, role, type, compensation, wallet status, privacy level
- Add employee dialog
- Click employee → detail page (`/dashboard/employees/[id]`):
  - Identity vault (legal name, tax ID — concealed by default, reveal on demand)
  - Wallet profile (primary + backup wallets, verification status)
  - Compensation lines (add/edit/toggle/remove salary arrangements with splits)
  - Payment history with blockchain explorer links

**Customers** (`/dashboard/customers`)
- Customer list: name, type (company/app/agent/buyer), pricing model, billing state
- Add customer, create manual payment
- Click customer → detail page (`/dashboard/customers/[id]`):
  - Billing profile (editable: name, contact, email, country)
  - Wallet profile with payment summary
  - Payment history by mode (invoice/checkout/usage)

**Treasury** (`/dashboard/treasury`)
- On-chain payroll contract balance (USDC on Arc)
- Deposit funds to payroll contract (records in Convex ledger)
- CCTP bridge card: bridge USDC from Arc to Arbitrum/Base
- Ledger entries table: all credits/debits with reasons and timestamps

**My Products** (`/dashboard/products`)
- Product catalog: name, billing unit, pricing model, unit price
- Create product (any decimal precision for price)
- Generate checkout links per product
- Checkout links table with full URL, copy, deactivate
- Customize button → checkout customization page (`/dashboard/products/[linkId]`):
  - Live preview on the right
  - Colors (primary, background, text), heading, button text, thank you message
  - Celebration effect selector
  - Custom recipient address for settlement

**Agents** (`/dashboard/agents`)
- API key management: generate, reveal (one-time), revoke
- Active sessions: session ID, customer, usage count
- Settlement records
- Recent agent billing activity

**Integration** (`/dashboard/integration`)
- Company ID and API base URL
- Code examples: checkout link integration, usage billing SDK
- Status polling and webhook documentation
- Recent checkout/usage payment activity feed

**Payroll** (`/dashboard/payroll`)
- Payment summary cards: draft, approved/queued, settled totals
- Payment runs with status transitions: draft → approved → queued → settled
- 3-month payroll forecast with per-employee breakdown
- Salary advance (credit) management:
  - Pending requests inbox (approve/deny)
  - Settings: interest rate, max % of paycheck, auto-disable threshold
  - Auto-disable when treasury drops below threshold

**Settings** (`/dashboard/settings`)
- Workspace details (name, slug, industry, website)
- Settlement config (address, network, chain ID, CCTP domain)
- Configuration (default currency, webhook URL, brand color, support email)
- Delete workspace (danger zone)

### Employee Portal

**Employee Portal** (`/employee-portal`)
- Separate route — employees connect their own wallet
- See: upcoming paycheck, salary amount, eligible advance
- Request salary advance with interest preview (amount, interest deduction, net payout)
- View advance history and status
- Auto-disabled warning when company treasury is low

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Shadcn/ui |
| Backend | Convex (real-time DB, serverless functions, cron jobs) |
| Wallet Auth | Reown AppKit + Wagmi 3 + Viem 2 |
| Payments | WalletConnect Pay Merchant API (with mock mode) |
| Smart Contracts | Solidity 0.8.26, Foundry (in `arc-counting` repo) |
| Chain | Arc Testnet (chainId 5042002, native USDC) |
| Testing | Vitest + convex-test |

## Architecture

Arc Counting is a **single WalletConnect Pay merchant**. All companies on the platform share one WC Pay merchant account. Company data segregation happens in Convex using `referenceId` routing (`arc::{companyId}::{invoiceId}`).

```
WalletConnect Pay → 1 merchant: "Arc Counting" → all payments aggregated
                                    ↓
                    Convex parses referenceId → routes to correct company
                                    ↓
                    Each company sees only their own data in their dashboard
```

### Salary Advance Flow

```
Employee Portal:
  Employee sees salary, next paycheck date, eligible advance amount
  Requests $5,000 advance (2% interest = $100 deducted upfront)
  Net payout: $4,900 → status: pending
       ↓
Company Payroll Dashboard:
  Operator sees pending request → approves
  System creates employeePayment (type: advance, amount: $4,900)
       ↓
On next payday:
  Gross salary: $10,000
  Advance deduction: -$5,000
  Net payout: $5,000
  Advance status: deducted

Auto-disable:
  Cron (hourly) checks: treasury < N months of payroll?
  If yes → advances auto-disabled, employees see warning
  If treasury replenished → re-enabled automatically
```

## Project Structure

```
app/
  page.tsx                          # Landing page
  employee-portal/page.tsx          # Employee salary view + advance requests
  dashboard/
    page.tsx                        # Overview (KPIs, settlement chart, recent activity)
    employees/page.tsx              # Employee management
    customers/page.tsx              # Customer management
    employee-payments/page.tsx      # Outbound settlement desk
    customer-payments/page.tsx      # Inbound revenue engine
    payroll/page.tsx                # Payroll forecast + advance management
    products/page.tsx               # Billable products catalog
    treasury/page.tsx               # Balance, obligations, ledger entries
    settings/page.tsx               # Workspace configuration

convex/
  schema.ts                         # 11 tables (companies, employees, customers, products,
                                    #   employeePayments, customerPayments, companyBalances,
                                    #   balanceEntries, advanceSettings, advanceRequests)
  companies.ts                      # Company CRUD
  employees.ts                      # Employee CRUD with identity vault
  customers.ts                      # Customer CRUD
  products.ts                       # Product catalog
  employeePayments.ts               # Outbound payments with state machine
  customerPayments.ts               # Inbound payments with state machine
  balances.ts                       # Treasury ledger (credit/debit/query)
  advanceSettings.ts                # Per-company advance config (interest, max %, auto-disable)
  advanceRequests.ts                # Advance lifecycle (request → approve → settle → deduct)
  payrollForecast.ts                # 3-month salary schedule with advance deductions
  overview.ts                       # Dashboard KPIs and settlement chart
  crons.ts                          # Hourly: auto-disable advances when treasury is low
  seed.ts                           # Demo data (7 employees, 6 customers, 5 products)

lib/
  wcpay-client.ts                   # WC Pay API client (mock mode for Arc Testnet)
  format.ts                         # Currency + date formatters
  utils.ts                          # Tailwind cn() utility

hooks/
  use-company.ts                    # Active company context (wallet → company lookup)
```

## Payment State Machines

### Employee Payments (Outbound)
```
draft → approved → queued → settled (debits treasury)
  ↓        ↓         ↓
failed ← failed ← failed → draft (retry)
```

### Customer Payments (Inbound)
```
draft → sent → pending → paid (credits treasury)
         ↓       ↓
       overdue  overdue → paid
         ↓
      cancelled ← (any non-terminal) → draft (reopen)
```

### Advance Requests
```
pending → approved → settled → deducted (terminal)
  ↓         ↑
denied    (creates employeePayment type=advance)
cancelled
```

## Testing

```bash
# Run all Convex tests
npx vitest run

# Run specific test file
npx vitest run convex/advanceRequests.test.ts

# Watch mode
npx vitest
```

Test files are colocated with Convex functions (`convex/*.test.ts`).

## Smart Contracts

Smart contracts live in the `arc-counting` repo under `arc/`:

- **Payroll.sol** — deposit USDC into contract, pay employees (owner-controlled)
- **AdvanceEscrow.sol** — on-chain advance escrow with interest calculation

```bash
cd ../arc-counting/arc
forge build
forge test -vv
```

Arc uses **native USDC** (no ERC20). 1 USDC = 1e18 wei, just like ETH on Ethereum.

## CCTP Bridge

For employees on Arbitrum/Base, USDC is bridged from Arc using Circle's CCTP V2:

1. `approve(TokenMessenger, amount)` on Arc
2. `depositForBurn(amount, destinationDomain, recipient)` on Arc — burns USDC
3. Poll `iris-api-sandbox.circle.com` until attestation is complete
4. `receiveMessage(message, attestation)` on destination chain — mints USDC

Arc Testnet domain: **26**, Arbitrum: **3**, Base: **6**.

## WalletConnect Pay Integration Model

Arc Counting registers as a **single WC Pay merchant**. Companies never interact with WC Pay directly.

- **Operator dashboard**: creates invoices → calls WC Pay API → generates QR code/payment link
- **Public API** (planned): companies authenticate with `X-Api-Key`, Arc Counting proxies to WC Pay
- **Cron sync**: periodically fetches all payments from WC Pay, parses `referenceId` to route to correct company, credits company balance

The `referenceId` format is `arc::{companyId}::{invoiceId}` — this is how a single WC Pay merchant account serves multiple companies.

## Network Support

| Network | WC Pay | AppKit | Use |
|---------|--------|--------|-----|
| Arc Testnet (5042002) | Mock only | Supported | Primary development chain |
| Arbitrum Sepolia | Real | Supported | WC Pay prize eligibility |
| Base Sepolia | Real | Supported | WC Pay prize eligibility |

Toggle `WC_PAY_MOCK=true/false` in `.env` to switch between mock and real mode. The frontend wallet connection (Reown AppKit) works on all networks regardless of mock mode.

## Key Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable base |
| `feat/walletconnect-pay-integration` | WC Pay integration plan + web2 backend |
| `feat/salary-advance` | Salary advance system + WC Pay mock + employee portal |
| `feat/onchain-settlement` | Smart contract hooks + CCTP bridge plan |
