# Arc Counting — Demo Script (3 min)

**Setup:** Seed data (`seedFullDemo` + `seedDualCurrencyTeam` + `seedInfluencers`) + clear tour before starting

---

## Intro (20s)

**[Landing Page]**

> "Arc Counting is a SaaS where businesses manage payroll, invoicing, and customer payments — settled in USDC and EURC. Pay a US dev in USDC, a Paris contractor in EURC — native dual-currency payroll. Employees can request salary advances against interest. Customers pay through customizable checkout links."

**Click Login → Connect Wallet**

---

## Tour + Dashboard (30s)

Tour auto-starts. **Arrow keys** to advance quickly.

> "The dashboard shows 8 real-time KPIs — treasury, payroll, receivables, revenue — all split by USDC and EURC. Powered by Convex subscriptions, no refresh needed."

Skip through: Employees, Customers, Treasury, Products, AI, Integration, Settings. **Press Escape** after Products.

---

## Dual-Currency Payroll (30s)

**[Employees → Roster tab]**

> "Here's Ryan, our US engineer — paid $12,000 in USDC monthly. And Camille, a Paris-based smart contract auditor — paid €9,500 in EURC. Same dashboard, two currencies, no friction."

**Point at:** payout amounts showing `$12,000/monthly` and `€9,500/monthly`

**[Switch to payment runs tab]**

> "Draft payments are split by currency — the summary cards show USDC and EURC totals side by side."

---

## Checkout Links (30s)

**[My Products → click Customize on an influencer link]**

> "Each checkout link has its own branding — colors, effects, and a referral commission. Luna gets 15% of every sale through her link. Products can be priced in USDC or EURC."

**Open the checkout URL in a new tab → pay**

> "On success — fireworks. In the background, Luna's referral commission is created with love from @LunaCryptoQueen."

---

## Treasury + CCTP (30s)

**[Treasury]**

> "Side-by-side USDC and EURC balances. Deposit either currency on-chain."

**Click Deposit on EURC card → show dialog**

> "And withdraw via CCTP to any supported chain — Arbitrum, Base, Polygon, Ethereum, Avalanche, Optimism. Cross-chain settlement, one click."

**Click Withdraw → show chain selector + currency**

**Show ledger entries updating in real-time.**

---

## Salary Advances (20s)

**[Employees → Payroll & Advances tab]**

> "Employees request up to 100% of their salary in advance. Interest is deducted upfront. If treasury drops too low, advances auto-disable."

**Show:** 3-month forecast, settings

---

## How Sponsors Are Used (30s)

> "**Arc** is our settlement rail. Payroll contract deployed on Arc, native USDC and EURC settlement."

> "**Chainlink CRE** automates payroll disbursement. A cron workflow fetches due salaries via **Confidential HTTP** — salary data never touches the chain — then executes payments through KeystoneForwarder."

> "**WalletConnect Pay** handles customer payments. We built per-link customization, referral commissions, and dual-currency checkout on top — functionality WC Pay doesn't offer natively."

We also use **Circle's CCTP V2** under the hood for cross-chain withdrawals — bridging USDC or EURC from Arc to any supported chain.

---

## Close (10s)

> "Arc Counting — dual-currency payroll, cross-chain treasury, influencer referrals, salary advances. One dashboard, three sponsor integrations. Thank you."

---

## Judge Q&A Cheat Sheet

| Question | Answer |
|----------|--------|
| How is Arc used? | Payroll.sol deployed on Arc, native USDC + EURC settlement, CRE writes reports to it |
| How is Chainlink used? | CRE workflow with ConfidentialHTTPClient for private salary data, KeystoneForwarder for on-chain execution |
| How is WalletConnect Pay used? | Checkout links with per-invoice customization (colors, effects, referral), dual-currency products, auto-CRM, mock/real mode |
| How is Circle CCTP used? | Treasury withdrawals bridge USDC/EURC from Arc to Arbitrum, Base, Polygon, Ethereum, Optimism, Avalanche |
| What's the EURC story? | US dev paid in USDC, Paris contractor in EURC — per-employee currency, not a global setting. Products, receivables, and treasury all dual-currency |
| What's novel? | Per-link customization + referral commissions on WC Pay, salary advances with auto-disable, dual-currency payroll, cross-chain withdrawal via CCTP |
| Is it deployed? | Payroll contract on Arc Testnet, CRE workflow simulated, WC Pay mock on Arc / real on Arbitrum |
