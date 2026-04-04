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

type PaymentStatus = "draft" | "sent" | "pending" | "paid" | "overdue" | "cancelled";
type PaymentMode = "usage" | "invoice" | "one-time" | "checkout";

interface Payment {
  _id: Id<"customerPayments">;
  _creationTime: number;
  customerId?: Id<"customers">;
  mode: string;
  amountCents: number;
  status: string;
  description?: string;
  dueDate?: number;
  paidAt?: number;
  txHash?: string;
  txExplorerUrl?: string;
  wcPayGatewayUrl?: string;
}

const ALL_STATUSES: PaymentStatus[] = ["draft", "sent", "pending", "paid", "overdue", "cancelled"];

function CustomerPaymentsContent({
  showCreate,
  setShowCreate,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
}) {
  const { companyId } = useCompany();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const customers = useQuery(
    api.customers.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const payments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  ) as Payment[] | undefined;

  const createPayment = useMutation(api.customerPayments.create);
  const updatePaymentStatus = useMutation(api.customerPayments.updateStatus);
  const removePayment = useMutation(api.customerPayments.remove);

  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    mode: "invoice" as PaymentMode,
    amountCents: 0,
    description: "",
    dueDate: "",
  });

  if (!customers || !payments) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const customerMap = new Map(customers.map((c) => [c._id, c]));

  // ─── Summary calculations ───
  const collectedTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amountCents, 0);
  const pendingTotal = payments
    .filter((p) => ["draft", "sent", "pending"].includes(p.status))
    .reduce((s, p) => s + p.amountCents, 0);
  const overdueTotal = payments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + p.amountCents, 0);
  const totalReceivables = payments.filter((p) => p.status !== "cancelled").length;

  // ─── Filtered payments by status ───
  const statusFiltered =
    statusFilter === "all"
      ? payments
      : payments.filter((p) => p.status === statusFilter);

  // ─── Mode groups ───
  const modeGroups = {
    all: statusFiltered,
    usage: statusFiltered.filter((p) => p.mode === "usage"),
    invoice: statusFiltered.filter((p) => p.mode === "invoice"),
    "one-time": statusFiltered.filter((p) => p.mode === "one-time"),
    checkout: statusFiltered.filter((p) => p.mode === "checkout"),
  };

  const handleCreatePayment = async () => {
    if (!companyId || !paymentForm.amountCents) return;
    try {
      await createPayment({
        companyId,
        customerId: paymentForm.customerId
          ? (paymentForm.customerId as Id<"customers">)
          : undefined,
        mode: paymentForm.mode,
        amountCents: paymentForm.amountCents,
        currency: "USD",
        description: paymentForm.description || undefined,
        dueDate: paymentForm.dueDate
          ? new Date(paymentForm.dueDate).getTime()
          : undefined,
      });
      toast.success("Payment created");
      setShowCreate(false);
      setPaymentForm({
        customerId: "",
        mode: "invoice",
        amountCents: 0,
        description: "",
        dueDate: "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create payment");
    }
  };

  const handleTransition = async (id: Id<"customerPayments">, status: PaymentStatus) => {
    try {
      await updatePaymentStatus({
        id,
        status,
        ...(status === "paid" ? { paidAt: Date.now() } : {}),
      });
      toast.success(
        status === "paid"
          ? "Payment collected — treasury credited"
          : `Payment ${status}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleRemove = async (id: Id<"customerPayments">) => {
    try {
      await removePayment({ id });
      toast.success("Payment removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(collectedTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === "paid").length} payment
              {payments.filter((p) => p.status === "paid").length !== 1 ? "s" : ""}{" "}
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total receivables</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {totalReceivables}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All non-cancelled payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Payments Table ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Payments</CardTitle>
              <CardDescription>
                Inbound revenue from usage, invoices, one-time payments, and checkout links
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                New payment
              </Button>
            </div>
          </div>
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

            {(["all", "usage", "invoice", "one-time", "checkout"] as const).map(
              (tab) => (
                <TabsContent key={tab} value={tab}>
                  <PaymentsTable
                    payments={modeGroups[tab]}
                    customerMap={customerMap}
                    onTransition={handleTransition}
                    onRemove={handleRemove}
                  />
                </TabsContent>
              )
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── Create Payment Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create payment</DialogTitle>
            <DialogDescription>
              Add a new inbound payment or invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Customer (optional)</Label>
              <Select
                value={paymentForm.customerId}
                onValueChange={(v) =>
                  setPaymentForm({ ...paymentForm, customerId: v })
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
                  value={paymentForm.mode}
                  onValueChange={(v) =>
                    setPaymentForm({
                      ...paymentForm,
                      mode: v as PaymentMode,
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
                <Label htmlFor="paymentAmount">Amount (USD)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentForm.amountCents / 100 || ""}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amountCents: Math.round(
                        parseFloat(e.target.value || "0") * 100
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentDescription">Description (optional)</Label>
              <Input
                id="paymentDescription"
                value={paymentForm.description}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentDueDate">Due date (optional)</Label>
              <Input
                id="paymentDueDate"
                type="date"
                value={paymentForm.dueDate}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, dueDate: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePayment()}>
              Create payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTable({
  payments,
  customerMap,
  onTransition,
  onRemove,
}: {
  payments: Payment[];
  customerMap: Map<string, { displayName: string }>;
  onTransition: (id: Id<"customerPayments">, status: PaymentStatus) => void;
  onRemove: (id: Id<"customerPayments">) => void;
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
            <TableHead>Due date</TableHead>
            <TableHead>Paid at</TableHead>
            <TableHead>WC Pay</TableHead>
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
                {p.dueDate ? formatDate(p.dueDate) : "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.paidAt ? formatDate(p.paidAt) : "-"}
              </TableCell>
              <TableCell>
                {p.wcPayGatewayUrl ? (
                  <a
                    href={p.wcPayGatewayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Pay
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {p.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTransition(p._id, "sent")}
                      >
                        Send
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTransition(p._id, "cancelled")}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(p._id)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                  {p.status === "sent" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTransition(p._id, "pending")}
                      >
                        Mark pending
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTransition(p._id, "overdue")}
                      >
                        Mark overdue
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTransition(p._id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {p.status === "pending" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onTransition(p._id, "paid")}
                      >
                        Mark paid
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTransition(p._id, "overdue")}
                      >
                        Mark overdue
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTransition(p._id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {p.status === "overdue" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onTransition(p._id, "paid")}
                      >
                        Mark paid
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTransition(p._id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {p.status === "cancelled" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTransition(p._id, "draft")}
                      >
                        Reopen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(p._id)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                  {p.status === "paid" && p.txExplorerUrl && (
                    <a
                      href={p.txExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View tx
                    </a>
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
        description="Inbound revenue desk — usage, invoices, one-time, and checkout"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <CustomerPaymentsContent
              showCreate={showCreate}
              setShowCreate={setShowCreate}
            />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
