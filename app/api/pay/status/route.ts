import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus, getPaymentDetails } from "@/lib/wcpay-client";

export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("paymentId");

  if (!paymentId) {
    return NextResponse.json(
      { error: "Missing paymentId query parameter" },
      { status: 400 }
    );
  }

  try {
    const status = await getPaymentStatus(paymentId);

    // When payment succeeds, fetch full details to get buyer info
    if (status.status === "succeeded") {
      const details = await getPaymentDetails(paymentId);
      const buyer = details?.buyer;
      let buyerWallet: string | undefined;
      if (buyer?.accountCaip10) {
        const parts = buyer.accountCaip10.split(":");
        buyerWallet = parts[parts.length - 1];
      }

      return NextResponse.json({
        ...status,
        buyer: buyer ? {
          wallet: buyerWallet,
          fullName: (buyer as Record<string, unknown>).fullName ?? (buyer as Record<string, unknown>).name,
          dateOfBirth: (buyer as Record<string, unknown>).dateOfBirth,
          country: (buyer as Record<string, unknown>).country,
          email: (buyer as Record<string, unknown>).email,
          providerName: buyer.accountProviderName,
        } : undefined,
        txHash: details?.transaction?.hash,
      });
    }

    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
