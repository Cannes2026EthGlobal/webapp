import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/agent/keys
 * Generate a new agent API key for a customer.
 *
 * Body: { companyId, customerId, label, rateLimit? }
 * Returns: { apiKey }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, customerId, label, rateLimit } = body as {
      companyId: string;
      customerId: string;
      label: string;
      rateLimit?: number;
    };

    if (!companyId || !customerId || !label) {
      return NextResponse.json(
        { error: "Missing required fields: companyId, customerId, label" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.agentBilling.generateApiKey, {
      companyId: companyId as Id<"companies">,
      customerId: customerId as Id<"customers">,
      label,
      rateLimit,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
