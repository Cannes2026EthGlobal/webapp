import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/usage/record
 * Record usage for a customer. Called by developer services.
 *
 * Body: { companyId, productId, customerIdentifier, units, description? }
 * Returns: { tabId, totalUnits, totalCents }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, productId, customerIdentifier, units, description } = body as {
      companyId: string;
      productId: string;
      customerIdentifier: string;
      units: number;
      description?: string;
    };

    if (!companyId || !productId || !customerIdentifier || !units) {
      return NextResponse.json(
        { error: "Missing required fields: companyId, productId, customerIdentifier, units" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.usageTabs.recordUsage, {
      companyId: companyId as Id<"companies">,
      productId: productId as Id<"products">,
      customerIdentifier,
      units,
      description,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
