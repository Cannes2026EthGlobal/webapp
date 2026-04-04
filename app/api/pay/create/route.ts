import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/wcpay-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referenceId, amountCents, currency } = body as {
      referenceId: string;
      amountCents: number;
      currency: "USD" | "EUR";
    };

    if (!referenceId || !amountCents) {
      return NextResponse.json(
        { error: "Missing referenceId or amountCents" },
        { status: 400 }
      );
    }

    const result = await createPayment(referenceId, amountCents, currency ?? "USD");

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
