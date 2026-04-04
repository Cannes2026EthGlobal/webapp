"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents } from "@/lib/format";

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
import { Skeleton } from "@/components/ui/skeleton";

function EmployeesContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
  const { companyId } = useCompany();
  const employees = useQuery(
    api.employees.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createEmployee = useMutation(api.employees.create);
  const removeEmployee = useMutation(api.employees.remove);
  const [formData, setFormData] = useState({
    displayName: "",
    role: "",
    employmentType: "full-time" as const,
    compensationModel: "salary" as const,
    payoutAsset: "USDC",
    payoutAmountCents: 0,
    payoutFrequency: "monthly" as const,
    privacyLevel: "pseudonymous" as const,
    email: "",
    walletAddress: "",
  });

  if (!employees) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!companyId || !formData.displayName || !formData.role) return;
    await createEmployee({
      companyId,
      displayName: formData.displayName,
      role: formData.role,
      employmentType: formData.employmentType,
      compensationModel: formData.compensationModel,
      payoutAsset: formData.payoutAsset,
      payoutAmountCents: formData.payoutAmountCents,
      payoutFrequency: formData.payoutFrequency,
      walletVerified: false,
      privacyLevel: formData.privacyLevel,
      status: "onboarding",
      email: formData.email || undefined,
      walletAddress: formData.walletAddress || undefined,
    });
    setShowCreate(false);
    setFormData({
      displayName: "",
      role: "",
      employmentType: "full-time",
      compensationModel: "salary",
      payoutAsset: "USDC",
      payoutAmountCents: 0,
      payoutFrequency: "monthly",
      privacyLevel: "pseudonymous",
      email: "",
      walletAddress: "",
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>
            {employees.length} employee{employees.length !== 1 ? "s" : ""} in
            this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No employees yet. Add your first team member.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Privacy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp._id}>
                      <TableCell className="font-medium">
                        {emp.displayName}
                      </TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {emp.employmentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {emp.compensationModel}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCents(emp.payoutAmountCents)}/{emp.payoutFrequency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={emp.walletVerified ? "default" : "secondary"}
                        >
                          {emp.walletVerified ? "Verified" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {emp.privacyLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void removeEmployee({ id: emp._id })}
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Add a new team member to this workspace.
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
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Employment type</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      employmentType: v as typeof formData.employmentType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Compensation model</Label>
                <Select
                  value={formData.compensationModel}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      compensationModel: v as typeof formData.compensationModel,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="per-task">Per task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Payout amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.payoutAmountCents / 100 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payoutAmountCents: Math.round(
                        parseFloat(e.target.value || "0") * 100
                      ),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.payoutFrequency}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      payoutFrequency: v as typeof formData.payoutFrequency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="per-task">Per task</SelectItem>
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
              <Label>Privacy level</Label>
              <Select
                value={formData.privacyLevel}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    privacyLevel: v as typeof formData.privacyLevel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pseudonymous">Pseudonymous</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="shielded">Shielded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Add employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "default"
      : status === "inactive"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage team members and outbound payment counterparts"
        action={{ label: "Add employee", onClick: () => setShowCreate(true) }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <EmployeesContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
