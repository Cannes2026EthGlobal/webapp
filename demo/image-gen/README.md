# AI Image Generation Demo

Real DALL-E 3 image generation with pay-as-you-go billing through Arc Counting and WalletConnect Pay.

## How it works

1. User enters a prompt → DALL-E 3 generates an image
2. Each generation is recorded as 1 usage unit on Arc Counting
3. Usage accumulates on a running tab
4. When ready, user clicks "Pay & settle" → generates a WalletConnect Pay link
5. User pays → treasury credited, customer registered in CRM

## Setup

```bash
cd demo/image-gen
npm install
```

Edit `.env` with your Arc Counting IDs:

```
OPENAI_API_KEY=sk-proj-...
ARC_API_BASE=http://localhost:3000
ARC_COMPANY_ID=your-company-id      # from Arc Counting dashboard
ARC_PRODUCT_ID=your-product-id      # a pay-as-you-go product
PORT=3001
```

## Run

Make sure Arc Counting is running at localhost:3000, then:

```bash
npm start
```

Open http://localhost:3001

## What happens under the hood

```
User types prompt
       │
       ▼
POST /api/generate
       │
       ├─→ OpenAI DALL-E 3 generates image
       │
       └─→ POST /api/usage/record (Arc Counting)
              Records 1 unit on the customer's tab
              Tab accumulates across generations
       │
       ▼
Image displayed with running cost

       ═══════════════════════════

User clicks "Pay & settle"
       │
       ▼
POST /api/bill
       │
       ├─→ POST /api/usage/bill (Arc Counting)
       │      Closes the tab, creates customerPayment
       │
       └─→ POST /api/pay/create (WC Pay)
              Creates payment session
              Returns checkout URL
       │
       ▼
User redirected to WalletConnect Pay
       │
       ▼
Payment confirmed → treasury credited → CRM updated
```
