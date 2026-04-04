import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createPayment } from "@/lib/wcpay-client";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/usage/bill
 * Close an open tab and generate a WalletConnect Pay checkout link.
 *
 * Body: { tabId }
 * Returns: { checkoutUrl, paymentId, amountCents, currency, totalUnits }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tabId } = body as { tabId: string };

    if (!tabId) {
      return NextResponse.json({ error: "Missing tabId" }, { status: 400 });
    }

    // 1. Close the tab and create a payment record
    const billing = await convex.mutation(api.usageTabs.billTab, {
      tabId: tabId as Id<"usageTabs">,
    });

    // 2. Create WC Pay session
    const wcPay = await createPayment(
      billing.referenceId,
      billing.amountCents,
      billing.currency
    );

    // 3. Attach WC Pay IDs to the payment record
    await convex.mutation(api.checkout.attachWcPay, {
      paymentId: billing.paymentId,
      wcPayPaymentId: wcPay.paymentId,
      wcPayGatewayUrl: wcPay.gatewayUrl,
    });

    // 4. Store checkout URL on the tab
    const checkoutUrl = wcPay.gatewayUrl;
    await convex.mutation(api.usageTabs.attachCheckoutUrl, {
      tabId: tabId as Id<"usageTabs">,
      checkoutUrl,
    });

    return NextResponse.json({
      checkoutUrl,
      wcPayPaymentId: wcPay.paymentId,
      paymentId: billing.paymentId,
      amountCents: billing.amountCents,
      currency: billing.currency,
      productName: billing.productName,
      customerIdentifier: billing.customerIdentifier,
      expiresAt: wcPay.expiresAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
