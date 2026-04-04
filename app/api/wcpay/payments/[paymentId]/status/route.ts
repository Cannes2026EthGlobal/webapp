import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/wcpay-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;

  try {
    const result = await getPaymentStatus(paymentId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
