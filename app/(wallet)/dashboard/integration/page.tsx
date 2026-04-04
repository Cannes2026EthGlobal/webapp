"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCentsDetailed, formatDate } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function IntegrationContent() {
  const { companyId } = useCompany();
  const recentPayments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  );

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const sdkPayments = (recentPayments ?? [])
    .filter((p) => p.mode === "checkout" || p.mode === "usage")
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle>Your Configuration</CardTitle>
          <CardDescription>Use these values to integrate payments into your app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Company ID</p>
              <code className="text-sm font-mono break-all">{companyId ?? "..."}</code>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">API Base</p>
              <code className="text-sm font-mono break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/pay</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration methods */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit mb-2">Easiest</Badge>
            <CardTitle className="text-base">Checkout Link</CardTitle>
            <CardDescription>
              Share a URL. Customer picks quantity, pays via WalletConnect Pay. Payment + customer registration happen automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const checkoutUrl = "${typeof window !== "undefined" ? window.location.origin : ""}/checkout/{slug}";
window.open(checkoutUrl);`}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit mb-2">Flexible</Badge>
            <CardTitle className="text-base">Usage Billing</CardTitle>
            <CardDescription>
              Create payments with dynamic amounts from your backend. Buyer pays via WalletConnect Pay. Treasury credited on completion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const payment = await convex.mutation(
  "checkout:initiateUsagePayment",
  {
    companyId: "${companyId ?? "..."}",
    productId: "<product-id>",
    amountCents: 500,
    currency: "USD",
    description: "50 API calls",
    buyerWallet: "0x...",
  }
);`}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status & Webhook */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Check Status</CardTitle>
            <CardDescription>Poll payment status from your frontend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const res = await fetch(
  "/api/pay/status?paymentId=<id>"
);
const { status, isFinal } = await res.json();
// "requires_action" | "processing"
// "succeeded" | "failed"`}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook</CardTitle>
            <CardDescription>Server-to-server confirmation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/pay/webhook

// Body: { paymentId, referenceId }
// Auto-confirms payment
// Credits your treasury`}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Configure WalletConnect Pay to send webhooks to this URL.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Checkout links</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a link for any product. Share with customers. They pay via WalletConnect Pay.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Pay-as-you-go</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your app creates payments with dynamic amounts. Buyer pays, treasury credited.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Auto-CRM</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Any wallet that pays is auto-registered as a customer. Enrich profiles later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Recent checkout and usage payments</CardDescription>
        </CardHeader>
        <CardContent>
          {sdkPayments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payments yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mode</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdkPayments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{p.mode}</Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {p.description ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCentsDetailed(p.amountCents)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={p.status === "paid" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.paidAt ?? p._creationTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntegrationPage() {
  return (
    <>
      <PageHeader
        title="Integration"
        description="SDK, checkout links, webhooks, and payment activity"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <IntegrationContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
