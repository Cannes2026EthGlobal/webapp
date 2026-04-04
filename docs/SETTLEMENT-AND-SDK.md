# Settlement Configuration & SDK Reference

## Settlement Address & CCTP Bridge

Each company can configure a destination address and network for receiving USDC settlements. The Chainlink Runtime Execution (CRE) workflow reads these settings from Convex and instructs the Payroll contract to bridge USDC via Circle's CCTP (Cross-Chain Transfer Protocol).

### Company Settlement Fields

| Field | Type | Description |
|-------|------|-------------|
| `settlementAddress` | string | Destination wallet for USDC payouts |
| `settlementNetwork` | string | Target network name (e.g., `ethereum`, `arbitrum`, `base`, `polygon`, `avalanche`, `arc`) |
| `settlementChainId` | number | EVM chain ID (1=Ethereum, 42161=Arbitrum, 8453=Base, 137=Polygon, 43114=Avalanche, 5042002=Arc) |
| `cctpDomain` | number | Circle CCTP domain ID (0=Ethereum, 1=Avalanche, 2=Optimism, 3=Arbitrum, 6=Base, 7=Polygon) |

### How CCTP Bridging Works

1. Payment settles on Arc (native USDC via WalletConnect Pay)
2. CRE workflow triggers `onReport()` on the Payroll contract
3. Contract reads settlement config from Convex
4. If `settlementNetwork !== "arc"`, contract calls CCTP `depositForBurn()` with:
   - `amount`: the USDC amount
   - `destinationDomain`: the `cctpDomain` value
   - `mintRecipient`: the `settlementAddress` (bytes32-padded)
5. Circle attestation service relays the burn, and USDC is minted on the destination chain

### Supported Networks

| Network | Chain ID | CCTP Domain | USDC Contract |
|---------|----------|-------------|---------------|
| Ethereum | 1 | 0 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Avalanche | 43114 | 1 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| Arbitrum | 42161 | 3 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Base | 8453 | 6 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Polygon | 137 | 7 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Arc Testnet | 5042002 | — | Native USDC |

---

## Company Customization Fields

| Field | Type | Description |
|-------|------|-------------|
| `defaultCurrency` | `"USD"` or `"EUR"` | Default currency for new products and payments |
| `webhookUrl` | string | Global webhook URL — receives POST for all payment events (paid, failed, expired) |
| `brandColor` | string | Hex color (e.g., `#0066FF`) used on public checkout pages |
| `supportEmail` | string | Shown on checkout pages and invoices for customer support |

---

## Pay-as-you-go SDK (Usage Billing)

### Overview

The usage billing system lets developers accumulate charges on a running "tab" per customer per product. When ready, they close the tab and generate a WalletConnect Pay checkout link for the customer to settle.

### API Endpoints

#### `POST /api/usage/record`

Record billable usage. Instant — no WC Pay interaction.

```json
{
  "companyId": "j...",
  "productId": "k...",
  "customerIdentifier": "0xBuyerWallet",
  "units": 10,
  "description": "10 API calls"
}
```

Response:
```json
{
  "tabId": "n...",
  "totalUnits": 10,
  "totalCents": 50
}
```

- If an open tab exists for this customer+product, usage is appended
- If no open tab exists (or previous tab was billed), a new tab is created
- `customerIdentifier` can be a wallet address, email, or any stable ID
- Price is calculated as `units × product.unitPriceCents`

#### `POST /api/usage/bill`

Close a tab and generate a WC Pay checkout link.

```json
{
  "tabId": "n..."
}
```

Response:
```json
{
  "checkoutUrl": "https://pay.walletconnect.com/?pid=pay_...",
  "wcPayPaymentId": "pay_...",
  "paymentId": "j...",
  "amountCents": 175,
  "currency": "USD",
  "productName": "API Calls",
  "customerIdentifier": "0xBuyerWallet",
  "expiresAt": 1775338782
}
```

- Tab is closed (status: `billed`) — no more usage can be added
- A `customerPayment` record is created (mode: `usage`, status: `pending`)
- A WC Pay session is created with the total amount
- Send `checkoutUrl` to the customer to pay their bill

#### `GET /api/usage/tab?tabId=...`

Check tab status, total, and itemized entries.

Response:
```json
{
  "tab": {
    "status": "open",
    "totalUnits": 35,
    "totalCents": 175,
    "productName": "API Calls",
    "billingUnit": "request"
  },
  "entries": [
    { "units": 25, "amountCents": 125, "description": "batch 2" },
    { "units": 10, "amountCents": 50, "description": "batch 1" }
  ]
}
```

### Lifecycle

```
                  record()    record()    record()
                     │           │           │
                     ▼           ▼           ▼
  ┌─────────────────────────────────────────────┐
  │              OPEN TAB                       │
  │  totalUnits: 35   totalCents: $1.75         │
  └──────────────────────┬──────────────────────┘
                         │ bill()
                         ▼
  ┌─────────────────────────────────────────────┐
  │             BILLED TAB                      │
  │  checkoutUrl: https://pay.wc.com/?pid=...   │
  │  paymentId: j...                            │
  └──────────────────────┬──────────────────────┘
                         │ customer pays via WC Pay
                         ▼
  ┌─────────────────────────────────────────────┐
  │              PAID TAB                       │
  │  treasury credited, customer registered     │
  └─────────────────────────────────────────────┘
```

New usage after billing automatically starts a fresh tab for the next period.

### Per-unit Checkout Links

For fixed-price products (not usage-based), use checkout links:

1. Create a product in the dashboard
2. Click "+ Link" to generate a checkout URL
3. Share the URL: `/checkout/{slug}`
4. Customer selects quantity, enters details, pays via WC Pay
5. Payment confirmed, customer auto-registered in CRM

### Webhook

Configure `webhookUrl` on the company to receive payment events:

```
POST {webhookUrl}
{
  "event": "payment.confirmed",
  "paymentId": "j...",
  "amountCents": 175,
  "currency": "USD",
  "customerIdentifier": "0x...",
  "txHash": "0x...",
  "txExplorerUrl": "https://testnet.arcscan.app/tx/0x..."
}
```

### CRM Auto-Registration

Every wallet that transacts is automatically registered as a customer:
- Wallet address stored in `walletAddress`
- Full name, email, country, date of birth collected at checkout
- Existing customers are enriched with new details on repeat purchases
- All payment history linked to the customer record
