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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employee = useQuery(api.employees.getById, {
    id: id as Id<"employees">,
  });
  const payments = useQuery(api.employeePayments.listByEmployee, {
    employeeId: id as Id<"employees">,
  });
  const updateEmployee = useMutation(api.employees.update);

  const [identityRevealed, setIdentityRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<{
    displayName: string;
    role: string;
    email: string;
    walletAddress: string;
    backupWalletAddress: string;
  }>({
    displayName: "",
    role: "",
    email: "",
    walletAddress: "",
    backupWalletAddress: "",
  });

  if (employee === undefined) {
    return (
      <>
        <PageHeader title="Employee" description="Loading..." />
        <div className="p-4 lg:p-6">
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }

  if (employee === null) {
    return (
      <>
        <PageHeader title="Employee" description="Not found" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-muted-foreground">Employee not found.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/employees">Back to employees</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const startEdit = () => {
    setEditData({
      displayName: employee.displayName,
      role: employee.role,
      email: employee.email ?? "",
      walletAddress: employee.walletAddress ?? "",
      backupWalletAddress: employee.backupWalletAddress ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateEmployee({
      id: employee._id,
      displayName: editData.displayName,
      role: editData.role,
      email: editData.email || undefined,
      walletAddress: editData.walletAddress || undefined,
      backupWalletAddress: editData.backupWalletAddress || undefined,
    });
    setEditing(false);
  };

  const settledPayments = payments?.filter((p) => p.status === "settled") ?? [];
  const totalPaidCents = settledPayments.reduce(
    (s, p) => s + p.amountCents,
    0
  );

  return (
    <>
      <PageHeader
        title={employee.displayName}
        description={`${employee.role} · ${employee.employmentType}`}
        action={
          editing
            ? { label: "Save", onClick: () => void saveEdit() }
            : { label: "Edit", onClick: startEdit }
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/employees">Back to employees</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ─── Identity Vault ─── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Identity Vault</CardTitle>
                  <CardDescription>
                    Sensitive identity data — concealed by default
                  </CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">
                  {employee.privacyLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-2">
                    <Label>Display name</Label>
                    <Input
                      value={editData.displayName}
                      onChange={(e) =>
                        setEditData({ ...editData, displayName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Input
                      value={editData.role}
                      onChange={(e) =>
                        setEditData({ ...editData, role: e.target.value })
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
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Display name" value={employee.displayName} />
                    <Field label="Role" value={employee.role} />
                    <Field
                      label="Employment type"
                      value={employee.employmentType}
                    />
                    <Field
                      label="Compensation"
                      value={`${formatCents(employee.payoutAmountCents)} / ${employee.payoutFrequency}`}
                    />
                    <Field label="Payout asset" value={employee.payoutAsset} />
                    <Field
                      label="Status"
                      value={employee.status}
                      badge
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Legal identity</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIdentityRevealed(!identityRevealed)}
                    >
                      {identityRevealed ? "Conceal" : "Reveal"}
                    </Button>
                  </div>

                  {identityRevealed ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="Legal name"
                        value={employee.legalName ?? "Not provided"}
                      />
                      <Field
                        label="Tax ID"
                        value={employee.taxId ?? "Not provided"}
                      />
                      <Field
                        label="Jurisdiction"
                        value={employee.jurisdiction ?? "Not provided"}
                      />
                      <Field
                        label="Email"
                        value={employee.email ?? "Not provided"}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Identity data is concealed. Click reveal to view legal
                      name, tax ID, and jurisdiction.
                    </p>
                  )}

                  {employee.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium">Notes</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {employee.notes}
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
                Wallet addresses and verification status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-2">
                    <Label>Primary wallet</Label>
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
                  <div className="grid gap-2">
                    <Label>Backup wallet</Label>
                    <Input
                      value={editData.backupWalletAddress}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          backupWalletAddress: e.target.value,
                        })
                      }
                      placeholder="0x..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Primary wallet</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {employee.walletAddress ?? "Not configured"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          employee.walletVerified ? "default" : "secondary"
                        }
                      >
                        {employee.walletVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Backup wallet</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {employee.backupWalletAddress ?? "Not configured"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Payout asset" value={employee.payoutAsset} />
                    <Field
                      label="Next payment"
                      value={
                        employee.nextPaymentDate
                          ? formatDate(employee.nextPaymentDate)
                          : "Not scheduled"
                      }
                    />
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium">Payment summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <Field
                        label="Total paid"
                        value={formatCents(totalPaidCents)}
                      />
                      <Field
                        label="Payments"
                        value={`${settledPayments.length} settled`}
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
              All payments associated with this employee
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
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="capitalize">{p.type}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatCents(p.amountCents)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "settled"
                                ? "default"
                                : p.status === "failed"
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
                          {p.settledAt
                            ? formatDate(p.settledAt)
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
