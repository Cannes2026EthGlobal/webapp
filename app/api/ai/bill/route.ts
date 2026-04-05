import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createPayment, isMockMode } from "@/lib/wcpay-client";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * The owner wallet that receives AI usage payments.
 * All AI usage fees are settled to this address.
 */
const AI_PAYMENT_RECIPIENT = "0xa24B1D46B3e507CDc8e90aA76175125Ab5D42580";

/**
 * POST /api/ai/bill
 * Create a bill for unbilled AI usage and generate a WalletConnect Pay checkout link.
 *
 * Body: { companyId }
 * Returns: { billId, checkoutUrl, totalCostCents, totalRequests }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId } = body as { companyId: string };

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    // 1. Create a bill in Convex (aggregates unbilled usage)
    const bill = await convex.mutation(api.aiInsights.createBill, {
      companyId: companyId as Id<"companies">,
    });

    // 2. Generate a unique reference ID for this AI bill
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let referenceId = "arc-ai-";
    for (let i = 0; i < 12; i++) {
      referenceId += chars[Math.floor(Math.random() * chars.length)];
    }

    // 3. Create WalletConnect Pay session
    // The payment goes to the app owner's wallet (AI_PAYMENT_RECIPIENT)
    const wcPay = await createPayment(
      referenceId,
      bill.totalCostCents,
      "USD"
    );

    // 4. Attach checkout URL to the bill
    await convex.mutation(api.aiInsights.attachCheckout, {
      billId: bill.billId,
      checkoutUrl: wcPay.gatewayUrl,
      wcPayPaymentId: wcPay.paymentId,
    });

    return NextResponse.json({
      billId: bill.billId,
      checkoutUrl: wcPay.gatewayUrl,
      wcPayPaymentId: wcPay.paymentId,
      totalCostCents: bill.totalCostCents,
      totalRequests: bill.totalRequests,
      referenceId,
      recipient: AI_PAYMENT_RECIPIENT,
      isMock: isMockMode,
      expiresAt: wcPay.expiresAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
