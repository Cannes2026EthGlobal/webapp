import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/wcpay-client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, referenceId, buyer, transaction } = body as {
      paymentId?: string;
      referenceId?: string;
      buyer?: { accountCaip10?: string };
      transaction?: { hash?: string };
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

    // Extract buyer wallet from CAIP-10 format (e.g. "eip155:1:0xabc...")
    let buyerWallet: string | undefined;
    if (buyer?.accountCaip10) {
      const parts = buyer.accountCaip10.split(":");
      buyerWallet = parts[parts.length - 1];
    }

    // Confirm the payment — credits treasury and auto-registers customer
    await convex.mutation(api.checkout.confirmPayment, {
      paymentId: payment._id,
      buyerWallet,
      txHash: transaction?.hash,
    });

    return NextResponse.json({ received: true, confirmed: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook error" },
      { status: 500 }
    );
  }
}
