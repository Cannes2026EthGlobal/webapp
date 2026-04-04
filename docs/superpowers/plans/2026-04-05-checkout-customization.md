# Checkout Link Customization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let companies customize the visual appearance of their checkout pages (colors, text, celebration effects) and set a custom recipient address per checkout link that flows through to Chainlink CRE settlement.

**Architecture:** Two features: (1) visual customization stored as a JSON config on the `checkoutLinks` table, rendered on the public `/checkout/[slug]` page; (2) custom recipient address stored on `checkoutLinks`, used by the checkout flow when creating payments, and passed through `referenceId` or a dedicated field so the CRE workflow sends funds to the right address.

**Tech Stack:** Convex (schema extension), Next.js (checkout page + products page), CSS custom properties for theming, canvas-confetti for effects

---

## What exists today

- `convex/checkoutLinks.ts` — CRUD for checkout links (create, deactivate, getBySlug, listByCompany)
- `convex/schema.ts` — `checkoutLinks` table has: `companyId`, `productId`, `slug`, `productName`, `isActive`
- `app/checkout/[slug]/page.tsx` — public checkout page (product info, quantity, WC Pay redirect)
- `app/(wallet)/dashboard/products/page.tsx` — products table with "+ Link" button and checkout links table

## Schema changes needed

Add to `checkoutLinks` table:
- `recipientAddress: v.optional(v.string())` — custom wallet to receive funds (overrides company default)
- `customization: v.optional(v.object({...}))` — visual config for the checkout page

## Tasks

### Task 1: Schema + Backend

**Files:**
- Modify: `convex/schema.ts` — add fields to `checkoutLinks`
- Modify: `convex/checkoutLinks.ts` — accept new fields on create, add update mutation
- Modify: `convex/checkout.ts` — pass recipientAddress through to payment record

- [ ] **Step 1: Add fields to checkoutLinks schema**

In `convex/schema.ts`, add to the `checkoutLinks` table definition:

```typescript
    recipientAddress: v.optional(v.string()),
    customization: v.optional(v.object({
      primaryColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      heading: v.optional(v.string()),
      description: v.optional(v.string()),
      effect: v.optional(v.union(
        v.literal("none"),
        v.literal("confetti"),
        v.literal("fireworks"),
        v.literal("snow"),
        v.literal("bubbles"),
      )),
      logoUrl: v.optional(v.string()),
    })),
```

- [ ] **Step 2: Update checkoutLinks.ts create mutation**

Accept `recipientAddress` and `customization` as optional args in the `create` mutation.

- [ ] **Step 3: Add update mutation to checkoutLinks.ts**

```typescript
export const update = mutation({
  args: {
    id: v.id("checkoutLinks"),
    recipientAddress: v.optional(v.string()),
    customization: v.optional(v.object({
      primaryColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      heading: v.optional(v.string()),
      description: v.optional(v.string()),
      effect: v.optional(v.union(
        v.literal("none"),
        v.literal("confetti"),
        v.literal("fireworks"),
        v.literal("snow"),
        v.literal("bubbles"),
      )),
      logoUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});
```

- [ ] **Step 4: Pass recipientAddress through checkout flow**

In `convex/checkout.ts` `initiateCheckout`, when creating the `customerPayments` record, if the checkout link has a `recipientAddress`, store it on the payment (add `recipientAddress: v.optional(v.string())` to `customerPayments` schema). The CRE workflow or settlement logic reads this to know where to send funds.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/checkoutLinks.ts convex/checkout.ts
git commit -m "feat: add recipientAddress and customization fields to checkout links"
```

---

### Task 2: Checkout Link Customization UI (Products Page)

**Files:**
- Modify: `app/(wallet)/dashboard/products/page.tsx` — add customize dialog/drawer for each checkout link

- [ ] **Step 1: Add "Customize" button next to each checkout link**

In the checkout links table, add a "Customize" button next to Copy/Deactivate.

- [ ] **Step 2: Create customization dialog**

Dialog with fields:
- **Recipient address** — input for custom wallet address (0x...)
- **Heading** — custom heading text (default: product name)
- **Description** — custom description
- **Button text** — custom CTA text (default: "Pay now")
- **Primary color** — color picker or hex input
- **Background color** — color picker or hex input
- **Celebration effect** — select: None, Confetti, Fireworks, Snow, Bubbles
- **Logo URL** — optional image URL

All fields optional — defaults are used if not set.

- [ ] **Step 3: Save customization via checkoutLinks.update mutation**

- [ ] **Step 4: Commit**

```bash
git add app/(wallet)/dashboard/products/page.tsx
git commit -m "feat: add checkout link customization dialog (colors, text, effects, recipient)"
```

---

### Task 3: Render Customization on Checkout Page

**Files:**
- Modify: `app/checkout/[slug]/page.tsx` — apply visual customization from DB

- [ ] **Step 1: Install canvas-confetti**

```bash
npm install canvas-confetti @types/canvas-confetti
```

- [ ] **Step 2: Read customization from checkout link data**

The `getBySlug` query already returns the full checkout link document. Extract `customization` and `recipientAddress`.

- [ ] **Step 3: Apply visual customization**

- Set CSS custom properties from `primaryColor` and `backgroundColor`
- Replace heading/description/button text with custom values if provided
- Show logo if `logoUrl` is set

- [ ] **Step 4: Add celebration effects on successful payment**

After payment succeeds, trigger the selected effect:
- `confetti` — canvas-confetti burst
- `fireworks` — canvas-confetti fireworks mode
- `snow` — CSS animation with falling particles
- `bubbles` — CSS animation with rising circles

- [ ] **Step 5: Commit**

```bash
git add app/checkout/[slug]/page.tsx package.json package-lock.json
git commit -m "feat: render checkout link customization (colors, text, effects)"
```

---

### Task 4: Wire Recipient Address to CRE

**Files:**
- Modify: `convex/checkout.ts` — store recipientAddress on payment
- Note: CRE workflow in `arccounting-cre-prod` reads recipient from Convex

- [ ] **Step 1: Store recipientAddress on customerPayments**

When `initiateCheckout` creates a payment, if the checkout link has `recipientAddress`, store it on the `customerPayments` record. If not set, fall back to the company's default settlement address.

- [ ] **Step 2: Update CRE workflow awareness**

The CRE workflow (`arccounting-cre-prod/my-workflow/workflow.ts`) fetches payment requests from Convex. It already reads `recipientAddress` from the request. Ensure the field name matches between the webapp's `customerPayments` and the CRE's `requests` table.

Document: when a checkout link has a custom `recipientAddress`, the CRE workflow will send funds directly to that address instead of the company's default payroll contract.

- [ ] **Step 3: Commit**

```bash
git add convex/checkout.ts
git commit -m "feat: wire custom recipientAddress from checkout link to payment record"
```

---

## Summary

| Task | What |
|------|------|
| 1 | Schema: add `recipientAddress` + `customization` to checkoutLinks |
| 2 | Products page: customization dialog per checkout link |
| 3 | Checkout page: render custom colors, text, effects |
| 4 | Wire recipient address through to CRE settlement |

### Customization options

| Field | Default | What it does |
|-------|---------|-------------|
| `recipientAddress` | Company settlement address | Where funds go after payment |
| `primaryColor` | Theme default | Button color, accents |
| `backgroundColor` | White | Page background |
| `buttonText` | "Pay now" | CTA button label |
| `heading` | Product name | Main heading on checkout |
| `description` | Product description | Subheading text |
| `effect` | none | Celebration on successful payment |
| `logoUrl` | None | Company logo on checkout page |
