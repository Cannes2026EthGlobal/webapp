"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
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
                  onMarkPaid={(id) =>
                    void updateStatus({
                      id,
                      status: "paid",
                      paidAt: Date.now(),
                    })
                  }
                  onRemove={(id) => void removePayment({ id })}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

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
  onMarkPaid,
  onRemove,
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
  onMarkPaid: (id: Id<"customerPayments">) => void;
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
                  {["draft", "sent", "pending", "overdue"].includes(
                    p.status
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMarkPaid(p._id)}
                    >
                      Mark paid
                    </Button>
                  )}
                  {["draft", "cancelled"].includes(p.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(p._id)}
                    >
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
