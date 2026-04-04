import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/usage/tab?tabId=...
 * Get current tab status, total, and entries.
 */
export async function GET(req: NextRequest) {
  const tabId = req.nextUrl.searchParams.get("tabId");

  if (!tabId) {
    return NextResponse.json({ error: "Missing tabId" }, { status: 400 });
  }

  try {
    const tab = await convex.query(api.usageTabs.getTab, {
      tabId: tabId as Id<"usageTabs">,
    });

    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const entries = await convex.query(api.usageTabs.getEntries, {
      tabId: tabId as Id<"usageTabs">,
    });

    return NextResponse.json({ tab, entries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
