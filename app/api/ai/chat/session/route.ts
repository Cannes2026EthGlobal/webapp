import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/ai/chat/session?sessionId=xxx&companyId=yyy
 * Load a persisted chat session.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const companyId = req.nextUrl.searchParams.get("companyId");

  if (!sessionId || !companyId) {
    return NextResponse.json(
      { error: "Missing sessionId or companyId" },
      { status: 400 }
    );
  }

  try {
    const session = await convex.query(api.aiInsights.getChatSession, {
      sessionId: sessionId as Id<"aiChatSessions">,
    });

    if (!session || session.companyId !== (companyId as Id<"companies">)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
