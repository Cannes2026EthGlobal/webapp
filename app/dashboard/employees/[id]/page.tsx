"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCents, formatDate, formatDateShort } from "@/lib/format";
import { toast } from "sonner";

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
  const compLines = useQuery(api.compensationLines.listByEmployee, {
    employeeId: id as Id<"employees">,
  });
  const updateEmployee = useMutation(api.employees.update);

  const [identityRevealed, setIdentityRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
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
    toast.success("Employee updated");
  };

  const settledPayments = payments?.filter((p) => p.status === "settled") ?? [];
  const totalPaidCents = settledPayments.reduce((s, p) => s + p.amountCents, 0);
  const activeLines = compLines?.filter((l) => l.isActive) ?? [];
  const totalCompCents = activeLines.reduce((s, l) => s + l.amountCents, 0);

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
                    <Input value={editData.displayName} onChange={(e) => setEditData({ ...editData, displayName: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Input value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Display name" value={employee.displayName} />
                    <Field label="Role" value={employee.role} />
                    <Field label="Employment type" value={employee.employmentType} />
                    <Field label="Status" value={employee.status} badge />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Legal identity</p>
                    <Button variant="outline" size="sm" onClick={() => setIdentityRevealed(!identityRevealed)}>
                      {identityRevealed ? "Conceal" : "Reveal"}
                    </Button>
                  </div>
                  {identityRevealed ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Legal name" value={employee.legalName ?? "Not provided"} />
                      <Field label="Tax ID" value={employee.taxId ?? "Not provided"} />
                      <Field label="Jurisdiction" value={employee.jurisdiction ?? "Not provided"} />
                      <Field label="Email" value={employee.email ?? "Not provided"} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Identity data is concealed. Click reveal to view.
                    </p>
                  )}
                  {employee.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium">Notes</p>
                        <p className="mt-1 text-sm text-muted-foreground">{employee.notes}</p>
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
              <CardDescription>Wallet addresses and verification status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-2">
                    <Label>Primary wallet</Label>
                    <Input value={editData.walletAddress} onChange={(e) => setEditData({ ...editData, walletAddress: e.target.value })} placeholder="0x..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Backup wallet</Label>
                    <Input value={editData.backupWalletAddress} onChange={(e) => setEditData({ ...editData, backupWalletAddress: e.target.value })} placeholder="0x..." />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Primary wallet</p>
                        <p className="text-xs font-mono text-muted-foreground">{employee.walletAddress ?? "Not configured"}</p>
                      </div>
                      <Badge variant={employee.walletVerified ? "default" : "secondary"}>
                        {employee.walletVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Backup wallet</p>
                        <p className="text-xs font-mono text-muted-foreground">{employee.backupWalletAddress ?? "Not configured"}</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Payment summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <Field label="Total paid" value={formatCents(totalPaidCents)} />
                      <Field label="Payments" value={`${settledPayments.length} settled`} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Compensation Lines ─── */}
        <CompensationCard
          employeeId={employee._id}
          companyId={employee.companyId}
          lines={compLines ?? []}
          totalCompCents={totalCompCents}
        />

        {/* ─── Payment History ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>All payments associated with this employee</CardDescription>
          </CardHeader>
          <CardContent>
            {!payments || payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payment history</p>
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
                        <TableCell className="tabular-nums">{formatCents(p.amountCents)}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "settled" ? "default" : p.status === "failed" ? "destructive" : "outline"} className="capitalize">
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.description ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.settledAt ? formatDate(p.settledAt) : formatDate(p._creationTime)}</TableCell>
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

// ─── Compensation Lines Card ───

type CompLine = {
  _id: Id<"compensationLines">;
  _creationTime: number;
  name: string;
  description?: string;
  amountCents: number;
  asset: string;
  frequency: string;
  startDate?: number;
  endDate?: number;
  isActive: boolean;
};

function CompensationCard({
  employeeId,
  companyId,
  lines,
  totalCompCents,
}: {
  employeeId: Id<"employees">;
  companyId: Id<"companies">;
  lines: CompLine[];
  totalCompCents: number;
}) {
  const createLine = useMutation(api.compensationLines.create);
  const updateLine = useMutation(api.compensationLines.update);
  const toggleActive = useMutation(api.compensationLines.toggleActive);
  const removeLine = useMutation(api.compensationLines.remove);

  const [showAdd, setShowAdd] = useState(false);
  const [editingLine, setEditingLine] = useState<CompLine | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amountCents: 0,
    asset: "USDC",
    frequency: "monthly" as string,
    startDate: "",
    endDate: "",
  });

  const resetForm = () => {
    setForm({ name: "", description: "", amountCents: 0, asset: "USDC", frequency: "monthly", startDate: "", endDate: "" });
  };

  const handleAdd = async () => {
    if (!form.name || !form.amountCents) return;
    try {
      await createLine({
        employeeId,
        companyId,
        name: form.name,
        description: form.description || undefined,
        amountCents: form.amountCents,
        asset: form.asset,
        frequency: form.frequency as "monthly" | "biweekly" | "weekly",
        startDate: form.startDate ? new Date(form.startDate).getTime() : undefined,
        endDate: form.endDate ? new Date(form.endDate).getTime() : undefined,
        isActive: true,
      });
      toast.success("Compensation line added");
      setShowAdd(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add line");
    }
  };

  const handleEditSave = async () => {
    if (!editingLine) return;
    try {
      await updateLine({
        id: editingLine._id,
        name: form.name,
        description: form.description || undefined,
        amountCents: form.amountCents,
        asset: form.asset,
        frequency: form.frequency as "monthly" | "biweekly" | "weekly",
        startDate: form.startDate ? new Date(form.startDate).getTime() : undefined,
        endDate: form.endDate ? new Date(form.endDate).getTime() : undefined,
      });
      toast.success("Compensation line updated");
      setEditingLine(null);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const startEdit = (line: CompLine) => {
    setForm({
      name: line.name,
      description: line.description ?? "",
      amountCents: line.amountCents,
      asset: line.asset,
      frequency: line.frequency,
      startDate: line.startDate ? new Date(line.startDate).toISOString().slice(0, 10) : "",
      endDate: line.endDate ? new Date(line.endDate).toISOString().slice(0, 10) : "",
    });
    setEditingLine(line);
  };

  const isDialogOpen = showAdd || !!editingLine;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compensation</CardTitle>
              <CardDescription>
                {lines.length} line{lines.length !== 1 ? "s" : ""} — Total active: {formatCents(totalCompCents)}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
              Add line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No compensation lines. Add one to define this employee's pay structure.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line._id} className={!line.isActive ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{line.name}</span>
                          {line.description && (
                            <p className="text-xs text-muted-foreground">{line.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCents(line.amountCents)} <span className="text-xs text-muted-foreground">{line.asset}</span></TableCell>
                      <TableCell className="capitalize">{line.frequency}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {line.startDate ? formatDateShort(line.startDate) : "No start"}
                        {" — "}
                        {line.endDate ? formatDateShort(line.endDate) : "Ongoing"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={line.isActive ? "default" : "secondary"}>
                          {line.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(line)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await toggleActive({ id: line._id, isActive: !line.isActive });
                                toast.success(line.isActive ? "Line deactivated" : "Line activated");
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed");
                              }
                            }}
                          >
                            {line.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await removeLine({ id: line._id });
                                toast.success("Line removed");
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to remove");
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingLine(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLine ? "Edit compensation line" : "Add compensation line"}</DialogTitle>
            <DialogDescription>
              {editingLine ? "Update the compensation details." : "Define a new compensation arrangement for this employee."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Base Salary" />
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Monthly base compensation" />
            </div>
            <div className="grid gap-2">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  value={form.amountCents / 100 || ""}
                  onChange={(e) => setForm({ ...form, amountCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Asset</Label>
                <Input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>End date (leave empty for ongoing)</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingLine(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={() => void (editingLine ? handleEditSave() : handleAdd())}>
              {editingLine ? "Save changes" : "Add line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {badge ? (
        <Badge variant="outline" className="mt-0.5 capitalize">{value}</Badge>
      ) : (
        <p className="text-sm font-medium capitalize">{value}</p>
      )}
    </div>
  );
}
