import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/**
 * POST /api/agent/session
 * Unified endpoint for agent session lifecycle.
 *
 * Body: { action: "start" | "record" | "end", ...params }
 *
 * Actions:
 *   start  — { action: "start", productId, sessionId? }
 *   record — { action: "record", sessionId, units, description? }
 *   end    — { action: "end", sessionId }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header. Use 'Bearer <apiKey>'." },
        { status: 401 }
      );
    }

    // Validate the API key
    const keyRecord = await convex.query(api.agentBilling.validateApiKey, { apiKey });
    if (!keyRecord) {
      return NextResponse.json(
        { error: "Invalid or revoked API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action } = body as { action: string };

    if (!action) {
      return NextResponse.json(
        { error: "Missing 'action' field. Must be 'start', 'record', or 'end'." },
        { status: 400 }
      );
    }

    if (action === "start") {
      const { productId, sessionId } = body as {
        productId: string;
        sessionId?: string;
      };
      if (!productId) {
        return NextResponse.json(
          { error: "Missing required field: productId" },
          { status: 400 }
        );
      }

      const result = await convex.mutation(api.agentBilling.startSession, {
        apiKeyId: keyRecord._id,
        productId: productId as Id<"products">,
        sessionId,
      });

      return NextResponse.json(result);
    }

    if (action === "record") {
      const { sessionId, units, description } = body as {
        sessionId: string;
        units: number;
        description?: string;
      };
      if (!sessionId || units === undefined) {
        return NextResponse.json(
          { error: "Missing required fields: sessionId, units" },
          { status: 400 }
        );
      }

      const result = await convex.mutation(api.agentBilling.recordEvent, {
        sessionId,
        units,
        description,
      });

      return NextResponse.json(result);
    }

    if (action === "end") {
      const { sessionId } = body as { sessionId: string };
      if (!sessionId) {
        return NextResponse.json(
          { error: "Missing required field: sessionId" },
          { status: 400 }
        );
      }

      const result = await convex.mutation(api.agentBilling.endSession, {
        sessionId,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: `Unknown action '${action}'. Must be 'start', 'record', or 'end'.` },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
