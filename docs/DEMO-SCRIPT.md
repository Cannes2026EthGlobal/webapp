# Arc Counting — Demo Script

**Duration:** 4-5 minutes
**Setup before demo:** Seed data with `seedData:seedFullDemo` + `seedInfluencers:seed`

---

## Before You Start

```bash
# Seed demo data (run once)
npx convex run seedData:seedFullDemo '{"wallet": "YOUR_WALLET"}'
npx convex run seedInfluencers:seed '{"wallet": "YOUR_WALLET"}'

# Clear tour so it auto-starts
# In browser console: localStorage.removeItem("arc-counting-tour-completed")
```

---

## Act 1: The Problem (30 seconds)

**[Landing Page — localhost:3000]**

> "Businesses today handle payroll, invoices, and billing across fragmented tools. None of them are crypto-native, none of them support salary advances, and none of them let you customize payment experiences per customer."

> "Arc Counting solves this. One dashboard for paying your team and getting paid by your customers — settled in USDC on Arc, with Chainlink CRE automating payments and WalletConnect Pay handling checkout."

**Scroll through:** Stats strip → Product lanes → Dashboard preview → How it works → Under the hood (Arc, Chainlink CRE, WalletConnect Pay)

---

## Act 2: Connect & Tour (60 seconds)

**[Click Login → Connect Wallet]**

The onboarding tour starts automatically. Use **→ arrow key** to advance.

**Step 0 — Hero:** "Welcome to Arc Counting" with fireworks
> "When a new user connects, they get a guided tour of the platform."

**Step 1 — Overview KPIs:**
> "8 real-time KPIs — treasury balance, payroll obligations, receivables, revenue, overdue invoices, and pending salary advance requests. All from Convex, updating in real-time."

**Step 2-3 — Employees & Payments:**
> "We manage employees with wallet addresses. Each has compensation lines, and payments go through a state machine: draft, approved, queued, settled."

**Step 4 — Customers:**
> "Customers are auto-registered when they pay through our checkout links. No manual CRM entry needed."

**Step 5-6 — Treasury & Ledger:**
> "Treasury shows the on-chain USDC balance. Every deposit, every salary payment, every customer payment is logged in the ledger automatically."

**Step 7 — Products:**
> "This is where it gets interesting..."

**Press Escape to exit tour here — we'll demo products manually.**

---

## Act 3: Checkout Links & Customization (90 seconds)

**[Navigate to My Products]**

> "Companies create products and generate checkout links. But here's what makes us different from standard WalletConnect Pay..."

**Click "Customize" on one of Luna's checkout links.**

> "Every checkout link is fully customizable — brand colors, heading, button text, celebration effects. And crucially: a custom recipient address and referral commission."

**Show the customization page:**
- Point out the color pickers and live preview
- Show the referral commission section: "@LunaCryptoQueen gets 15% of every sale"
- Show the custom recipient address

> "This is per-invoice customization that WalletConnect Pay doesn't support out of the box. We built this layer on top."

**Open the checkout link in a new tab** (click the URL)

> "This is what the customer sees — fully branded. Let's complete a payment."

**Fill in:** quantity 1, any wallet address, name, email, country → Click Pay

> "WalletConnect Pay handles the payment. On success..."

**Show the confetti/fireworks effect and thank you message.**

> "And in the background, a referral commission was automatically created for Luna. Let me show you."

**Go back to Employees → Roster & Payments tab → show the draft freelance payment for Luna's commission.**

---

## Act 4: Salary Advances (60 seconds)

**[Navigate to Employees → click an employee]**

> "Employees can request their salary in advance — up to 100% of their next paycheck, with interest charged upfront."

**Show the employee detail page:** compensation lines, payment history

**Go to Employees → Payroll & Advances tab**

> "The company configures the interest rate, maximum advance percentage, and an auto-disable threshold. If treasury drops below 2 months of payroll, advances are automatically disabled."

**Show:** settings card (interest rate, max %, auto-disable), 3-month forecast with advance deductions

> "This is powered by Chainlink CRE. A cron-triggered workflow fetches due salary requests via Confidential HTTP, then executes payments through the Payroll smart contract on Arc."

---

## Act 5: On-Chain Settlement (45 seconds)

**[Navigate to Treasury]**

> "Let me deposit USDC into the payroll contract."

**Click Deposit → enter amount → confirm in wallet**

> "The deposit is recorded on-chain AND in our Convex ledger simultaneously. Full audit trail."

**Show the ledger entry appearing in real-time.**

> "For cross-chain settlement, we support CCTP V2 bridging — any chain Circle supports."

---

## Act 6: Agent Economy (30 seconds)

**[Navigate to AI & Agents]**

> "For the agentic economy track: autonomous agents can open metered billing sessions via API keys. They pay per-use for compute, API calls, or data access."

**Show:** API key management, session table

> "AI Insights tab gives Claude-powered business intelligence. AI Chat is a conversational assistant with full platform access."

---

## Act 7: Developer Integration (30 seconds)

**[Navigate to Integration]**

> "For developers integrating payments: we provide checkout link SDK, usage billing API, webhook configuration, and status polling."

**Show the code examples and curl commands.**

---

## Closing (15 seconds)

> "Arc Counting — payroll, invoicing, salary advances, and checkout links. Settled on Arc, automated by Chainlink CRE, paid via WalletConnect Pay. All from one dashboard."

> "The code is open source. Thank you."

---

## Key Talking Points for Judges

**For Arc judges:**
- Payroll.sol on Arc with CRE integration (not a simple owner-controlled contract)
- Native USDC settlement
- AdvanceEscrow with on-chain interest calculation

**For Chainlink judges:**
- Full CRE workflow: cron → Confidential HTTP → on-chain payment via KeystoneForwarder
- Privacy: salary data never exposed on-chain (ConfidentialHTTPClient)
- Deployed and simulated on Arc Testnet

**For WalletConnect judges:**
- Per-invoice customization (colors, text, effects) — not supported by standard WC Pay
- Referral commissions per checkout link
- Custom recipient addresses
- Auto-CRM: buyer details captured and stored
- Mock mode for Arc Testnet, real mode for Arbitrum/Base

---

## Emergency Fallbacks

- **If wallet won't connect:** Clear cookies, try a different browser
- **If Convex is slow:** `npx convex dev` might need restart
- **If checkout fails:** Check `WC_PAY_MOCK=true` in env
- **If tour doesn't start:** `localStorage.removeItem("arc-counting-tour-completed")` in console
- **If treasury shows 0:** Deposit first, or the seeded data didn't run
