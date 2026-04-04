import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ActionPayload = {
  _action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * POST /api/ai/execute
 * Execute a confirmed action that was proposed by the AI chat.
 * This is the human-in-the-loop execution endpoint.
 *
 * Body: { action: ActionPayload }
 */
export async function POST(req: NextRequest) {
  try {
    const { action } = (await req.json()) as { action: ActionPayload };

    if (!action?._action) {
      return NextResponse.json(
        { error: "Missing action payload" },
        { status: 400 }
      );
    }

    switch (action._action) {
      case "create_employee": {
        const id = await convex.mutation(api.employees.create, {
          companyId: action.companyId as Id<"companies">,
          displayName: action.displayName,
          role: action.role,
          employmentType: action.employmentType,
          walletAddress: action.walletAddress,
          walletVerified: false,
          privacyLevel: action.privacyLevel ?? "pseudonymous",
          email: action.email,
          status: "active",
        });
        return NextResponse.json({ success: true, id });
      }

      case "create_customer": {
        const id = await convex.mutation(api.customers.create, {
          companyId: action.companyId as Id<"companies">,
          displayName: action.displayName,
          customerType: action.customerType,
          pricingModel: action.pricingModel,
          billingState: action.billingState ?? "active",
          walletAddress: action.walletAddress,
          walletReady: !!action.walletAddress,
          email: action.email,
        });
        return NextResponse.json({ success: true, id });
      }

      case "create_product": {
        const id = await convex.mutation(api.products.create, {
          companyId: action.companyId as Id<"companies">,
          name: action.name,
          description: action.description,
          billingUnit: action.billingUnit,
          pricingModel: action.pricingModel,
          unitPriceCents: action.unitPriceCents,
          currency: action.currency ?? "USD",
          settlementAsset: action.settlementAsset ?? "USDC",
          privacyMode: action.privacyMode ?? "standard",
          refundPolicy: action.refundPolicy ?? "no-refund",
          isActive: true,
        });
        return NextResponse.json({ success: true, id });
      }

      case "create_employee_payment": {
        const id = await convex.mutation(api.employeePayments.create, {
          companyId: action.companyId as Id<"companies">,
          employeeId: action.employeeId as Id<"employees">,
          type: action.type,
          amountCents: action.amountCents,
          currency: action.currency ?? "USD",
          description: action.description,
        });
        return NextResponse.json({ success: true, id });
      }

      case "create_customer_payment": {
        const id = await convex.mutation(api.customerPayments.create, {
          companyId: action.companyId as Id<"companies">,
          customerId: action.customerId
            ? (action.customerId as Id<"customers">)
            : undefined,
          productId: action.productId
            ? (action.productId as Id<"products">)
            : undefined,
          mode: action.mode,
          amountCents: action.amountCents,
          currency: action.currency ?? "USD",
          description: action.description,
        });
        return NextResponse.json({ success: true, id });
      }

      case "update_payment_status": {
        if (action.paymentType === "employee") {
          await convex.mutation(api.employeePayments.updateStatus, {
            id: action.paymentId as Id<"employeePayments">,
            status: action.newStatus,
          });
        } else {
          await convex.mutation(api.customerPayments.updateStatus, {
            id: action.paymentId as Id<"customerPayments">,
            status: action.newStatus,
          });
        }
        return NextResponse.json({ success: true });
      }

      case "update_employee": {
        const { _action, _requiresConfirmation, id, ...fields } = action;
        await convex.mutation(api.employees.update, {
          id: id as Id<"employees">,
          ...fields,
        });
        return NextResponse.json({ success: true });
      }

      case "update_customer": {
        const { _action, _requiresConfirmation, id, ...fields } = action;
        await convex.mutation(api.customers.update, {
          id: id as Id<"customers">,
          ...fields,
        });
        return NextResponse.json({ success: true });
      }

      case "approve_advance": {
        await convex.mutation(api.advanceRequests.approve, {
          id: action.id as Id<"creditRequests">,
        });
        return NextResponse.json({ success: true });
      }

      case "deny_advance": {
        await convex.mutation(api.advanceRequests.deny, {
          id: action.id as Id<"creditRequests">,
          denyReason: action.denyReason,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action._action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execution failed" },
      { status: 500 }
    );
  }
}
