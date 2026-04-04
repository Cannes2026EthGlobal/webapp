# Arc Counting

Arc Counting is a private finance and payments platform for modern internet businesses. It combines payroll, invoicing, treasury visibility, and real-time usage-based payments in one system, using Arc as the settlement rail.

## What Problem It Solves

Businesses still manage payroll, invoices, and product billing across fragmented tools that are slow, manual, and not privacy-aware. Arc Counting replaces that stack with a single operator workspace where outbound and inbound money movement can be managed in real time.

## What The Product Does

Arc Counting has two connected layers:

- `B2B operations`: businesses manage employees, customers, payroll runs, invoices, receivables, treasury, and settlement history.
- `B2C payments`: AI apps, APIs, and autonomous agents can charge customers instantly on a pay-per-use basis instead of relying on subscriptions or prepaid credits.

In practice, the platform supports:

- private payroll and employee payouts
- B2B invoicing and receivables tracking
- real-time usage billing for AI and API products
- one-time payments and reusable checkout links
- treasury monitoring across inbound and outbound settlement flows

## Core Workflows

### Employee Payments

The product handles outbound payments for:

- monthly payroll
- freelance or per-service payouts
- bonuses
- reimbursements

For salaried workers, Arc Counting should also support paycheck advances. Employees can borrow against their next monthly paycheck, with the advance tracked and settled through a dedicated smart contract.

### Customer Payments

The product handles inbound payments through four main modes:

- `Usage`: pay per request, token, second, or tiered volume
- `Invoices`: business billing and receivables management
- `One-time`: fixed-price payments such as tickets or product access
- `Checkout Links`: reusable WalletConnect Pay payment surfaces

### Products And Billing

Each product can define:

- billing unit
- pricing logic
- settlement asset
- privacy mode
- refund behavior
- webhook events

This makes Arc Counting suitable for software businesses that want native pay-as-you-go billing instead of subscription-only pricing.

## Product Experience

Arc Counting should feel like a private finance operations room, not a crypto exchange.

The UX should be:

- light-first
- calm and precise
- operator-focused
- privacy-visible without being flashy

Privacy states such as `Pseudonymous`, `Verified`, `Shielded`, and `Multi-wallet` should be visible throughout the product. Operators should be able to work from aliases and wallet profiles by default, and only reveal sensitive identity data when needed.

## Main Product Areas

- `Overview`: treasury available, payroll due, pending receivables, usage revenue, settlement health, privacy or compliance alerts
- `Employees`: employee records, identity vaults, wallet profiles, compensation setup
- `Customers`: billing profiles, wallet readiness, active products, usage and payment history
- `Employee Payments`: payroll runs and outbound settlement operations
- `Customer Payments`: revenue, usage billing, invoices, and checkout flows
- `Products & SDK`: pricing rules, integration keys, test flows, event logs, and implementation guidance
- `Treasury`: balances, obligations, collections, and broader settlement visibility

## Infrastructure And Integrations

Arc Counting is built around a small set of core rails and partners:

- `Arc`: blockchain and settlement infrastructure
- `Chainlink`: programmable privacy-first execution, automation, and price feeds
- `WalletConnect Pay`: customer-facing payment and checkout experience
- `Reown Auth`: operator authentication into business workspaces

## Stretch Direction

A future extension of the platform is to let small businesses tokenize invoices or inventory as Hedera HTS tokens, access instant liquidity through a Uniswap v4 pool, and use ENS names as business identity.

## Current Repository Scope

This repository is the early frontend foundation for Arc Counting. It is a Next.js application that will evolve into the operator workspace and payment product described above.

## Convex + Reown Integration

This branch adds:

- a dedicated Convex cloud project for the app data layer
- Reown Authentication SIWX on top of the existing WalletConnect/AppKit flow
- a server-side token exchange that converts the verified Reown session into a Convex-compatible JWT
- an authenticated Convex schema for operator and workspace records

### Local Setup

1. Set your Reown project ID in `.env.local`.
2. Initialize or relink Convex to a cloud deployment:

   ```bash
   npx convex dev --configure new --dev-deployment cloud
   ```

3. Generate the JWT signing keys used for Convex custom auth:

   ```bash
   npm run convex:auth:keys
   ```

4. Start Convex and the app:

   ```bash
   npm run convex:dev
   npm run dev
   ```

### How Auth Works

1. Reown AppKit connects the wallet and completes SIWX authentication.
2. Reown stores its auth token locally in the browser.
3. The app posts that Reown token to `/api/auth/convex-token`.
4. The server validates the session against Reown's `auth/v1/me` endpoint.
5. The server mints a short-lived ES256 JWT for Convex.
6. Convex accepts that JWT through `convex/auth.config.ts` and exposes the identity in queries and mutations.
