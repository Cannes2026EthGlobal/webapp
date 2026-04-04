import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/wcpay-client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, referenceId } = body as {
      paymentId?: string;
      referenceId?: string;
    };

    if (!paymentId || !referenceId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify payment status with WC Pay
    const status = await getPaymentStatus(paymentId);

    if (status.status !== "succeeded") {
      return NextResponse.json({ received: true, status: status.status });
    }

    // Look up the payment by referenceId
    const payment = await convex.query(api.checkout.getByReferenceId, { referenceId });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Confirm the payment
    await convex.mutation(api.checkout.confirmPayment, {
      paymentId: payment._id,
    });

    return NextResponse.json({ received: true, confirmed: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook error" },
      { status: 500 }
    );
  }
}
