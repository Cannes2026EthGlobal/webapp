# Arc Counting Demo

Demonstrates the two billing models: **Per Unit** (checkout links) and **Pay As You Go** (usage tabs).

## Prerequisites

1. Arc Counting app running at `http://localhost:3000`
2. A company and products created in the dashboard
3. Copy your `companyId` and `productId` from the Convex dashboard or the Products & SDK page

## Quick Start

### 1. Set your IDs

Edit `demo-config.js` with your company and product IDs:

```js
const CONFIG = {
  API_BASE: "http://localhost:3000",
  COMPANY_ID: "your-company-id",
  PER_UNIT_PRODUCT_ID: "your-per-unit-product-id",
  PAYG_PRODUCT_ID: "your-pay-as-you-go-product-id",
};
```

### 2. Run the demo

Open `index.html` in a browser, or:

```bash
cd demo
npx serve .
```

### 3. Per Unit Demo

Click "Buy Now" to be redirected to a checkout link where you can purchase a fixed number of units via WalletConnect Pay.

### 4. Pay As You Go Demo

1. Click "Use API" repeatedly to simulate API usage (each click records usage)
2. Watch the running tab accumulate
3. Click "Generate Invoice" to close the tab and get a WC Pay checkout link
4. Pay via the generated link
5. New usage after payment starts a fresh billing period

## API Reference

See [docs/SETTLEMENT-AND-SDK.md](../docs/SETTLEMENT-AND-SDK.md) for the full SDK documentation.
