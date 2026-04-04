"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCents, formatDate } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const customer = useQuery(api.customers.getById, {
    id: id as Id<"customers">,
  });
  const payments = useQuery(api.customerPayments.listByCustomer, {
    customerId: id as Id<"customers">,
  });
  const updateCustomer = useMutation(api.customers.update);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: "",
    email: "",
    contactName: "",
    walletAddress: "",
    notes: "",
  });

  if (customer === undefined) {
    return (
      <>
        <PageHeader title="Customer" description="Loading..." />
        <div className="p-4 lg:p-6">
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }

  if (customer === null) {
    return (
      <>
        <PageHeader title="Customer" description="Not found" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-muted-foreground">Customer not found.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/customers">Back to customers</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const startEdit = () => {
    setEditData({
      displayName: customer.displayName,
      email: customer.email ?? "",
      contactName: customer.contactName ?? "",
      walletAddress: customer.walletAddress ?? "",
      notes: customer.notes ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateCustomer({
      id: customer._id,
      displayName: editData.displayName,
      email: editData.email || undefined,
      contactName: editData.contactName || undefined,
      walletAddress: editData.walletAddress || undefined,
      notes: editData.notes || undefined,
    });
    setEditing(false);
  };

  const paidPayments = payments?.filter((p) => p.status === "paid") ?? [];
  const totalRevenueCents = paidPayments.reduce(
    (s, p) => s + p.amountCents,
    0
  );
  const pendingPayments =
    payments?.filter((p) =>
      ["draft", "sent", "pending"].includes(p.status)
    ) ?? [];
  const pendingCents = pendingPayments.reduce(
    (s, p) => s + p.amountCents,
    0
  );

  return (
    <>
      <PageHeader
        title={customer.displayName}
        description={`${customer.customerType} · ${customer.pricingModel}`}
        action={
          editing
            ? { label: "Save", onClick: () => void saveEdit() }
            : { label: "Edit", onClick: startEdit }
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/customers">Back to customers</Link>
          </Button>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total revenue</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatCents(totalRevenueCents)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {paidPayments.length} payment{paidPayments.length !== 1 ? "s" : ""} settled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatCents(pendingCents)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {pendingPayments.length} payment{pendingPayments.length !== 1 ? "s" : ""} awaiting settlement
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Billing state</CardDescription>
              <CardTitle className="text-2xl">
                <Badge
                  variant={
                    customer.billingState === "active"
                      ? "default"
                      : customer.billingState === "overdue"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-base capitalize"
                >
                  {customer.billingState}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground capitalize">
                {customer.pricingModel} pricing model
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ─── Identity / Billing Profile ─── */}
          <Card>
            <CardHeader>
              <CardTitle>Identity / Billing Profile</CardTitle>
              <CardDescription>
                Customer information and billing details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-2">
                    <Label>Display name</Label>
                    <Input
                      value={editData.displayName}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          displayName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Contact name</Label>
                    <Input
                      value={editData.contactName}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          contactName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Input
                      value={editData.notes}
                      onChange={(e) =>
                        setEditData({ ...editData, notes: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Display name" value={customer.displayName} />
                    <Field label="Full name" value={customer.fullName ?? "Not provided"} />
                    <Field label="Customer type" value={customer.customerType} />
                    <Field
                      label="Billing state"
                      value={customer.billingState}
                      badge
                    />
                    <Field label="Pricing model" value={customer.pricingModel} />
                    <Field label="Country" value={customer.country ?? "Not provided"} />
                    <Field label="Date of birth" value={customer.dateOfBirth ?? "Not provided"} />
                    <Field
                      label="Email"
                      value={customer.email ?? "Not provided"}
                    />
                    <Field
                      label="Contact"
                      value={customer.contactName ?? "Not provided"}
                    />
                  </div>
                  {customer.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium">Notes</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {customer.notes}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ─── Wallet Profile ─── */}
          <Card>
            <CardHeader>
              <CardTitle>Wallet Profile</CardTitle>
              <CardDescription>
                Payment wallet and readiness status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <div className="grid gap-2">
                  <Label>Wallet address</Label>
                  <Input
                    value={editData.walletAddress}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        walletAddress: e.target.value,
                      })
                    }
                    placeholder="0x..."
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Wallet address</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {customer.walletAddress ?? "Not configured"}
                      </p>
                    </div>
                    <Badge
                      variant={customer.walletReady ? "default" : "secondary"}
                    >
                      {customer.walletReady ? "Ready" : "Not ready"}
                    </Badge>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium">Payment summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <Field
                        label="Total revenue"
                        value={formatCents(totalRevenueCents)}
                      />
                      <Field
                        label="Payments"
                        value={`${payments?.length ?? 0} total`}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Payment History ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              All payments and invoices for this customer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!payments || payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No payment history
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="capitalize">{p.mode}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatCents(p.amountCents)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "paid"
                                ? "default"
                                : p.status === "overdue" ||
                                    p.status === "cancelled"
                                  ? "destructive"
                                  : "outline"
                            }
                            className="capitalize"
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.description ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.paidAt
                            ? formatDate(p.paidAt)
                            : formatDate(p._creationTime)}
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
    </>
  );
}

function Field({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {badge ? (
        <Badge variant="outline" className="mt-0.5 capitalize">
          {value}
        </Badge>
      ) : (
        <p className="text-sm font-medium capitalize">{value}</p>
      )}
    </div>
  );
}
