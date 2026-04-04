import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/wcpay-client";

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
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
