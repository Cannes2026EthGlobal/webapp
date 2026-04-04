# Arc Counting

Arc Counting is a SaaS accounting platform for private payment, payroll, invoicing, and real-time usage settlement using Chainlink on Arc. It is designed for businesses that need one system for outbound payroll, inbound receivables, and programmable pay-per-use payments.

## Core Problem

Businesses still handle payroll, invoices, and usage billing with slow, fragmented systems that are not private or real-time. Arc Counting brings those workflows into one product with privacy-aware identity handling, instant settlement, and operator-grade visibility.

## Product Layers

- `B2B`: private payroll and invoicing management on Arc for business operators.
- `B2C`: AI apps, APIs, and autonomous agents charge and settle pay-per-use payments instantly instead of relying on subscriptions or prepaid credits.
- WalletConnect Pay is the customer-facing payment surface for product purchases and checkout moments.

## Core Infrastructure And Sponsors

- `Arc`: primary blockchain and settlement rail.
- `Chainlink`: programmable payment routing, privacy-first transaction logic, automation through Chainlink Runtime Execution workflows, and valuation via price feeds.
- `WalletConnect`: customer payment UX and checkout surface through WalletConnect Pay.
- `Reown Auth`: operator entry into the workspace.
- Bonus flow: small businesses can tokenize invoices or inventory as Hedera HTS tokens, access instant liquidity from a Uniswap v4 pool, and use ENS names for business identity.

## Product Posture

- The product should feel like a private finance operations room, not a crypto exchange.
- The interface should be light-first, editorial, precise, calm, and discreet.
- Favor operational clarity, settlement confidence, and privacy signaling over flashy blockchain detail.
- Privacy must stay visible in the interface through states such as `Pseudonymous`, `Verified`, `Shielded`, and `Multi-wallet`.

## Account And Workspace Model

- One user account can access multiple businesses.
- Each business is its own accounting workspace with separate treasury, employees, customers, products, payment rules, and settlement history.
- Business switching must be immediate and always visible in the main shell.

## Dashboard Shell

- Left navigation: `Overview`, `Employees`, `Customers`, `Employee Payments`, `Customer Payments`, `Products & SDK`, `Treasury`, `Settings`.
- Top bar: business switcher, connected wallet, Arc network, command/search, privacy state, and one contextual primary action.
- The shell should feel operator-first: dense enough for serious work, but calm enough for payroll and treasury review.

## Overview

The overview page is the control desk for a single business. It should surface:

- treasury available
- payroll due
- pending receivables
- usage revenue today
- settlement health
- privacy or compliance alerts

Money movement should be split into outbound and inbound sections so operators can immediately see what needs action.

## Employees

Employees are private outbound payment counterparts.

Employee list view should show:

- display name or alias
- role
- employment type
- compensation model
- payout asset
- next payment date
- wallet status
- privacy level

Employee detail should be split into:

- `Identity Vault`: legal name, tax or jurisdiction data, internal notes, verification state, and access controls
- `Wallet Profile`: primary wallet, backup wallets, supported assets, preferred payout route, and wallet verification history

Sensitive identity data should stay concealed by default. Operators should be able to work from aliases first and reveal legal identity only when needed.

## Customers

Customers are inbound payment counterparts with workflows distinct from payroll.

Customer types include:

- company
- app
- autonomous agent
- event buyer

Customer list should show:

- display name
- customer type
- active products
- pricing model
- billing state
- wallet readiness
- recent usage or payment activity

Customer detail should include:

- `Identity / Billing Profile`
- `Wallet Profile`
- subscribed or enabled products
- invoice and settlement history
- usage timeline

## Employee Payments

This page is the outbound settlement desk for:

- salaries
- freelance or task-based payouts
- bonuses
- reimbursements

Payment runs should move through clear states:

- `Draft`
- `Approved`
- `Queued`
- `Settled`
- `Failed`

Employee compensation tracking must support three payout paths:

- monthly payroll
- per-service or freelance payouts
- paycheck advances against the next monthly paycheck, backed by a smart contract

For paycheck advances, the system should track the advance as part of the employee's next-paycheck obligation rather than as an off-platform note.

The experience should prioritize batch clarity, exceptions, approvals, and settlement confidence over raw blockchain details.

## Customer Payments

This page is the inbound revenue engine. It should support four primary modes:

- `Usage`: pay-per-token, per request, per second, tiered volume, commit plus overage
- `Invoices`: B2B billing and receivables management
- `One-time`: fixed-price products such as event tickets
- `Checkout Links`: reusable WalletConnect Pay payment surfaces

The interface should make it easy to understand which products are generating revenue now, which customers are active, and which settlements need intervention.

## Products & SDK

This page connects finance operators and builders.

Each product should define:

- billing unit
- pricing logic
- settlement asset
- privacy mode
- refund behavior
- webhook events

The SDK area should expose:

- API or integration keys
- usage metering examples
- test flows
- event logs
- implementation guidance for pay-as-you-go billing

For AI or API products, usage billing should feel native to the platform rather than bolted on.

## Treasury

Treasury is the business settlement layer. It should reflect available balances, payment obligations, inbound collections, and any liquidity or tokenized-invoice positions tied to the business.

## Interaction Principles

- Identity and wallets are separate first-class objects for both employees and customers.
- Privacy states should be visible everywhere, not buried in settings.
- Desktop should prefer split panes, drawers, timelines, and inline actions over modal-heavy flows.
- The system should feel unified: employees are outbound payment counterparts, customers are inbound payment counterparts, and the overview is the operator ledger between them.
- Keep blockchain mechanics legible but secondary; operators should understand money movement and state without needing exchange-style mental models.
