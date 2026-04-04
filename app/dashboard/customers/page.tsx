"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";

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

function CustomersContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
  const router = useRouter();
  const { companyId } = useCompany();
  const customers = useQuery(
    api.customers.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createCustomer = useMutation(api.customers.create);
  const removeCustomer = useMutation(api.customers.remove);
  const [formData, setFormData] = useState({
    displayName: "",
    customerType: "company" as const,
    pricingModel: "invoice" as const,
    email: "",
    contactName: "",
  });

  if (!customers) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            {customers.length} customer{customers.length !== 1 ? "s" : ""} in
            this workspace
          </CardDescription>
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
                      <TableCell>
                        <Badge
                          variant={cust.walletReady ? "default" : "secondary"}
                        >
                          {cust.walletReady ? "Ready" : "Not ready"}
                        </Badge>
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

export default function CustomersPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage inbound payment counterparts"
        action={{ label: "Add customer", onClick: () => setShowCreate(true) }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <CustomersContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
