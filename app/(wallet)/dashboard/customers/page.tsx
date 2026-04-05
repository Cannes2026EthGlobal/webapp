"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

function CustomersContent({
  showCreate,
  setShowCreate,
  showCreatePayment,
  setShowCreatePayment,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  showCreatePayment: boolean;
  setShowCreatePayment: (v: boolean) => void;
}) {
  const router = useRouter();
  const { companyId } = useCompany();
  const customers = useQuery(
    api.customers.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const payments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createCustomer = useMutation(api.customers.create);
  const removeCustomer = useMutation(api.customers.remove);
  const createPayment = useMutation(api.customerPayments.create);
  const updatePaymentStatus = useMutation(api.customerPayments.updateStatus);
  const removePayment = useMutation(api.customerPayments.remove);

  const [formData, setFormData] = useState({
    displayName: "",
    customerType: "company" as const,
    pricingModel: "invoice" as const,
    email: "",
    contactName: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    mode: "invoice" as const,
    amountCents: 0,
    currency: "USD" as "USD" | "EUR",
    description: "",
  });

  if (!customers || !payments) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const customerMap = new Map(customers.map((c) => [c._id, c]));

  const handleCreate = async () => {
    if (!companyId || !formData.displayName) return;
    await createCustomer({
      companyId,
      displayName: formData.displayName,
      customerType: formData.customerType,
      pricingModel: formData.pricingModel,
      billingState: "active",
      walletReady: false,
      email: formData.email || undefined,
      contactName: formData.contactName || undefined,
    });
    setShowCreate(false);
    setFormData({
      displayName: "",
      customerType: "company",
      pricingModel: "invoice",
      email: "",
      contactName: "",
    });
  };

  const handleCreatePayment = async () => {
    if (!companyId || !paymentForm.amountCents) return;
    await createPayment({
      companyId,
      customerId: paymentForm.customerId
        ? (paymentForm.customerId as Id<"customers">)
        : undefined,
      mode: paymentForm.mode,
      amountCents: paymentForm.amountCents,
      currency: paymentForm.currency,
      description: paymentForm.description || undefined,
    });
    setShowCreatePayment(false);
    setPaymentForm({
      customerId: "",
      mode: "invoice",
      amountCents: 0,
      currency: "USD",
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

  const paidUsd = payments.filter((p) => p.status === "paid" && (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0);
  const paidEur = payments.filter((p) => p.status === "paid" && p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0);
  const pendingUsd = payments.filter((p) => ["draft", "sent", "pending"].includes(p.status) && (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0);
  const pendingEur = payments.filter((p) => ["draft", "sent", "pending"].includes(p.status) && p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0);
  const overdueUsd = payments.filter((p) => p.status === "overdue" && (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0);
  const overdueEur = payments.filter((p) => p.status === "overdue" && p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6" data-tour="customer-list">
      {/* ─── Payment Summary ─── */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(paidUsd, "USD")}
              {paidEur > 0 && <span className="text-lg ml-2">{formatCents(paidEur, "EUR")}</span>}
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
              {formatCents(pendingUsd, "USD")}
              {pendingEur > 0 && <span className="text-lg ml-2">{formatCents(pendingEur, "EUR")}</span>}
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
              {formatCents(overdueUsd, "USD")}
              {overdueEur > 0 && <span className="text-lg ml-2">{formatCents(overdueEur, "EUR")}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Past due date, needs intervention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Customer Roster ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                {customers.length} customer{customers.length !== 1 ? "s" : ""} in
                this workspace
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No customers yet. Add your first customer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((cust) => (
                    <TableRow
                      key={cust._id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/customers/${cust._id}`)}
                    >
                      <TableCell className="font-medium">
                        {cust.displayName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {cust.customerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {cust.pricingModel}
                      </TableCell>
                      <TableCell>
                        <BillingBadge state={cust.billingState} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {cust.walletAddress
                          ? `${cust.walletAddress.slice(0, 6)}...${cust.walletAddress.slice(-4)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cust.email ?? cust.contactName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeCustomer({ id: cust._id });
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Receivables ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Receivables</CardTitle>
              <CardDescription>
                Inbound revenue from usage, invoices, one-time payments, and checkout
                links
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreatePayment(true)}>
              New receivable
            </Button>
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

            {(
              ["all", "usage", "invoice", "one-time", "checkout"] as const
            ).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <CustomerPaymentsTable
                  payments={modeGroups[tab]}
                  customerMap={customerMap}
                  onTransition={async (id, status) => {
                    try {
                      await updatePaymentStatus({
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
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── Create Customer Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>
              Add a new inbound payment counterpart.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Customer type</Label>
                <Select
                  value={formData.customerType}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      customerType: v as typeof formData.customerType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="app">App</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Pricing model</Label>
                <Select
                  value={formData.pricingModel}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      pricingModel: v as typeof formData.pricingModel,
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
                    <SelectItem value="subscription">Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactName">Contact name (optional)</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Add customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Receivable Dialog ─── */}
      <Dialog open={showCreatePayment} onOpenChange={setShowCreatePayment}>
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
                      mode: v as typeof paymentForm.mode,
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
                <Label>Currency</Label>
                <Select
                  value={paymentForm.currency}
                  onValueChange={(v) =>
                    setPaymentForm({
                      ...paymentForm,
                      currency: v as "USD" | "EUR",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USDC</SelectItem>
                    <SelectItem value="EUR">EURC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentAmount">Amount ({paymentForm.currency === "EUR" ? "EURC" : "USDC"})</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="any"
                min="0"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePayment(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePayment()}>
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
}: {
  payments: Array<{
    _id: Id<"customerPayments">;
    _creationTime: number;
    customerId?: Id<"customers">;
    mode: string;
    amountCents: number;
    currency?: "USD" | "EUR";
    status: string;
    description?: string;
    dueDate?: number;
    paidAt?: number;
  }>;
  customerMap: Map<string, { displayName: string }>;
  onTransition: (id: Id<"customerPayments">, status: "draft" | "sent" | "pending" | "paid" | "overdue" | "cancelled") => void;
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
                {formatCents(p.amountCents, p.currency ?? "USD")}
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
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "sent")}>
                      Send
                    </Button>
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

function BillingBadge({ state }: { state: string }) {
  const variant =
    state === "active"
      ? "default"
      : state === "overdue"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {state}
    </Badge>
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

export default function CustomersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage inbound payment counterparts and receivables"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <CustomersContent
              showCreate={showCreate}
              setShowCreate={setShowCreate}
              showCreatePayment={showCreatePayment}
              setShowCreatePayment={setShowCreatePayment}
            />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
