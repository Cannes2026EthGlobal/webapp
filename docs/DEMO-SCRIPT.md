# Arc Counting — Demo Script (3 min)

**Setup:** Seed data + clear tour before starting

---

## Intro (20s)

**[Landing Page]**

> "Arc Counting is a SaaS where businesses manage payroll, invoicing, and customer payments — all settled in USDC. Employees can request their salary in advance against interest. Customers pay through customizable checkout links."

**Click Login → Connect Wallet**

---

## Tour + Dashboard (30s)

Tour auto-starts. **Arrow keys** to advance quickly.

> "The dashboard shows treasury, payroll, receivables, revenue — 8 KPIs updated in real-time via Convex."

Skip through: Employees, Customers, Treasury, Products, AI, Integration, Settings. **Press Escape** after Products.

---

## Checkout Links (40s)

**[My Products → click Customize on an influencer link]**

> "Each checkout link has its own branding — colors, effects, and a referral commission. Luna gets 15% of every sale through her link, paid automatically."

**Open the checkout URL in a new tab → fill in details → pay**

> "The customer pays via WalletConnect Pay. On success — fireworks. In the background, Luna's referral commission is created as a draft payment."

---

## Salary Advances (30s)

**[Employees → Payroll & Advances tab]**

> "Employees can request up to 100% of their salary in advance. Interest is deducted upfront. If treasury drops too low, advances auto-disable."

**Show:** 3-month forecast, settings (interest rate, max %, threshold)

---

## Treasury (20s)

**[Treasury → Deposit]**

> "Deposit USDC — recorded on-chain and in the ledger simultaneously."

**Show ledger entry appearing in real-time.**

---

## How Sponsors Are Used (40s)

> "**Arc** is our settlement rail. The Payroll smart contract is deployed on Arc — it holds company funds and executes salary payments in native USDC."

> "**Chainlink CRE** automates payroll. A cron-triggered workflow fetches due salary requests from our backend via **Confidential HTTP** — salary data is never exposed on-chain. It then executes payments through the KeystoneForwarder on Arc."

> "**WalletConnect Pay** handles all customer-facing payments. We built per-invoice customization on top — custom colors, celebration effects, recipient addresses, and referral commissions. This is functionality that WC Pay doesn't offer natively."

---

## Close (10s)

> "Arc Counting — one dashboard, three sponsor integrations, real money movement. Thank you."

---

## Judge Q&A Cheat Sheet

| Question | Answer |
|----------|--------|
| How is Arc used? | Payroll.sol deployed on Arc, native USDC settlement, CRE writes reports to it |
| How is Chainlink used? | CRE workflow with ConfidentialHTTPClient for private salary data, KeystoneForwarder for on-chain execution |
| How is WalletConnect Pay used? | Checkout links with per-invoice customization (colors, effects, referral), auto-CRM, mock/real mode |
| What's novel? | Per-link customization + referral commissions on top of WC Pay, salary advances with on-chain interest, auto-disable on low treasury |
| Is it deployed? | Payroll contract on Arc Testnet, CRE workflow simulated, WC Pay mock on Arc / real on Arbitrum |
