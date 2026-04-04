"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { generateQrDataUrl } from "@/lib/qr";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { isMockMode } from "@/lib/wcpay-client";

function CustomerPaymentsContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
  const { companyId } = useCompany();
  const payments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const customers = useQuery(
    api.customers.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createPayment = useMutation(api.customerPayments.create);
  const updateStatus = useMutation(api.customerPayments.updateStatus);
  const removePayment = useMutation(api.customerPayments.remove);
  const [formData, setFormData] = useState({
    customerId: "",
    mode: "invoice" as const,
    amountCents: 0,
    description: "",
  });
  const [checkoutState, setCheckoutState] = useState<{
    paymentDbId: string;
    wcPaymentId: string;
    qrDataUrl: string;
    gatewayUrl: string;
  } | null>(null);
  const updatePayment = useMutation(api.customerPayments.update);

  if (!payments || !customers) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const customerMap = new Map(customers.map((c) => [c._id, c]));

  const handleCreate = async () => {
    if (!companyId || !formData.amountCents) return;
    await createPayment({
      companyId,
      customerId: formData.customerId
        ? (formData.customerId as Id<"customers">)
        : undefined,
      mode: formData.mode,
      amountCents: formData.amountCents,
      currency: "USD",
      description: formData.description || undefined,
    });
    setShowCreate(false);
    setFormData({
      customerId: "",
      mode: "invoice",
      amountCents: 0,
      description: "",
    });
  };

  const handleGenerateCheckout = async (paymentId: Id<"customerPayments">, amountCents: number) => {
    if (!companyId) return;
    const referenceId = `arc::${companyId}::${paymentId}`;

    try {
      const res = await fetch("/api/wcpay/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId, amountCents, currency: "USD" }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create checkout link");
        return;
      }

      const { paymentId: wcPaymentId, gatewayUrl } = await res.json();

      // Store the referenceId on the customer payment
      await updatePayment({ id: paymentId, referenceId });

      // Transition to sent
      await updateStatus({ id: paymentId, status: "sent" });

      const qrDataUrl = await generateQrDataUrl(gatewayUrl);
      setCheckoutState({ paymentDbId: paymentId, wcPaymentId, qrDataUrl, gatewayUrl });

      toast.success(isMockMode ? "Checkout link generated (mock mode)" : "Checkout link generated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate checkout");
    }
  };

  const modeGroups = {
    all: payments,
    usage: payments.filter((p) => p.mode === "usage"),
    invoice: payments.filter((p) => p.mode === "invoice"),
    "one-time": payments.filter((p) => p.mode === "one-time"),
    checkout: payments.filter((p) => p.mode === "checkout"),
  };

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amountCents, 0);
  const pendingTotal = payments
    .filter((p) => ["draft", "sent", "pending"].includes(p.status))
    .reduce((s, p) => s + p.amountCents, 0);
  const overdueTotal = payments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(paidTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === "paid").length} payment
              {payments.filter((p) => p.status === "paid").length !== 1
                ? "s"
                : ""}{" "}
              settled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(pendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Awaiting payment from customers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-destructive">
              {formatCents(overdueTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Past due date, needs intervention
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receivables</CardTitle>
          <CardDescription>
            Inbound revenue from usage, invoices, one-time payments, and checkout
            links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({modeGroups.all.length})</TabsTrigger>
              <TabsTrigger value="usage">
                Usage ({modeGroups.usage.length})
              </TabsTrigger>
              <TabsTrigger value="invoice">
                Invoices ({modeGroups.invoice.length})
              </TabsTrigger>
              <TabsTrigger value="one-time">
                One-time ({modeGroups["one-time"].length})
              </TabsTrigger>
              <TabsTrigger value="checkout">
                Checkout ({modeGroups.checkout.length})
              </TabsTrigger>
            </TabsList>

            {(
              ["all", "usage", "invoice", "one-time", "checkout"] as const
            ).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <CustomerPaymentsTable
                  payments={modeGroups[tab]}
                  customerMap={customerMap}
                  onTransition={async (id, status) => {
                    try {
                      await updateStatus({
                        id,
                        status,
                        ...(status === "paid" ? { paidAt: Date.now() } : {}),
                      });
                      toast.success(status === "paid" ? "Payment collected — treasury credited" : `Payment ${status}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to update status");
                    }
                  }}
                  onRemove={async (id) => {
                    try {
                      await removePayment({ id });
                      toast.success("Payment removed");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to remove");
                    }
                  }}
                  onGenerateCheckout={handleGenerateCheckout}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {checkoutState && (
        <CheckoutLinkCard
          checkoutState={checkoutState}
          onClose={() => setCheckoutState(null)}
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create receivable</DialogTitle>
            <DialogDescription>
              Add a new inbound payment or invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Customer (optional)</Label>
              <Select
                value={formData.customerId}
                onValueChange={(v) =>
                  setFormData({ ...formData, customerId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust._id} value={cust._id}>
                      {cust.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Payment mode</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      mode: v as typeof formData.mode,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usage">Usage</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="checkout">Checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amountCents / 100 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amountCents: Math.round(
                        parseFloat(e.target.value || "0") * 100
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>
              Create receivable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerPaymentsTable({
  payments,
  customerMap,
  onTransition,
  onRemove,
  onGenerateCheckout,
}: {
  payments: Array<{
    _id: Id<"customerPayments">;
    _creationTime: number;
    customerId?: Id<"customers">;
    mode: string;
    amountCents: number;
    status: string;
    description?: string;
    dueDate?: number;
    paidAt?: number;
  }>;
  customerMap: Map<string, { displayName: string }>;
  onTransition: (id: Id<"customerPayments">, status: "draft" | "sent" | "pending" | "paid" | "overdue" | "cancelled") => void;
  onRemove: (id: Id<"customerPayments">) => void;
  onGenerateCheckout: (id: Id<"customerPayments">, amountCents: number) => void;
}) {
  if (payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payments in this category
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p._id}>
              <TableCell className="font-medium">
                {p.customerId
                  ? (customerMap.get(p.customerId)?.displayName ?? "Unknown")
                  : "Anonymous"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {p.mode}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCents(p.amountCents)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={p.status} />
              </TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {p.description ?? "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.paidAt
                  ? formatDate(p.paidAt)
                  : p.dueDate
                    ? formatDate(p.dueDate)
                    : formatDate(p._creationTime)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {p.status === "draft" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "sent")}>
                        Send
                      </Button>
                      <Button variant="default" size="sm" onClick={() => onGenerateCheckout(p._id, p.amountCents)}>
                        Checkout link
                      </Button>
                    </>
                  )}
                  {p.status === "sent" && (
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "pending")}>
                      Mark pending
                    </Button>
                  )}
                  {(p.status === "pending" || p.status === "overdue") && (
                    <Button variant="default" size="sm" onClick={() => onTransition(p._id, "paid")}>
                      Mark paid
                    </Button>
                  )}
                  {p.status === "cancelled" && (
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "draft")}>
                      Reopen
                    </Button>
                  )}
                  {["draft", "sent", "pending"].includes(p.status) && (
                    <Button variant="ghost" size="sm" onClick={() => onTransition(p._id, "cancelled")}>
                      Cancel
                    </Button>
                  )}
                  {(p.status === "draft" || p.status === "cancelled") && (
                    <Button variant="ghost" size="sm" onClick={() => onRemove(p._id)}>
                      Remove
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CheckoutLinkCard({
  checkoutState,
  onClose,
}: {
  checkoutState: {
    paymentDbId: string;
    wcPaymentId: string;
    qrDataUrl: string;
    gatewayUrl: string;
  };
  onClose: () => void;
}) {
  const status = usePaymentStatus(checkoutState.wcPaymentId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Checkout Link</CardTitle>
            <CardDescription>
              Share this QR code or link with your customer
              {isMockMode && " (mock mode — payment auto-succeeds)"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <img src={checkoutState.qrDataUrl} alt="Payment QR" className="h-40 w-40 rounded" />
          <div className="flex flex-col gap-2 min-w-0">
            <div>
              <p className="text-xs text-muted-foreground">Payment ID</p>
              <p className="font-mono text-xs break-all">{checkoutState.wcPaymentId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gateway URL</p>
              <a
                href={checkoutState.gatewayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary underline break-all"
              >
                {checkoutState.gatewayUrl}
              </a>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              {status.status ? (
                <Badge variant={status.status === "succeeded" ? "default" : status.isFinal ? "destructive" : "secondary"} className="capitalize">
                  {status.status}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Polling...</span>
              )}
            </div>
            {status.isFinal && status.status === "succeeded" && (
              <p className="text-sm font-medium text-green-600">Payment confirmed</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-fit mt-1"
              onClick={() => navigator.clipboard.writeText(checkoutState.gatewayUrl)}
            >
              Copy link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const variant =
    status === "paid"
      ? "default"
      : status === "overdue" || status === "cancelled"
        ? "destructive"
        : status === "pending" || status === "sent"
          ? "secondary"
          : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default function CustomerPaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Customer Payments"
        description="Inbound revenue engine for usage, invoices, and checkout"
        action={{
          label: "New receivable",
          onClick: () => setShowCreate(true),
        }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <CustomerPaymentsContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
