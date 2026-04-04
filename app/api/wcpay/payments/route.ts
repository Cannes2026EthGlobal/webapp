import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/wcpay-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { referenceId, amountCents, currency } = body;

  if (!referenceId || !amountCents) {
    return NextResponse.json({ error: "Missing referenceId or amountCents" }, { status: 400 });
  }

  try {
    const result = await createPayment(referenceId, amountCents, currency ?? "USD");
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
